<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore, quizTrackNames } from '@core/stores/quiz'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
const quiz = useQuizStore()
const router = useRouter()
onMounted(() => quiz.initialize())
function start() {
  if (quiz.hasDraft && !window.confirm('Replace your unfinished quiz with a new attempt?')) return
  quiz.start()
  router.push('/quiz/attempt')
}
</script>
<template>
  <div>
    <PageHeader class="quiz-header" overline="Track Finder" title="Find a direction worth exploring" subtitle="Explore your interests, current confidence, working style and career goals across four IS tracks." />
    <main class="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8 sm:px-12">
      <p v-if="quiz.loading" role="status">Loading your quiz…</p>
      <div v-if="quiz.error" role="alert" class="card p-5"><p>{{ quiz.error }}</p><BaseButton class="mt-3" variant="outline" @click="quiz.initialize">Retry loading</BaseButton></div>
      <section class="card flex flex-col gap-4 p-6">
        <h2 class="text-h3">20 questions. Four perspectives.</h2>
        <p class="text-sm text-muted-foreground">Designed for Year 1–2 Information Systems students. Allow about five minutes; we’re still checking this timing with students.</p>
        <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div v-for="label in ['Interests', 'Current confidence', 'Working style', 'Career goals']" :key="label" class="rounded-md bg-muted p-3">{{ label }}<span class="mt-1 block text-xs text-muted-foreground">5 questions</span></div></div>
        <p class="text-sm">In each section, answer at least three questions, including one scenario choice other than “None” or “Not sure”. You can skip questions. A rating of 3 means Unsure and supplies no scoring evidence.</p>
        <p class="text-sm text-muted-foreground">Retake whenever you like. Only your latest two completed results are kept; completing another attempt replaces the oldest. Your planner stays unchanged.</p>
        <div class="flex flex-wrap gap-3"><BaseButton :disabled="quiz.loading || !quiz.questions.length || !!quiz.error" @click="start">{{ quiz.attempts.length ? 'Start new attempt' : 'Start quiz' }}</BaseButton><BaseButton v-if="quiz.hasDraft" variant="outline" to="/quiz/attempt">Resume unfinished quiz</BaseButton></div>
      </section>
      <section v-if="quiz.attempts.length" class="card flex flex-col gap-3 p-6"><h2 class="text-h4">Latest results</h2>
        <RouterLink v-for="attempt in quiz.attempts" :key="attempt.id" :to="`/quiz/results?attempt=${attempt.id}`" class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4 hover:border-primary"><div><p class="font-medium">{{ new Date(attempt.createdAt).toLocaleString() }}</p><p class="text-sm text-muted-foreground">{{ attempt.rankingBasis === 'scenario-provisional' ? 'Provisional exploration' : attempt.rubricVersion === 'legacy-v1' ? 'Earlier quiz format' : 'Rating alignment' }} · {{ quizTrackNames[attempt.results[0]?.track] ?? 'Track results' }}</p></div><span class="text-sm text-primary">View results →</span></RouterLink>
      </section>
    </main>
  </div>
</template>

<style scoped>
.quiz-header { padding-inline: clamp(1.25rem, 5vw, 3rem); }
</style>
