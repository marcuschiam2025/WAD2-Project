import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('choosing an answer advances once, preserves earlier answers and leaves final submission explicit', async () => {
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  const server = await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
  try {
    const { useQuizStore } = await server.ssrLoadModule('/src/core/stores/quiz.js')
    setActivePinia(createPinia())
    const quiz = useQuizStore()
    quiz.questions = [1,2,3].map(id => ({id:`q${id}`,type:'rating',options:[{id:'1'},{id:'5'}]}))
    quiz.rubricVersion = 'test'
    quiz.start()
    quiz.chooseAnswer('5')
    assert.equal(quiz.current,1)
    assert.equal(quiz.answers.q1,'5')
    quiz.current--
    quiz.chooseAnswer('5') // same answer must still advance after returning with Back
    assert.equal(quiz.current,1)
    quiz.chooseAnswer('1')
    assert.equal(quiz.current,2)
    quiz.chooseAnswer('5')
    assert.equal(quiz.current,2)
    assert.equal(quiz.submitting,false)
    assert.equal(quiz.hasDraft,true)
    quiz.current=0
    quiz.chooseAnswer('invalid')
    assert.equal(quiz.current,0)
    assert.equal(quiz.answers.q1,'5')
    quiz.submitting=true
    quiz.chooseAnswer('1')
    assert.equal(quiz.current,0)
    assert.equal(quiz.answers.q1,'5')
  } finally { await server.close() }
})
