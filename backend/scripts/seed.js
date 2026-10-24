// Replaces the planning catalogue (schools, majors, tracks, requirements, modules), the past bid
// results (bidhistories) and the class sections (sections) with data/*.json.
// Student data — users, plans, parties, quiz results and bid carts — is never touched.
// Rebuild data/ with `pnpm build-catalogue` / `pnpm build-bid-history` / `pnpm build-sections` first if needed.
// Usage: pnpm seed              (local MongoDB only)
//        pnpm seed --remote     (any MONGODB_URI, e.g. the shared Atlas cluster)
import { readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'

const COLLECTIONS = ['schools', 'majors', 'tracks', 'requirements', 'modules', 'bidhistories', 'sections']

// Safety check: only overwrite a remote database (like Atlas) when --remote is passed
const uri = process.env.MONGODB_URI ?? ''
const isLocal = /^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/.test(uri)
const remoteAllowed = process.argv.includes('--remote')
if (!isLocal && !remoteAllowed) {
  console.error('MONGODB_URI is not a local database. Re-run with --remote to overwrite its catalogue.')
  process.exit(1)
}

// Read every data file before touching the database, so a broken file stops the seed early
const data = {}
for (const name of COLLECTIONS) {
  const text = readFileSync(new URL(`../data/${name}.json`, import.meta.url))
  data[name] = JSON.parse(text)
}

// Every section must belong to a module in the catalogue. insertMany skips the Section model's own
// check (models/Section.js), so check here before touching the database.
const moduleCodes = new Set()
for (const module of data.modules) {
  moduleCodes.add(module._id)
}
const orphans = new Set()
for (const section of data.sections) {
  if (!moduleCodes.has(section.module)) orphans.add(section.module)
}
if (orphans.size > 0) {
  console.error(`sections.json has modules missing from modules.json: ${[...orphans].join(', ')}`)
  console.error('Re-run `pnpm build-sections` after `pnpm build-catalogue`.')
  process.exit(1)
}

await connectDB(uri)
const db = mongoose.connection.db

if (await db.collection('auditentries').findOne({ entity: { $in: ['module', 'section', 'curriculum', 'track', 'bidding-round'] } })) {
  await mongoose.disconnect()
  throw new Error('Catalogue has staff edits. Seeding is blocked to preserve them. Use a separate disposable database for reseeding.')
}

for (const name of COLLECTIONS) {
  await db.collection(name).deleteMany({}) // clear the old catalogue
  await db.collection(name).insertMany(data[name])
  console.log(`${name}: ${data[name].length}`)
}

await mongoose.disconnect()
