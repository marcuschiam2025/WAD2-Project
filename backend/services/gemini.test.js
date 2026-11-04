import test from 'node:test'
import assert from 'node:assert/strict'
import { createGenerateJson } from './gemini.js'

const env = { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' }
const request = { system: 'S', prompt: 'P', schema: { type: 'OBJECT' } }
const reply = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body })
const answer = (text, finishReason = 'STOP') => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] })

test('sends the key in a header, never the URL, and parses the JSON answer', async () => {
  let sent
  const generate = createGenerateJson(env, async (url, init) => { sent = { url, init }; return reply(200, answer('{"summary":"ok"}'))() })
  assert.deepEqual(await generate(request), { summary: 'ok' })
  assert.match(sent.url, /models\/test-model:generateContent$/)
  assert.doesNotMatch(sent.url, /test-key/)
  assert.equal(sent.init.headers['x-goog-api-key'], 'test-key')
  const body = JSON.parse(sent.init.body)
  assert.equal(body.systemInstruction.parts[0].text, 'S')
  assert.equal(body.generationConfig.responseMimeType, 'application/json')
  assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: 'low' })
})

test('a missing key fails without calling Gemini', async () => {
  let called = false
  const generate = createGenerateJson({}, async () => { called = true })
  await assert.rejects(generate(request), { code: 'AI_UNAVAILABLE' })
  assert.equal(called, false)
})

test('every failure maps to a code the route can act on', async () => {
  const cases = [
    [reply(429, {}), 'AI_BUSY'],
    [reply(500, {}), 'AI_FAILED'],
    [reply(200, answer('{}', 'SAFETY')), 'AI_FAILED'],
    [reply(200, { candidates: [] }), 'AI_FAILED'],
    [reply(200, answer('not json')), 'AI_FAILED'],
    [async () => { throw new DOMException('timed out', 'TimeoutError') }, 'AI_TIMEOUT'],
    [async () => { throw new TypeError('fetch failed') }, 'AI_TIMEOUT'],
  ]
  for (const [send, code] of cases) await assert.rejects(createGenerateJson(env, send)(request), { code })
})
