import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { api } from '../services/api'
import { useUserStore } from './user'

export const sectionLabels = {
  interests: 'Interests', strengths: 'Current confidence',
  'working-style': 'Working style', 'career-goals': 'Career goals',
}
export const quizTrackNames = {
  BA: 'Business Analytics', PD: 'Product Development', FT: 'Financial Technology',
  SMT: 'Smart-City Management & Technology', DCS: 'Digitalisation & Cloud Solutions (legacy)',
}

export const useQuizStore = defineStore('quiz', () => {
  const user = useUserStore()
  const questions = ref([])
  const rubricVersion = ref(null)
  const answers = ref({})
  const optionOrders = ref({})
  const current = ref(0)
  const attempts = ref([])
  const submissionId = ref(null)
  const hasDraft = ref(false)
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref('')
  const issues = ref([])
  let loadingPromise
  let restoring = false
  let sessionRevision = 0

  // Invalidate in-flight requests and private state when the session changes.
  watch(() => [user.isSignedIn, user.profile.email], () => {
    sessionRevision += 1
    restoring = true
    answers.value = {}
    optionOrders.value = {}
    current.value = 0
    attempts.value = []
    submissionId.value = null
    hasDraft.value = false
    error.value = ''
    issues.value = []
    loading.value = false
    submitting.value = false
    loadingPromise = null
    restoring = false
  }, { flush: 'sync' })
  const draftKey = () => `bidmaxxer:quiz:v2:${user.profile.email}`
  const latest = computed(() => attempts.value[0] ?? null)
  const answeredCount = computed(() => questions.value.filter((q) => {
    const answer = answers.value[q.id]
    return answer != null && !(q.type === 'scenario' && answer === 'e')
  }).length)
  const sectionCoverage = computed(() => Object.keys(sectionLabels).map((section) => {
    const items = questions.value.filter((q) => q.section === section)
    const answered = items.filter((q) => answers.value[q.id] != null && !(q.type === 'scenario' && answers.value[q.id] === 'e')).length
    const scenarios = items.filter((q) => q.type === 'scenario' && ['a', 'b', 'c', 'd'].includes(answers.value[q.id])).length
    return { section, label: sectionLabels[section], answered, scenarios, eligible: answered >= 3 && scenarios >= 1 }
  }))

  function saveDraft() {
    if (restoring || !hasDraft.value || !rubricVersion.value) return
    try {
      sessionStorage.setItem(draftKey(), JSON.stringify({ rubricVersion: rubricVersion.value, answers: answers.value, optionOrders: optionOrders.value, current: current.value, submissionId: submissionId.value }))
    } catch { /* The active attempt still works if browser storage is unavailable. */ }
  }
  watch([answers, optionOrders, current, submissionId], saveDraft, { deep: true, flush: 'sync' })

  function restoreDraft() {
    restoring = true
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey()))
      if (saved?.rubricVersion !== rubricVersion.value || !saved.answers || typeof saved.answers !== 'object' || Array.isArray(saved.answers)) return
      const valid = questions.value.every((q) => Object.hasOwn(saved.answers, q.id) && (saved.answers[q.id] === null || q.options.some((o) => o.id === saved.answers[q.id])))
      if (!valid) return
      answers.value = saved.answers
      optionOrders.value = saved.optionOrders ?? {}
      current.value = Math.max(0, Math.min(Number.isInteger(saved.current) ? saved.current : 0, questions.value.length - 1))
      submissionId.value = typeof saved.submissionId === 'string' ? saved.submissionId : crypto.randomUUID()
      hasDraft.value = true
    } catch { /* Ignore malformed browser storage. */ }
    finally { restoring = false }
  }

  async function initialize() {
    if (loadingPromise) return loadingPromise
    const revision = sessionRevision
    loading.value = true
    error.value = ''
    loadingPromise = (async () => {
      try {
        const [content, history] = await Promise.all([api.quizQuestionsV2(), api.quizAttemptsV2()])
        if (revision !== sessionRevision) return
        questions.value = content.questions
        rubricVersion.value = content.rubricVersion
        attempts.value = history
        if (!hasDraft.value) restoreDraft()
      } catch (err) {
        if (revision !== sessionRevision) return
        error.value = err.status === 401 ? 'Please sign in again to load your quiz.' : 'Could not load the quiz. Check that the backend is running, then retry.'
      } finally { if (revision === sessionRevision) { loading.value = false; loadingPromise = null } }
    })()
    return loadingPromise
  }

  function start() {
    restoring = true
    answers.value = Object.fromEntries(questions.value.map((q) => [q.id, null]))
    optionOrders.value = Object.fromEntries(questions.value.filter((q) => q.type === 'scenario').map((q) => {
      const ids = q.options.filter((o) => o.id !== 'e').map((o) => o.id)
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]
      }
      return [q.id, [...ids, 'e']]
    }))
    current.value = 0
    submissionId.value = crypto.randomUUID()
    hasDraft.value = true
    issues.value = []
    error.value = ''
    restoring = false
    saveDraft()
  }

  function optionsFor(question) {
    if (question.type !== 'scenario') return question.options
    const ids = optionOrders.value[question.id]
    return Array.isArray(ids) && ids.length === 5 && new Set(ids).size === 5 && ids.every((id) => question.options.some((o) => o.id === id))
      ? ids.map((id) => question.options.find((o) => o.id === id)) : question.options
  }

  function answer(optionId) {
    if (submitting.value) return
    const question = questions.value[current.value]
    if (!question) return
    if (answers.value[question.id] !== optionId) submissionId.value = crypto.randomUUID()
    answers.value[question.id] = optionId
    issues.value = []
    error.value = ''
  }

  function chooseAnswer(optionId) {
    const question = questions.value[current.value]
    if (submitting.value || !question?.options.some(option => option.id === optionId)) return
    answer(optionId)
    if (current.value < questions.value.length - 1) current.value++
  }

  async function submit() {
    if (submitting.value) return null
    const revision = sessionRevision
    submitting.value = true
    error.value = ''
    issues.value = []
    try {
      const attempt = await api.submitQuizV2({
        rubricVersion: rubricVersion.value, submissionId: submissionId.value,
        answers: questions.value.map((q) => ({ questionId: q.id, optionId: answers.value[q.id] ?? null })),
      })
      if (revision !== sessionRevision) return null
      attempts.value = [attempt, ...attempts.value.filter((a) => a.id !== attempt.id)].slice(0, 2)
      hasDraft.value = false
      try { sessionStorage.removeItem(draftKey()) } catch { /* No persisted draft. */ }
      return attempt
    } catch (err) {
      if (revision !== sessionRevision) return null
      issues.value = err.issues ?? []
      error.value = err.status === 422 ? 'Complete the highlighted sections, then try again.' : err.status === 409 ? 'This quiz version or submission has changed. Return to Track Finder and start a new attempt.' : err.status === 410 ? 'This result is no longer in your latest two attempts. Return to Track Finder to start again.' : 'Could not save your result. Your answers are kept in this tab; retry when the backend is available.'
      return null
    } finally { if (revision === sessionRevision) submitting.value = false }
  }

  return { questions, rubricVersion, answers, current, attempts, latest, answeredCount, sectionCoverage, hasDraft, loading, submitting, error, issues, initialize, start, answer, chooseAnswer, optionsFor, submit }
})
