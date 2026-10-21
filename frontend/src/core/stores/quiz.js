import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { questions, scoreAnswers } from '../data/quiz'

export const useQuizStore = defineStore('quiz', () => {
  // Answers for the attempt in progress: index of the chosen option per question
  const answers = ref(Array(questions.length).fill(null))
  const current = ref(0)
  // Completed attempts, newest first: { id, takenAt, results: [{ code, pct }] }
  const attempts = ref([])

  const latest = computed(() => attempts.value[0] ?? null)
  const answeredCount = computed(() => answers.value.filter((a) => a !== null).length)

  function start() {
    answers.value = Array(questions.length).fill(null)
    current.value = 0
  }

  function answer(optionIndex) {
    answers.value[current.value] = optionIndex
  }

  // TODO(Backend 1): POST /api/quiz/attempts and use the server's scores
  function submit() {
    const attempt = {
      id: Date.now(),
      takenAt: new Date(),
      answers: [...answers.value],
      results: scoreAnswers(answers.value),
    }
    attempts.value.unshift(attempt)
    return attempt
  }

  return { questions, answers, current, attempts, latest, answeredCount, start, answer, submit }
})

// Dev only: lets Vite swap this store's code in when the file is edited, instead of keeping the old store
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useQuizStore, import.meta.hot))
