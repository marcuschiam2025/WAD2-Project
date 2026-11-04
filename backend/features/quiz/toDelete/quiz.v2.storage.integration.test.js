import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import QuizAttempt from '../models/QuizAttempt.js'
import QuizSubmission from '../models/QuizSubmission.js'
import QuizHistoryLock from '../models/QuizHistoryLock.js'
import { persistSubmissionV2 } from '../quiz.v2.storage.js'

// Explicit opt-in, hard-coded loopback server and unique disposable database.
// Never reads MONGODB_URI or the project's .env file.
test('v2 persistence against a disposable local replica set', {
  skip: process.env.RUN_QUIZ_DB_TESTS !== '1', timeout: 60000,
}, async (t) => {
  const uri = 'mongodb://127.0.0.1:27961'
  const bootstrap = new mongoose.mongo.MongoClient(`${uri}/?directConnection=true`, { serverSelectionTimeoutMS: 5000 })
  await bootstrap.connect()
  try {
    await bootstrap.db('admin').command({ replSetInitiate: { _id: 'quizTest', members: [{ _id: 0, host: '127.0.0.1:27961' }] } })
  } catch (error) {
    if (error.codeName !== 'AlreadyInitialized') throw error
  } finally {
    await bootstrap.close()
  }
  const dbName = `quiz_v2_integration_${Date.now()}`
  await mongoose.connect(`${uri}/${dbName}?replicaSet=quizTest`, { serverSelectionTimeoutMS: 15000 })
  try {
    await Promise.all([QuizAttempt.init(), QuizSubmission.init(), QuizHistoryLock.init()])
    const input = (user, submissionId) => ({
      user, submissionId, fingerprint: `hash-${submissionId}`,
      document: {
        rubricVersion: 'v2-draft', responses: [{ questionId: 'I1', optionId: '5' }],
        rankingBasis: 'rating', themeCoverage: { DATA: 1 },
        results: [{ track: 'BA', rank: 1, alignmentIndex: 75, scenarioPreferenceIndex: 90 }],
        resultSnapshot: { rankingBasis: 'rating', results: [{ track: 'BA', rank: 1, alignmentIndex: 75, scenarioPreferenceIndex: 90 }] },
        rubricSnapshot: { privateMapping: true },
      },
    })

    await t.test('creates, replays and rejects reused keys with different answers', async () => {
      const user = new mongoose.Types.ObjectId()
      const request = input(user, 'one')
      const created = await persistSubmissionV2(request)
      assert.equal(created.status, 201)
      const replay = await persistSubmissionV2(request)
      assert.equal(replay.status, 200)
      assert.equal(String(replay.attempt._id), String(created.attempt._id))
      assert.equal((await persistSubmissionV2({ ...request, fingerprint: 'different' })).status, 409)
      assert.equal(await QuizAttempt.countDocuments({ user }), 1)
      assert.equal((await QuizAttempt.findById(created.attempt._id)).rubricSnapshot, undefined)
      assert.deepEqual((await QuizAttempt.findById(created.attempt._id)).resultSnapshot, request.document.resultSnapshot)
    })

    await t.test('keeps two results and refuses to recreate an evicted result', async () => {
      const user = new mongoose.Types.ObjectId()
      for (const key of ['one', 'two', 'three']) await persistSubmissionV2(input(user, key))
      const attempts = await QuizAttempt.find({ user }).sort({ createdAt: -1, _id: -1 })
      assert.deepEqual(attempts.map((a) => a.submissionId), ['three', 'two'])
      assert.equal((await persistSubmissionV2(input(user, 'one'))).status, 410)
      assert.equal(await QuizAttempt.countDocuments({ user }), 2)
      assert.equal(await QuizSubmission.countDocuments({ user }), 3)
    })

    await t.test('simultaneous retries create one attempt', async () => {
      const user = new mongoose.Types.ObjectId()
      const outcomes = await Promise.all(Array.from({ length: 4 }, () => persistSubmissionV2(input(user, 'same'))))
      assert.equal(outcomes.filter((result) => result.status === 201).length, 1)
      assert.ok(outcomes.every((result) => [200, 201].includes(result.status)))
      assert.equal(await QuizAttempt.countDocuments({ user }), 1)
      assert.equal(await QuizSubmission.countDocuments({ user }), 1)
    })

    await t.test('simultaneous distinct submissions still leave exactly two results', async () => {
      const user = new mongoose.Types.ObjectId()
      await persistSubmissionV2(input(user, 'existing'))
      await Promise.all(Array.from({ length: 6 }, (_, index) => persistSubmissionV2(input(user, `parallel-${index}`))))
      assert.equal(await QuizAttempt.countDocuments({ user }), 2)
      assert.equal(await QuizSubmission.countDocuments({ user }), 7)
    })

    await t.test('failed document validation does not leave a receipt or prune history', async () => {
      const user = new mongoose.Types.ObjectId()
      await persistSubmissionV2(input(user, 'valid'))
      const invalid = input(user, 'invalid')
      invalid.document.results[0].alignmentIndex = 101
      await assert.rejects(persistSubmissionV2(invalid), { name: 'ValidationError' })
      assert.equal(await QuizAttempt.countDocuments({ user }), 1)
      assert.equal(await QuizSubmission.countDocuments({ user, submissionId: 'invalid' }), 0)
    })

    await t.test('retry keys and history are isolated by user', async () => {
      const first = new mongoose.Types.ObjectId()
      const second = new mongoose.Types.ObjectId()
      assert.equal((await persistSubmissionV2(input(first, 'shared-key'))).status, 201)
      assert.equal((await persistSubmissionV2(input(second, 'shared-key'))).status, 201)
      assert.equal(await QuizAttempt.countDocuments({ user: first }), 1)
      assert.equal(await QuizAttempt.countDocuments({ user: second }), 1)
    })
  } finally {
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
})
