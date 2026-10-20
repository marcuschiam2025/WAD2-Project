import mongoose from 'mongoose'
import QuizAttempt from './models/QuizAttempt.js'
import QuizSubmission from './models/QuizSubmission.js'
import QuizHistoryLock from './models/QuizHistoryLock.js'

// Transactions require MongoDB Atlas or another replica-set deployment.
// The receipt, result creation and history pruning must succeed together.
export async function persistSubmissionV2({ user, submissionId, fingerprint, document }) {
  await QuizSubmission.init() // ensure the unique retry key exists before writing
  await QuizHistoryLock.init()
  // Provision the lock outside the transaction; subsequent updates conflict and
  // trigger MongoDB's transaction retry rather than allowing snapshot write skew.
  try {
    await QuizHistoryLock.updateOne({ _id: user }, { $setOnInsert: { revision: 0 } }, { upsert: true })
  } catch (error) {
    if (error.code !== 11000) throw error
  }
  const session = await mongoose.startSession()
  let outcome
  const replay = async () => {
    const receipt = await QuizSubmission.findOne({ user, submissionId })
    if (!receipt) return null
    if (receipt.fingerprint !== fingerprint) return { status: 409, code: 'SUBMISSION_ID_REUSED' }
    const attempt = await QuizAttempt.findOne({ _id: receipt.attemptId, user })
    return attempt ? { status: 200, attempt } : { status: 410, code: 'QUIZ_RESULT_EXPIRED' }
  }
  try {
    const previous = await replay()
    if (previous) return previous
    try {
      await session.withTransaction(async () => {
        await QuizHistoryLock.updateOne({ _id: user }, { $inc: { revision: 1 } }, { session })
        const receipt = await QuizSubmission.findOne({ user, submissionId }).session(session)
        if (receipt) {
          if (receipt.fingerprint !== fingerprint) {
            outcome = { status: 409, code: 'SUBMISSION_ID_REUSED' }
          } else {
            const attempt = await QuizAttempt.findOne({ _id: receipt.attemptId, user }).session(session)
            outcome = attempt ? { status: 200, attempt } : { status: 410, code: 'QUIZ_RESULT_EXPIRED' }
          }
          return
        }
        const [attempt] = await QuizAttempt.create([{ ...document, user, submissionId }], { session })
        await QuizSubmission.create([{ user, submissionId, fingerprint, attemptId: attempt._id }], { session })
        const old = await QuizAttempt.find({ user }).sort({ createdAt: -1, _id: -1 }).skip(2).select('_id').session(session)
        if (old.length) await QuizAttempt.deleteMany({ _id: { $in: old.map((item) => item._id) }, user }, { session })
        outcome = { status: 201, attempt }
      })
    } catch (error) {
      if (error.code !== 11000) throw error
      // Another concurrent request may have committed the same retry key.
      const previous = await replay()
      if (!previous) throw error
      return previous
    }
    return outcome
  } finally {
    await session.endSession()
  }
}
