<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { animate } from 'motion'
import { useUserStore } from '@core/stores/user'
import { tracks } from '@core/data/catalogue'
import { ease } from '@/motion'
import BaseButton from '@/components/ui/BaseButton.vue'
import SelectMenu from '@/components/ui/SelectMenu.vue'
import iconBack from '@/assets/v2/back.svg'

const router = useRouter()
const user = useUserStore()

// TODO(backend): replace with GET /api/programmes (all SMU programmes, searchable)
const majors = [
  'Information Systems',
  'Computer Science',
  'Software Engineering',
  'Computing & Law',
].map((m) => ({ value: m, label: `BSc ${m}` }))

const UNDECIDED = 'UNDECIDED'
// TODO(backend): tracks come from @core/data/catalogue — swap for GET /api/tracks?major=…
const trackOptions = [
  ...tracks.map((t) => ({ value: t.code, label: t.name })),
  { value: UNDECIDED, label: 'Undecided', exclusive: true },
]
const yearOptions = [1, 2, 3, 4].map((y) => ({ value: y, label: `Year ${y}` }))

const steps = [
  { label: 'Major', title: "What's your major?", body: 'We load the degree requirements for your programme.' },
  { label: 'Track', title: "What's your track?", body: 'Pick one or more. You can change this later in the planner.' },
  { label: 'Year of study', title: 'Which year are you in?', body: 'We lock past semesters in your roadmap and mark them as done.' },
]
const step = ref(0)

const major = ref(user.profile.major)
const selectedTracks = ref([...user.profile.tracks])
const year = ref(user.profile.year)

const canContinue = computed(() => step.value !== 1 || selectedTracks.value.length > 0)

function back() {
  if (step.value === 0) router.push('/')
  else step.value--
}

function next() {
  if (step.value < steps.length - 1) {
    step.value++
    return
  }
  user.completeOnboarding({
    major: major.value,
    tracks: selectedTracks.value.filter((c) => c !== UNDECIDED),
    year: year.value,
  })
  router.push('/quiz/attempt')
}

// Slide the question in from the direction of travel
const direction = ref(1)
function go(fn) {
  const before = step.value
  fn()
  direction.value = step.value >= before ? 1 : -1
}
function onEnter(el, done) {
  animate(el, { opacity: [0, 1], x: [24 * direction.value, 0] }, { duration: 0.28, ease }).then(done)
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="flex items-center gap-4 bg-card px-8 py-5">
      <button
        type="button"
        aria-label="Back"
        class="rounded-md border border-border bg-card p-2 hover:bg-muted"
        @click="go(back)"
      >
        <img :src="iconBack" alt="" class="size-4" />
      </button>
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex gap-1">
          <span v-for="(s, i) in steps" :key="s.label" class="relative h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              class="absolute inset-0 origin-left rounded-full bg-primary transition-transform duration-500"
              :class="i <= step ? 'scale-x-100' : 'scale-x-0'"
            />
          </span>
        </div>
        <p class="text-overline text-muted-foreground">Step {{ step + 1 }} of {{ steps.length }} · {{ steps[step].label }}</p>
      </div>
    </header>

    <main class="flex flex-1 flex-col items-center overflow-hidden pt-24">
      <Transition mode="out-in" :css="false" @enter="onEnter">
        <div :key="step" class="flex flex-col items-center gap-2">
          <h1 class="text-center text-[30px] leading-normal font-bold tracking-[-0.3px]">{{ steps[step].title }}</h1>
          <p class="text-center text-[15px] text-muted-foreground">{{ steps[step].body }}</p>

          <div class="flex w-[380px] flex-col gap-1.5 pt-4">
            <template v-if="step === 0">
              <SelectMenu v-model="major" :options="majors" searchable placeholder="Search programmes" />
              <p class="text-[12px] text-muted-foreground">Type to search all SMU programmes.</p>
            </template>
            <template v-else-if="step === 1">
              <SelectMenu v-model="selectedTracks" :options="trackOptions" multiple placeholder="Select a track" />
              <p class="text-[12px] text-muted-foreground">Choosing Undecided clears any selected track.</p>
            </template>
            <SelectMenu v-else v-model="year" :options="yearOptions" />
          </div>
        </div>
      </Transition>
    </main>

    <footer class="flex items-center justify-between border-t border-border bg-card px-8 py-4">
      <BaseButton variant="ghost" @click="go(next)">Skip for now</BaseButton>
      <BaseButton :disabled="!canContinue" @click="go(next)">Continue</BaseButton>
    </footer>
  </div>
</template>
