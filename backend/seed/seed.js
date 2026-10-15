// Loads the catalogue JSON in seed/data into MongoDB. Run with: npm run seed
// Replaces tracks, modules, quiz questions, sections and bid history; leaves user data alone.
import { readFile } from 'node:fs/promises'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import Track from '../models/Track.js'
import Module from '../models/Module.js'
import QuizQuestion from '../models/QuizQuestion.js'
import Section from '../models/Section.js'
import BidHistory from '../models/BidHistory.js'

const load = async (name) => JSON.parse(await readFile(new URL(`./data/${name}.json`, import.meta.url), 'utf8'))

const collections = [
  [Track, 'tracks'],
  [Module, 'modules'],
  [QuizQuestion, 'quizQuestions'],
  [Section, 'sections'],
  [BidHistory, 'bidHistory'],
]

try {
  await connectDB()
  for (const [Model, file] of collections) {
    const docs = await load(file)
    await Model.deleteMany({})
    await Model.insertMany(docs)
    console.log(`Seeded ${docs.length} ${file}`)
  }
} catch (err) {
  console.error('Seeding failed:', err.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
