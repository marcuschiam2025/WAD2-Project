<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@backend/stores/quiz'
import { trackName } from '@backend/data/catalogue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TrackMatchRow from '@/components/TrackMatchRow.vue'

const router = useRouter()
const quiz = useQuizStore()

const sample = [
  { track: 'Business Analytics', pct: 85 },
  { track: 'Smart-City Management & Technology', pct: 70 },
  { track: 'Product Development', pct: 60 },
]

const top = computed(() => quiz.latest?.results[0])
const questionCount = quiz.questions.length

function formatDate(d) {
  return new Date(d).toLocaleString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).replace(',', ' ·')
}

function startAttempt() {
  quiz.start()
  router.push('/quiz/attempt')
}
</script>

<template>
  <!-- First time -->
  <main v-if="!quiz.attempts.length" class="flex flex-col gap-6 p-16">
    <header class="flex flex-col gap-3">
      <p class="text-overline text-muted-foreground">TRACK QUIZ</p>
      <h1 class="text-h2">You haven’t taken the Track Quiz yet</h1>
      <p class="text-body text-muted-foreground">
        Answer {{ questionCount }} short questions and we’ll show you the IS tracks that best match your interests,
        strengths and completed modules.
      </p>
    </header>

    <section class="card flex flex-col gap-5 p-6">
      <div class="flex items-center justify-between gap-6">
        <div class="flex flex-col gap-2">
          <h2 class="text-h3">Get your first track matches in 4 minutes</h2>
          <p class="text-body text-muted-foreground">
            No right answers — just choose what sounds most interesting to you. We’ll use your answers to rank the
            tracks that fit your profile best.
          </p>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-2">
          <span class="rounded-full bg-secondary px-2.5 py-1.5 text-overline text-muted-foreground">{{ questionCount }} questions</span>
          <span class="rounded-full bg-secondary px-2.5 py-1.5 text-overline text-muted-foreground">4 minutes</span>
        </div>
      </div>
      <div><BaseButton @click="startAttempt">Attempt quiz</BaseButton></div>
    </section>

    <section class="flex flex-col gap-4">
      <h2 class="text-h4">What you’ll see after you finish</h2>
      <div class="card flex flex-col gap-4 p-5">
        <div class="flex items-center justify-between">
          <h3 class="text-h4">Sample track matches</h3>
          <span class="text-small text-muted-foreground">Based on a sample profile</span>
        </div>
        <div class="flex flex-col gap-3">
          <TrackMatchRow v-for="(row, i) in sample" :key="row.track" :rank="i + 1" :track="row.track" :pct="row.pct" />
        </div>
      </div>
    </section>
  </main>

  <!-- Past attempts -->
  <main v-else class="flex flex-col gap-5 px-16 py-5">
    <header class="flex flex-col gap-3">
      <p class="text-overline text-muted-foreground">TRACK QUIZ</p>
      <h1 class="text-h2">Past attempts</h1>
      <p class="text-body text-muted-foreground">
        Review your previous quiz results and start a new attempt whenever you want to refresh your track matches.
      </p>
    </header>

    <div class="flex items-start gap-6">
      <section class="card flex flex-1 flex-col gap-3 p-5">
        <h2 class="text-h4">Top match</h2>
        <TrackMatchRow :rank="1" :track="trackName(top.code)" :pct="top.pct" />
      </section>
      <section class="card flex flex-1 flex-col gap-3 p-5">
        <h2 class="text-h4">Latest attempt</h2>
        <div class="flex flex-col gap-1">
          <p class="text-body">{{ formatDate(quiz.latest.takenAt) }}</p>
          <p class="text-small text-muted-foreground">{{ questionCount }} questions completed · 4 minutes</p>
        </div>
        <div class="flex items-center gap-2 rounded-md bg-secondary px-3 py-2.5 text-[13px]">
          <p class="flex-1">{{ trackName(top.code) }} is your top match</p>
          <RouterLink :to="`/quiz/results?attempt=${quiz.latest.id}`" class="text-primary hover:underline">Open</RouterLink>
        </div>
      </section>
    </div>

    <section class="card flex flex-col gap-4 p-5">
      <div class="flex items-center justify-between">
        <h2 class="text-h4">Attempt history</h2>
        <span class="text-small text-muted-foreground">{{ quiz.attempts.length }} attempt{{ quiz.attempts.length === 1 ? '' : 's' }}</span>
      </div>
      <div class="flex flex-col gap-3">
        <RouterLink
          v-for="a in quiz.attempts"
          :key="a.id"
          :to="`/quiz/results?attempt=${a.id}`"
          class="flex items-center gap-4 rounded-md border border-border bg-card px-4 py-3.5 hover:border-primary"
        >
          <div class="flex w-[180px] shrink-0 flex-col gap-0.5">
            <p class="text-body">{{ formatDate(a.takenAt) }}</p>
            <p class="text-small text-muted-foreground">{{ questionCount }} questions · 4 minutes</p>
          </div>
          <p class="flex-1 text-body">{{ trackName(a.results[0].code) }} · {{ a.results[0].pct }}% match</p>
          <span class="rounded-full bg-secondary px-2.5 py-1.5 text-overline text-muted-foreground">Completed</span>
        </RouterLink>
      </div>
    </section>

    <section class="card flex flex-col gap-4 p-5">
      <div class="flex flex-col gap-2">
        <h2 class="text-h4">Ready for a new attempt?</h2>
        <p class="text-body text-muted-foreground">
          Start a fresh quiz and we’ll re-run your track matches using your latest answers and completed modules.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <BaseButton @click="startAttempt">Start new attempt</BaseButton>
        <BaseButton variant="ghost" :to="`/quiz/results?attempt=${quiz.latest.id}`">View latest results</BaseButton>
      </div>
    </section>
  </main>
</template>
