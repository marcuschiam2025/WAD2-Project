<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore, quizTrackNames } from '@core/stores/quiz'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
const explorers = Object.values(import.meta.glob('@/assets/exploring/*.png', { eager: true, import: 'default' }))
// One explorer, picked at random each time the page loads.
const swingers = Object.values(import.meta.glob('@/assets/swinging/*.png', { eager: true, import: 'default' }))
const swinger = swingers[Math.floor(Math.random() * swingers.length)]
const explorer = explorers[Math.floor(Math.random() * explorers.length)]
const quiz = useQuizStore()
const router = useRouter()
onMounted(() => quiz.initialize())
function alignmentLabel(attempt) {
  if (attempt.rankingBasis === 'scenario-provisional') return 'Provisional exploration'
  if (attempt.rubricVersion === 'legacy-v1') return 'Earlier quiz format'
  const score = attempt.results[0]?.alignmentIndex
  if (attempt.rankingBasis === 'blended' && Number.isFinite(score)) return `${Math.round(score)}/100 match`
  return Number.isFinite(score) ? `${Math.round(score)}% alignment` : 'Alignment unavailable'
}
function start() {
  if (quiz.hasDraft && !window.confirm('Replace your unfinished quiz with a new attempt?')) return
  quiz.start()
  router.push('/quiz/attempt')
}
</script>
<template>
  <div class="relative">
    <PageHeader class="quiz-header" overline="Track Finder" title="Find a direction worth exploring" subtitle="Explore your interests, current confidence, working style and career goals across four IS tracks." />
    <div class="relative">
    <!-- Decorative explorer, drawn over the empty strip left of the content, so nothing moves. It is as wide as that
         strip (page width minus the 1024px content column, halved) and only shows where the strip is wide enough. -->
    <img :src="explorer" alt="" aria-hidden="true" class="explorer pointer-events-none absolute hidden h-auto min-[1280px]:block" />
    <main class="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8 sm:px-12">
      <p v-if="quiz.loading" role="status">Loading your quiz…</p>
      <div v-if="quiz.error" role="alert" class="card p-5"><p>{{ quiz.error }}</p><BaseButton class="mt-3" variant="outline" @click="quiz.initialize">Retry loading</BaseButton></div>
      <section class="card flex flex-col gap-4 p-6">
        <h2 class="text-h3">20 questions. Four perspectives.</h2>
        <p class="text-sm text-muted-foreground">Designed for Year 1–2 Information Systems students. Allow about five minutes; we’re still checking this timing with students.</p>
        <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div v-for="label in ['Interests', 'Current confidence', 'Working style', 'Career goals']" :key="label" class="rounded-md bg-muted p-3">{{ label }}<span class="mt-1 block text-xs text-muted-foreground">5 questions</span></div></div>
        <p class="text-sm">Answer every question.</p>
        <p class="text-sm text-muted-foreground">Retake whenever you like. Only your latest two completed results are kept; completing another attempt replaces the oldest. Your planner stays unchanged.</p>
        <div class="flex flex-wrap gap-3"><BaseButton :disabled="quiz.loading || !quiz.questions.length || !!quiz.error" @click="start">{{ quiz.attempts.length ? 'Start new attempt' : 'Start quiz' }}</BaseButton><BaseButton v-if="quiz.hasDraft" variant="outline" to="/quiz/attempt">Resume unfinished quiz</BaseButton></div>
      </section>
      <section v-if="quiz.attempts.length" class="card flex flex-col gap-3 p-6"><h2 class="text-h4">Latest results</h2>
        <RouterLink v-for="attempt in quiz.attempts" :key="attempt.id" :to="`/quiz/results?attempt=${attempt.id}`" class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4 hover:border-primary"><div><p class="font-medium">{{ new Date(attempt.createdAt).toLocaleString() }}</p><p class="text-sm text-muted-foreground">{{ alignmentLabel(attempt) }} · {{ quizTrackNames[attempt.results[0]?.track] ?? 'Track results' }}</p></div><span class="text-sm text-primary">View results →</span></RouterLink>
      </section>
    </main>
    </div>
    <!-- Decorative swinger, hung from just under the nav bar, staying in view as the page scrolls, in the empty strip right of the content. Same rules as the
         explorer: drawn over the strip so nothing moves, sized in vw (see the style block), only where the window is wide enough for the strip. -->
    <img :src="swinger" alt="" aria-hidden="true" class="swinger pointer-events-none fixed hidden h-auto min-[1280px]:block" />
  </div>
</template>

<style scoped>
/* Both pictures are sized and placed in vw, so they take the same share of the window on every screen. Measured on a
   1914px-wide window: the explorer is 16.7vw wide, the swinger 12.5vw. The swinger hangs just under the 64px nav bar. */
.explorer { width: 16.7vw; left: 0.85vw; top: 12.5vw; }
.swinger { width: 12.5vw; right: 0.85vw; top: 65px; }
.quiz-header { padding-inline: clamp(1.25rem, 5vw, 3rem); }
</style>
