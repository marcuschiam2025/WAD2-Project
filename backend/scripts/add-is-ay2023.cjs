// Loads the IS AY2023 curriculum from data/*.json and moves BSC-IS_AY2025's start year to 2024.
// It only adds the new records and changes that one field, so it is safe to run on the shared
// database and safe to run twice. It never deletes anything.
// Usage: node --env-file=.env scripts/add-is-ay2023.cjs            (dry run, writes nothing)
//        node --env-file=.env scripts/add-is-ay2023.cjs --apply    (writes the changes)
const mongoose = require('mongoose')
const majors = require('../data/majors.json')
const tracks = require('../data/tracks.json')
const requirements = require('../data/requirements.json')

const NEW_MAJOR = 'BSC-IS_AY2023'
const CURRENT_MAJOR = 'BSC-IS_AY2025'
const apply = process.argv.includes('--apply')

const newMajors = majors.filter((major) => major._id === NEW_MAJOR)
const newTracks = tracks.filter((track) => track.majorId === NEW_MAJOR)
const newRequirements = requirements.filter((req) => req._id.startsWith(`${NEW_MAJOR}_`))

// Stops before any write if the new records don't add up or name a course that doesn't exist
async function checkRecords(db) {
  const major = newMajors[0]
  if (!major) throw new Error(`${NEW_MAJOR} is not in data/majors.json`)

  const baseCu = newRequirements
    .filter((req) => req.level !== 'track')
    .reduce((total, req) => total + req.cuRequired, 0)
  if (baseCu + major.trackCU !== major.totalCU) {
    throw new Error(`Core + major + track is ${baseCu + major.trackCU} CU, expected ${major.totalCU}`)
  }

  for (const track of newTracks) {
    const trackCu = newRequirements
      .filter((req) => req.ownerId === track._id)
      .reduce((total, req) => total + req.cuRequired, 0)
    if (trackCu !== major.trackCU) throw new Error(`${track._id} is ${trackCu} CU, expected ${major.trackCU}`)
  }

  const codes = [...new Set(newRequirements.flatMap((req) => req.modules ?? []))]
  const found = await db.collection('modules').distinct('_id', { _id: { $in: codes } })
  const missing = codes.filter((code) => !found.includes(code))
  if (missing.length > 0) throw new Error(`Not in the modules collection: ${missing.join(', ')}`)
}

// Inserts the records that aren't there yet. Existing records are left as they are.
async function addMissing(db, name, rows) {
  const ids = rows.map((row) => row._id)
  const existing = await db.collection(name).distinct('_id', { _id: { $in: ids } })
  const toAdd = rows.filter((row) => !existing.includes(row._id))
  if (apply && toAdd.length > 0) await db.collection(name).insertMany(toAdd)
  console.log(`${name}: ${toAdd.length} to add, ${existing.length} already there`)
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required')
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, serverSelectionTimeoutMS: 15000 })
  const db = mongoose.connection.db
  console.log(`database: ${db.databaseName}`)
  console.log(apply ? 'mode: APPLY' : 'mode: dry run, nothing is written')

  await checkRecords(db)

  // The major goes last, so the curriculum can't be picked until its rules are all in place
  await addMissing(db, 'requirements', newRequirements)
  await addMissing(db, 'tracks', newTracks)
  await addMissing(db, 'majors', newMajors)

  const current = await db.collection('majors').findOne({ _id: CURRENT_MAJOR })
  if (!current) throw new Error(`${CURRENT_MAJOR} is not in the majors collection`)
  console.log(`${CURRENT_MAJOR} intakeFrom: ${current.intakeFrom} -> 2024`)
  if (apply && current.intakeFrom !== 2024) {
    await db.collection('majors').updateOne({ _id: CURRENT_MAJOR }, { $set: { intakeFrom: 2024 } })
  }
}

main()
  .catch((error) => {
    // Do not print connection strings or document contents
    console.error(error.name === 'MongoServerSelectionError' ? 'Database connection failed' : error.message)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
