<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore, sectionLabels } from '@core/stores/quiz'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
const quiz = useQuizStore()
const router = useRouter()
const questionHeading = ref(null)
watch(() => quiz.current, async () => {
  await nextTick()
  questionHeading.value?.focus()
})
function choose(optionId) { quiz.chooseAnswer(optionId) }
const question = computed(() => quiz.questions[quiz.current])
const options = computed(() => question.value ? quiz.optionsFor(question.value) : [])
const selected = computed(() => question.value ? quiz.answers[question.value.id] : null)
const last = computed(() => quiz.current === quiz.questions.length - 1)
const sectionNumber = computed(() => Object.keys(sectionLabels).indexOf(question.value?.section) + 1)
const intros = { interests: 'Choose what you would like to explore. No specialised knowledge is needed.', strengths: 'Think about school, hobbies or everyday situations. This is current confidence; skills can develop.', 'working-style': 'Think about the activities and decisions you prefer when working with others.', 'career-goals': 'You do not need a fixed career plan. Choose activities you would like a chance to explore.' }
function jump(section) { quiz.current = quiz.questions.findIndex((q) => q.section === section) }
async function next() {
  if (quiz.submitting) return
  if (!last.value) { quiz.current++; return }
  const attempt = await quiz.submit()
  if (attempt) router.push(`/quiz/results?attempt=${attempt.id}`)
}
function skip() { quiz.answer(null); next() }
function back() { if (quiz.current) quiz.current--; else router.push('/quiz') }
function onKey(event) {
  if (!question.value || quiz.submitting || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return
  const index = Number(event.key) - 1
  if (Number.isInteger(index) && index >= 0 && index < options.value.length) { event.preventDefault(); choose(options.value[index].id) }
  else if (event.key === 'Enter' && !['BUTTON', 'A'].includes(event.target?.tagName)) { event.preventDefault(); next() }
}
onMounted(async () => { await quiz.initialize(); if (quiz.questions.length && !quiz.hasDraft) quiz.start(); window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>
<template>
  <div>
    <PageHeader class="quiz-header" overline="Track Finder" title="What feels like you?" subtitle="Choose honestly. There are no right answers, and your confidence can grow." />
    <main class="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-8 sm:px-12">
      <p v-if="quiz.loading" role="status">Loading questions…</p>
      <div v-if="quiz.error" role="alert" class="rounded-md border border-destructive p-4"><p>{{ quiz.error }}</p><div class="mt-3 flex flex-wrap gap-2"><BaseButton v-if="!quiz.questions.length" variant="outline" @click="quiz.initialize">Retry loading</BaseButton><BaseButton v-for="section in [...new Set(quiz.issues.map((issue) => issue.section).filter(Boolean))]" :key="section" variant="outline" @click="jump(section)">Review {{ sectionLabels[section] }}</BaseButton><BaseButton variant="ghost" to="/quiz">Back to Track Finder</BaseButton></div></div>
      <section v-if="question && !quiz.loading" class="card flex flex-col gap-5 p-5 sm:p-7" :aria-busy="quiz.submitting">
        <div class="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>Section {{ sectionNumber }} of 4 · {{ sectionLabels[question.section] }}</span><span>{{ quiz.answeredCount }} / 20 answered</span></div>
        <progress :value="quiz.current + 1" :max="quiz.questions.length" class="h-2 w-full accent-primary" aria-label="Question position" />
        <p class="text-sm text-muted-foreground">{{ intros[question.section] }}</p>
        <fieldset :key="question.id" :disabled="quiz.submitting" class="flex min-w-0 flex-col gap-4"><legend ref="questionHeading" tabindex="-1" class="mb-4 w-full text-xl font-semibold leading-7"><span class="mb-2 block text-xs font-normal text-muted-foreground">Question {{ quiz.current + 1 }} of {{ quiz.questions.length }} · {{ question.type === 'rating' ? 'Rate individually from 1 to 5' : 'Choose one scenario' }}</span>{{ question.prompt }}</legend>
          <label v-for="(option, index) in options" :key="`${question.id}:${option.id}`" class="flex cursor-pointer items-start gap-3 rounded-md border p-3.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-primary" :class="selected === option.id ? 'border-primary bg-primary/8' : 'border-border hover:bg-muted'"><input type="radio" :name="question.id" :value="option.id" :checked="selected === option.id" class="mt-0.5 accent-primary" @click="choose(option.id)" /><span class="min-w-0 flex-1">{{ option.label }}</span><span class="font-mono text-xs text-muted-foreground">{{ question.type === 'rating' ? option.id : String.fromCharCode(65 + index) }}</span></label>
        </fieldset>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><BaseButton variant="ghost" :disabled="quiz.submitting" @click="back">Back</BaseButton><div class="flex gap-2"><BaseButton variant="ghost" :disabled="quiz.submitting" @click="skip">Skip</BaseButton><BaseButton v-if="last" :disabled="quiz.submitting" @click="next">{{ quiz.submitting ? 'Saving…' : last ? 'See my results' : 'Next' }}</BaseButton></div></div>
        <p class="text-xs text-muted-foreground">Selecting an answer moves to the next question. Use Back to change it. {{ question.type === 'rating' ? '3 means Unsure: it counts as answered but adds no scoring evidence.' : 'None or Not sure adds no evidence and does not count as answered.' }} Your draft stays in this browser tab after a reload.</p>
      </section>
      <div v-if="question" class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4" aria-label="Section completion"><button v-for="section in quiz.sectionCoverage" :key="section.section" class="rounded-md border p-3 text-left hover:border-primary" :class="quiz.issues.some((issue) => issue.section === section.section) ? 'border-destructive' : 'border-border'" :disabled="quiz.submitting" @click="jump(section.section)"><span class="block font-medium">{{ section.label }}</span><span class="text-muted-foreground">{{ section.answered }}/5 answered · {{ section.scenarios ? 'scenario ✓' : 'needs scenario' }}</span></button></div>
    </main>
  </div>
</template>

<style scoped>
.quiz-header { padding-inline: clamp(1.25rem, 5vw, 3rem); }
</style>
