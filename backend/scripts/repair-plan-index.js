import mongoose from 'mongoose'
import { repairLegacyPlanIndex } from './migrations/legacy-plan-index.js'

try {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required')
  await mongoose.connect(process.env.MONGODB_URI)
  const result = await repairLegacyPlanIndex(mongoose.connection.collection('degreePlans'), { apply: process.argv.includes('--apply') })
  console.log(JSON.stringify(result))
} catch (error) {
  // Do not print connection strings or document contents.
  console.error(error.name === 'MongoServerSelectionError' ? 'Database connection failed' : error.message)
  process.exitCode = 1
} finally { await mongoose.disconnect() }
