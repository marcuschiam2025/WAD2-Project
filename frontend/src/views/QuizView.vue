<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@core/stores/quiz'
import { trackName } from '@core/data/catalogue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import TrackMatchRow from '@/components/TrackMatchRow.vue'
import chevronRight from '@/assets/v2/chevron-right.svg'

const router = useRouter()
const quiz = useQuizStore()

// Preview shown before the first attempt — a fixed sample profile, not the student's data
const sample = [
  { track: 'Business Analytics', pct: 85 },
  { track: 'Smart-City Management & Technology', pct: 70 },
  { track: 'Product Development', pct: 60 },
]

const questionCount = quiz.questions.length
const duration = '4 minutes'

// TODO(backend): attempts come from the quiz store; swap for GET /api/quiz/attempts
const top = computed(() => quiz.latest?.results[0])

function formatDate(d) {
  const date = new Date(d)
  const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

function startAttempt() {
  quiz.start()
  router.push('/quiz/attempt')
}
</script>

<template>
  <!-- Track Quiz — First Time -->
  <div v-if="!quiz.attempts.length">
    <PageHeader
      overline="Track Quiz"
      title="You haven't taken the Track Quiz yet"
      :subtitle="`Answer ${questionCount} short questions and we'll show you the IS tracks that best match your interests, strengths and completed modules.`"
    />

    <main class="flex flex-col gap-6 px-16 pt-8 pb-12">
      <section v-enter class="card flex items-center justify-between gap-4 p-6"> <!-- motion: fade + slide up on mount -->
        <div class="flex flex-col gap-2">
          <h2 class="text-h3">Get your first track matches in 4 minutes</h2>
          <p class="text-[14px] text-muted-foreground">
            No right answers. Choose what sounds most interesting and we rank the tracks that fit your profile.
          </p>
          <div class="flex gap-2 pt-2">
            <BaseButton @click="startAttempt">Attempt quiz</BaseButton>
            <BaseButton variant="ghost" disabled>View past attempts</BaseButton>
          </div>
        </div>
        <div class="flex gap-2">
          <StatusPill>{{ questionCount }} questions</StatusPill>
          <StatusPill>{{ duration }}</StatusPill>
        </div>
      </section>

      <h2 class="text-h4">What you'll see after you finish</h2>
      <section v-enter="0.08" class="card flex flex-col gap-2.5 p-6"> <!-- motion: sample results fade in, 80ms delay -->
        <div class="flex items-center justify-between leading-normal">
          <h3 class="text-[15px] font-semibold">Sample track matches</h3>
          <span class="text-[12px] text-muted-foreground">Based on a sample profile</span>
        </div>
        <TrackMatchRow v-for="(row, i) in sample" :key="row.track" :rank="i + 1" :track="row.track" :pct="row.pct" />
      </section>
    </main>
  </div>

  <!-- Track Quiz — Past Attempts -->
  <div v-else>
    <PageHeader
      overline="Track Quiz"
      title="Past attempts"
      subtitle="Review your previous results and start a new attempt whenever you want to refresh your track matches."
    />

    <main class="flex flex-col gap-6 px-16 pt-8 pb-12">
      <div class="flex items-start gap-4">
        <section v-enter class="card flex min-w-0 flex-1 flex-col gap-3 p-6"> <!-- motion: top match card fades in -->
          <h2 class="text-h4">Top match</h2>
          <TrackMatchRow :rank="1" :track="trackName(top.code)" :pct="top.pct" bar-width="w-[200px]" />
        </section>
        <section v-enter="0.05" class="card flex min-w-0 flex-1 flex-col gap-2 p-6"> <!-- motion: latest attempt card fades in, 50ms delay -->
          <h2 class="text-h4">Latest attempt</h2>
          <p class="text-[16px] font-medium">{{ formatDate(quiz.latest.takenAt) }}</p>
          <p class="text-[13px] text-muted-foreground">{{ questionCount }} questions completed · {{ duration }}</p>
          <div class="flex items-center justify-between rounded-md bg-muted px-3 py-2.5">
            <p class="text-[13px]">{{ trackName(top.code) }} is your top match</p>
            <BaseButton size="sm" variant="link" :to="`/quiz/results?attempt=${quiz.latest.id}`">Open</BaseButton>
          </div>
        </section>
      </div>

      <section v-enter="0.1" class="card flex flex-col gap-2.5 p-6"> <!-- motion: attempt history card fades in, 100ms delay -->
        <div class="flex items-center justify-between">
          <h2 class="text-h4">Attempt history</h2>
          <span class="text-[12px] text-muted-foreground">
            {{ quiz.attempts.length }} attempt{{ quiz.attempts.length === 1 ? '' : 's' }}
          </span>
        </div>
        <RouterLink
          v-for="a in quiz.attempts"
          :key="a.id"
          :to="`/quiz/results?attempt=${a.id}`"
          class="group flex items-center gap-6 rounded-md border border-border px-3.5 py-3 transition-colors hover:border-primary"
        >
          <div class="flex w-[220px] shrink-0 flex-col gap-0.5 leading-normal">
            <p class="text-[14px] font-medium">{{ formatDate(a.takenAt) }}</p>
            <p class="text-[12px] text-muted-foreground">{{ questionCount }} questions · {{ duration }}</p>
          </div>
          <p class="min-w-0 flex-1 text-[14px]">{{ trackName(a.results[0].code) }} · {{ a.results[0].pct }}% match</p>
          <StatusPill>Completed</StatusPill>
          <img :src="chevronRight" alt="" class="size-4 transition-transform group-hover:translate-x-0.5" />
        </RouterLink>
      </section>

      <section v-enter="0.15" class="card flex flex-col gap-2 p-6"> <!-- motion: new attempt CTA fades in, 150ms delay -->
        <h2 class="text-h4">Ready for a new attempt?</h2>
        <p class="text-[14px] text-muted-foreground">
          Start a fresh quiz and we re-run your track matches using your latest answers and completed modules.
        </p>
        <div class="flex gap-2 pt-2">
          <BaseButton @click="startAttempt">Start new attempt</BaseButton>
          <BaseButton variant="ghost" :to="`/quiz/results?attempt=${quiz.latest.id}`">View sample results</BaseButton>
        </div>
      </section>
    </main>
  </div>
</template>
