// Replaces the planning catalogue (schools, majors, tracks, requirements, modules) and the past bid
// results (bidhistories) with data/*.json.
// Student data — users, plans, parties, quiz results and bid carts — is never touched.
// Rebuild data/ with `pnpm build-catalogue` / `pnpm build-bid-history` first if needed.
// Usage: pnpm seed              (local MongoDB only)
//        pnpm seed --remote     (any MONGODB_URI, e.g. the shared Atlas cluster)
import { readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'

const COLLECTIONS = ['schools', 'majors', 'tracks', 'requirements', 'modules', 'bidhistories']

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

await connectDB(uri)
const db = mongoose.connection.db

for (const name of COLLECTIONS) {
  await db.collection(name).deleteMany({}) // clear the old catalogue
  await db.collection(name).insertMany(data[name])
  console.log(`${name}: ${data[name].length}`)
}

await mongoose.disconnect()
