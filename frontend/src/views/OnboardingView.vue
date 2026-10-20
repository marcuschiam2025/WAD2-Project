<script setup>
// Onboarding form: course, tracks, current semester, modules already taken (dragged into their semester), e-credits.
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@core/stores/user'
import { tracks, modules } from '@core/data/catalogue'
import { SEM_IDS } from '@core/data/degree'
import BaseButton from '@/components/ui/BaseButton.vue'
import SelectMenu from '@/components/ui/SelectMenu.vue'
import ModuleSearchBox from '@/components/ModuleSearchBox.vue'
import iconBack from '@/assets/v2/back.svg'
import iconRemove from '@/assets/figma/icon-remove.svg'
import iconGrip from '@/assets/figma/icon-grip.svg'

const router = useRouter()
const user = useUserStore()

const MAX_TRACKS = 2
// TODO(backend): programmes come from GET /api/programmes. Only Information Systems is open for now.
const programmes = [{ value: 'Information Systems', label: 'BSc Information Systems' }]

const major = ref(programmes[0].value)
const selectedTracks = ref([])
const undecided = ref(false) // wants to take the track quiz instead of picking now
const currentSem = ref(null)
const eCredits = ref('')

function toggleTrack(code) {
  undecided.value = false
  if (selectedTracks.value.includes(code)) selectedTracks.value = selectedTracks.value.filter((c) => c !== code)
  else if (selectedTracks.value.length < MAX_TRACKS) selectedTracks.value = [...selectedTracks.value, code]
}

function toggleUndecided() {
  undecided.value = !undecided.value
  if (undecided.value) selectedTracks.value = []
}

// Modules already taken: search adds them to the basket, then drag each into the semester it was taken in.
// Only semesters before the current one are open, because those are the ones that are done.
const basket = ref([])
const placed = ref(Object.fromEntries(SEM_IDS.map((id) => [id, []])))
const dragging = ref(null)
const dragOver = ref(null)

const doneSems = computed(() => (currentSem.value ? SEM_IDS.slice(0, SEM_IDS.indexOf(currentSem.value)) : []))
const placedCodes = computed(() => Object.values(placed.value).flat())
const allCodes = computed(() => [...basket.value, ...placedCodes.value])
const emptySems = computed(() => doneSems.value.filter((id) => !placed.value[id].length))

function unplace(code) {
  SEM_IDS.forEach((id) => (placed.value[id] = placed.value[id].filter((c) => c !== code)))
  basket.value = basket.value.filter((c) => c !== code)
}

function backToBasket(code) {
  unplace(code)
  basket.value = [...basket.value, code]
}

function addModule(m) {
  if (!allCodes.value.includes(m.code)) basket.value = [...basket.value, m.code]
}

// semId = null drops it back into the basket
function drop(semId) {
  const code = dragging.value
  dragging.value = dragOver.value = null
  if (!code) return
  unplace(code)
  if (semId) placed.value[semId] = [...placed.value[semId], code]
  else basket.value = [...basket.value, code]
}

// A semester that is no longer "done" gives its modules back to the basket
watch(currentSem, () => {
  SEM_IDS.filter((id) => !doneSems.value.includes(id)).forEach((id) => {
    basket.value = [...basket.value, ...placed.value[id]]
    placed.value[id] = []
  })
  if (!doneSems.value.length) basket.value = []
})

const eValue = computed(() => Number(eCredits.value))
const eValid = computed(() => eCredits.value !== '' && Number.isInteger(eValue.value) && eValue.value >= 0)

// Every section is required. Tracks can be "undecided", which sends you to the quiz.
const sections = [
  { label: 'course', done: () => !!major.value },
  { label: 'tracks', done: () => selectedTracks.value.length > 0 || undecided.value },
  { label: 'semester', done: () => !!currentSem.value },
  // every done semester needs at least one module, and nothing may be left in the basket
  { label: 'modules', done: () => !!currentSem.value && !basket.value.length && !emptySems.value.length },
  { label: 'e-credits', done: () => eValid.value },
]
const sectionDone = computed(() => sections.map((s) => s.done()))
const missing = computed(() => {
  const left = sections.filter((_, i) => !sectionDone.value[i]).map((s) => s.label)
  return left.length ? `Still to do: ${left.join(', ')}.` : ''
})

function submit() {
  if (missing.value) return
  user.completeOnboarding({
    major: major.value,
    tracks: selectedTracks.value,
    currentSem: currentSem.value,
    takenBySem: Object.fromEntries(doneSems.value.filter((id) => placed.value[id].length).map((id) => [id, placed.value[id]])),
    balance: eValue.value,
  })
  router.push(undecided.value ? '/quiz/attempt' : '/dashboard')
}

// Section number badge: turns into a green tick once that section is complete
const badge = (n) => [
  'flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-bold transition-colors',
  sectionDone.value[n - 1] ? 'bg-success-tint text-success' : 'bg-primary-tint text-primary',
]
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="flex items-center gap-4 bg-card px-8 py-5">
      <button type="button" aria-label="Back" class="rounded-md border border-border bg-card p-2 hover:bg-muted" @click="router.push('/')">
        <img :src="iconBack" alt="" class="size-4" />
      </button>
      <p class="text-overline text-muted-foreground">Set up your profile</p>
    </header>

    <main class="flex flex-1 justify-center px-8 pt-12 pb-16">
      <form class="flex w-[720px] max-w-full flex-col gap-6" @submit.prevent="submit">
        <div class="flex flex-col gap-1.5">
          <h1 class="text-[30px] leading-normal font-bold tracking-[-0.3px]">Tell us about your degree</h1>
          <p class="text-[15px] text-muted-foreground">
            We use this to build your roadmap, check prerequisites and work out how much you can bid.
          </p>
        </div>

        <div v-stagger class="card flex flex-col divide-y divide-border"> <!-- motion: the form sections stagger in -->
          <!-- 1. Course -->
          <section class="flex flex-col gap-3 p-6">
            <div class="flex items-center gap-3">
              <span :class="badge(1)">{{ sectionDone[0] ? '✓' : 1 }}</span>
              <h2 class="text-h4">Which course are you in?</h2>
            </div>
            <SelectMenu v-model="major" :options="programmes" />
            <p class="text-[12px] text-muted-foreground">Only Information Systems is available for now.</p>
          </section>

          <!-- 2. Tracks -->
          <section class="flex flex-col gap-3 p-6">
            <div class="flex items-center gap-3">
              <span :class="badge(2)">{{ sectionDone[1] ? '✓' : 2 }}</span>
              <h2 class="text-h4">Which tracks are you taking?</h2>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="t in tracks"
                :key="t.code"
                type="button"
                role="checkbox"
                :aria-checked="selectedTracks.includes(t.code)"
                :disabled="!selectedTracks.includes(t.code) && selectedTracks.length >= MAX_TRACKS"
                class="flex flex-col gap-1 rounded-lg border px-3.5 py-3 text-left leading-normal transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                :class="selectedTracks.includes(t.code) ? 'border-primary bg-primary-tint' : 'border-border hover:bg-muted'"
                @click="toggleTrack(t.code)"
              >
                <span class="text-[14px] font-semibold">{{ t.name }}</span>
                <span class="text-[12px] text-muted-foreground">{{ t.blurb }}</span>
              </button>
            </div>
            <button
              type="button"
              role="checkbox"
              :aria-checked="undecided"
              class="flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors"
              :class="undecided ? 'border-primary bg-primary-tint' : 'border-dashed border-border hover:bg-muted'"
              @click="toggleUndecided"
            >
              <span class="flex flex-col gap-0.5 leading-normal">
                <span class="text-[14px] font-semibold">I'm undecided. I want to take the quiz</span>
                <span class="text-[12px] text-muted-foreground">
                  {{ undecided ? "Great, you'll start the track quiz as soon as you finish this form." : 'We will match you to a track from a short quiz after this form.' }}
                </span>
              </span>
              <span v-if="undecided" class="shrink-0 text-[13px] font-semibold text-primary">Selected</span>
            </button>
            <p class="text-[12px] text-muted-foreground">Required. Pick up to {{ MAX_TRACKS }} tracks, or choose the quiz if you haven't decided.</p>
          </section>

          <!-- 3. Current semester -->
          <section class="flex flex-col gap-3 p-6">
            <div class="flex items-center gap-3">
              <span :class="badge(3)">{{ sectionDone[2] ? '✓' : 3 }}</span>
              <h2 class="text-h4">Which semester are you in now?</h2>
            </div>
            <div class="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Current semester">
              <button
                v-for="id in SEM_IDS"
                :key="id"
                type="button"
                role="radio"
                :aria-checked="currentSem === id"
                class="flex flex-col items-center gap-0.5 rounded-md border px-3 py-2 leading-normal transition-colors"
                :class="currentSem === id ? 'border-primary bg-primary-tint text-primary' : 'border-border hover:bg-muted'"
                @click="currentSem = id"
              >
                <span class="font-mono text-[14px] font-bold">{{ id }}</span>
                <span class="text-[11px] text-muted-foreground">{{ id === 'Y1S1' ? 'Freshman' : `Year ${id[1]} · Sem ${id[3]}` }}</span>
              </button>
            </div>
            <p class="text-[12px] text-muted-foreground">Y2S1 means Year 2, semester 1. Every semester before this one is marked as done in your roadmap.</p>
          </section>

          <!-- 4. Modules already taken -->
          <section class="flex flex-col gap-3 p-6">
            <div class="flex items-center gap-3">
              <span :class="badge(4)">{{ sectionDone[3] ? '✓' : 4 }}</span>
              <h2 class="text-h4">Which modules have you already taken?</h2>
            </div>

            <p v-if="!currentSem" class="text-[13px] text-muted-foreground">Choose your semester above first.</p>
            <p v-else-if="!doneSems.length" class="rounded-md bg-secondary px-3.5 py-3 text-[13px] leading-normal">
              You're in your first semester, so you haven't taken any modules yet. Nothing to add here.
            </p>
            <template v-else>
              <ModuleSearchBox :exclude="allCodes" @pick="addModule" />

              <!-- Basket: search results land here, then drag each one into its semester -->
              <div
                class="flex min-h-[64px] flex-col gap-2 rounded-lg border border-dashed border-border p-3"
                @dragover.prevent
                @drop.prevent="drop(null)"
              >
                <p class="text-overline text-muted-foreground">To place · {{ basket.length }}</p>
                <div v-if="basket.length" class="flex flex-wrap gap-2">
                  <div
                    v-for="code in basket"
                    :key="code"
                    draggable="true"
                    class="flex cursor-grab items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px] active:cursor-grabbing"
                    :class="dragging === code && 'opacity-40'"
                    @dragstart="dragging = code"
                    @dragend="dragging = dragOver = null"
                  >
                    <img :src="iconGrip" alt="" class="size-3" />
                    <span class="font-mono font-bold">{{ code }}</span>
                    <span class="max-w-[160px] truncate text-muted-foreground">{{ modules[code].name }}</span>
                    <button type="button" :aria-label="`Remove ${code}`" @click="unplace(code)">
                      <img :src="iconRemove" alt="" class="size-3" />
                    </button>
                  </div>
                </div>
                <p v-else class="text-[13px] text-muted-foreground">Search above, then drag each module into the semester you took it.</p>
              </div>

              <!-- Done semesters: drop modules here -->
              <div class="grid grid-cols-4 gap-2.5">
                <div
                  v-for="id in doneSems"
                  :key="id"
                  class="flex min-h-[112px] flex-col gap-1.5 rounded-lg border p-2 transition-colors"
                  :class="dragOver === id ? 'border-primary bg-primary-tint' : 'border-border bg-muted'"
                  @dragover.prevent="dragOver = id"
                  @dragleave="dragOver = null"
                  @drop.prevent="drop(id)"
                >
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-[12px] font-bold">{{ id }}</span>
                    <span class="text-[11px] text-muted-foreground">Done</span>
                  </div>
                  <div
                    v-for="code in placed[id]"
                    :key="code"
                    draggable="true"
                    class="group relative flex cursor-grab flex-col rounded-sm bg-card px-2 py-1.5 leading-normal active:cursor-grabbing"
                    :class="dragging === code && 'opacity-40'"
                    @dragstart="dragging = code"
                    @dragend="dragging = dragOver = null"
                  >
                    <span class="font-mono text-[12px] font-bold">{{ code }}</span>
                    <span class="line-clamp-2 text-[11px] text-muted-foreground">{{ modules[code].name }}</span>
                    <button
                      type="button"
                      :aria-label="`Move ${code} back to the basket`"
                      class="absolute top-1 right-1.5 hidden text-[11px] text-muted-foreground group-hover:block hover:text-foreground"
                      @click="backToBasket(code)"
                    >✕</button>
                  </div>
                  <p v-if="!placed[id].length" class="m-auto text-center text-[11px] font-medium text-destructive">Needs a module</p>
                </div>
              </div>
              <p v-if="basket.length" class="text-[12px] font-medium text-destructive">
                {{ basket.length }} module{{ basket.length === 1 ? '' : 's' }} still need{{ basket.length === 1 ? 's' : '' }} a semester. Drag {{ basket.length === 1 ? 'it' : 'them' }} into the semester you took {{ basket.length === 1 ? 'it' : 'them' }}.
              </p>
              <p v-else-if="emptySems.length" class="text-[12px] font-medium text-destructive">
                Every finished semester needs at least one module. Still empty: {{ emptySems.join(', ') }}.
              </p>
              <p v-else class="text-[12px] text-muted-foreground">Drag a module card into the semester you took it. Drag it again to move it.</p>
            </template>
          </section>

          <!-- 5. e-credits -->
          <section class="flex flex-col gap-3 p-6">
            <div class="flex items-center gap-3">
              <span :class="badge(5)">{{ sectionDone[4] ? '✓' : 5 }}</span>
              <h2 class="text-h4">How many e-credits do you have?</h2>
            </div>
            <label class="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-[9px] focus-within:border-ring">
              <span class="text-[14px] text-muted-foreground">e$</span>
              <input
                v-model="eCredits"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 1200"
                aria-label="E-credit amount in e$"
                class="min-w-0 flex-1 bg-transparent font-mono text-[14px] font-medium outline-none"
              />
            </label>
            <p class="text-[12px] text-muted-foreground">Your current e-credit (e$) balance. We use it to budget your bids.</p>
          </section>
        </div>

        <div class="flex items-center justify-end gap-4">
          <span v-if="missing" class="text-[13px] text-muted-foreground">{{ missing }}</span>
          <button
            type="submit"
            :disabled="!!missing"
            class="inline-flex items-center rounded-md bg-primary px-5 py-[11px] text-[15px] leading-normal font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {{ undecided ? 'Finish and take the quiz' : 'Finish setup' }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>
