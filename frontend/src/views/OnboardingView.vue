<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@backend/stores/user'
import { tracks } from '@backend/data/catalogue'
import BaseButton from '@/components/ui/BaseButton.vue'
import SelectField from '@/components/ui/SelectField.vue'
import chevronUp from '@/assets/figma/chevron-up.svg'
import chevronDown from '@/assets/figma/chevron-down-muted.svg'
import checkWhite from '@/assets/figma/check-white-13.svg'

const router = useRouter()
const user = useUserStore()

// Step 2 of the 4-step flow (sign-in → academic profile → quiz → results)
const steps = ['MAJOR', 'TRACK', 'YEAR OF STUDY']
const step = ref(0)

const majors = ['Information Systems', 'Computer Science', 'Software Engineering', 'Computing & Law'].map((m) => ({
  value: m,
  label: m,
}))
const years = [1, 2, 3, 4].map((y) => ({ value: y, label: `Year ${y}` }))
const UNDECIDED = 'UNDECIDED'
const trackOptions = [...tracks.map((t) => ({ value: t.code, label: t.name })), { value: UNDECIDED, label: 'Undecided track' }]

const major = ref(user.profile.major)
const year = ref(user.profile.year)
const selectedTracks = ref([...user.profile.tracks])
const dropdownOpen = ref(true)

const trackSummary = computed(() => {
  if (!selectedTracks.value.length) return 'Select a track'
  return selectedTracks.value.map((c) => trackOptions.find((o) => o.value === c)?.label).join(', ')
})

// Undecided can't be combined with a named track
function toggleTrack(code) {
  if (code === UNDECIDED) {
    selectedTracks.value = selectedTracks.value.includes(UNDECIDED) ? [] : [UNDECIDED]
    return
  }
  const rest = selectedTracks.value.filter((c) => c !== UNDECIDED)
  selectedTracks.value = rest.includes(code) ? rest.filter((c) => c !== code) : [...rest, code]
}

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
</script>

<template>
  <main class="flex min-h-screen items-center justify-center p-4">
    <div class="flex w-[480px] flex-col gap-5 rounded-xl border border-border bg-card px-11 py-10 shadow-lg">
      <div class="flex gap-1.5">
        <span class="h-1 w-5 rounded-[2px] bg-primary" />
        <span class="h-1 w-7 rounded-[2px] bg-primary" />
        <span class="h-1 w-5 rounded-[2px] bg-border" />
        <span class="h-1 w-5 rounded-[2px] bg-border" />
      </div>

      <div class="flex flex-col gap-2 text-overline">
        <p class="text-muted-foreground">STEP 2 OF 4 · ACADEMIC PROFILE</p>
        <p class="text-primary">{{ step + 1 }} OF 3 · {{ steps[step] }}</p>
      </div>

      <template v-if="step === 0">
        <h1 class="text-h2">What's your major?</h1>
        <div class="flex flex-col gap-3">
          <SelectField v-model="major" label="Major" :options="majors" :chevron="chevronDown" />
          <p class="text-small text-muted-foreground">Choose the major you're currently studying.</p>
        </div>
      </template>

      <template v-else-if="step === 1">
        <h1 class="text-h2">What's your track?</h1>
        <div class="flex flex-col gap-2">
          <p class="text-small text-muted-foreground">Select one or more tracks, or choose Undecided.</p>
          <div class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">Track</span>
            <button
              type="button"
              class="flex h-10 items-center justify-between rounded-md border bg-card px-3 text-left text-[14px] text-muted-foreground"
              :class="dropdownOpen ? 'border-primary' : 'border-border'"
              :aria-expanded="dropdownOpen"
              @click="dropdownOpen = !dropdownOpen"
            >
              <span class="truncate">{{ trackSummary }}</span>
              <img :src="dropdownOpen ? chevronUp : chevronDown" alt="" class="size-4" />
            </button>
          </div>
          <div v-if="dropdownOpen" class="flex flex-col gap-1 rounded-md border border-border bg-card p-1 shadow-sm">
            <template v-for="(o, i) in trackOptions" :key="o.value">
              <div v-if="i === trackOptions.length - 1" class="h-px bg-border" />
              <button
                type="button"
                class="flex items-center gap-3 rounded-sm p-3 text-left text-[14px]"
                :class="selectedTracks.includes(o.value) ? 'bg-muted' : 'bg-card hover:bg-muted'"
                @click="toggleTrack(o.value)"
              >
                <span
                  class="flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border"
                  :class="selectedTracks.includes(o.value) ? 'border-primary bg-primary' : 'border-border bg-card'"
                >
                  <img v-if="selectedTracks.includes(o.value)" :src="checkWhite" alt="" class="size-[13px]" />
                </span>
                {{ o.label }}
              </button>
            </template>
          </div>
          <p class="text-small text-muted-foreground">
            Choosing Undecided clears any selected tracks. It can't be combined with a named track.
          </p>
        </div>
      </template>

      <template v-else>
        <h1 class="text-h2">What year are you in?</h1>
        <div class="flex flex-col gap-3">
          <SelectField v-model="year" label="Year of Study" :options="years" :chevron="chevronDown" />
          <p class="text-small text-muted-foreground">Choose your current year of study.</p>
        </div>
      </template>

      <div class="flex justify-end gap-2.5">
        <BaseButton variant="ghost" @click="back">Back</BaseButton>
        <BaseButton :disabled="!canContinue" @click="next">{{ step === steps.length - 1 ? 'Done' : 'Next step' }}</BaseButton>
      </div>
    </div>
  </main>
</template>
