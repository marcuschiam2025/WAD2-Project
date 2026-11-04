<script setup>
// The degree form: course, tracks, current semester, modules taken (dragged into their semester, including the
// current one), modules exempted from (optional), e-credits.
// mode 'onboarding': a blank form for a new student. mode 'edit': the profile page's inline editor, prefilled with
// the saved answers. Saving calls user.completeOnboarding, which also updates every What-If plan.
import { computed, ref, watch } from 'vue'
import { useUserStore } from '@core/stores/user'
import { usePlannerStore, effectiveCode } from '@core/stores/planner'
import { useCatalogueStore } from '@core/stores/catalogue'
import { moduleName } from '@core/data/catalogue'
import { SEM_IDS } from '@core/data/degree'
import BaseButton from '@/components/ui/BaseButton.vue'
import SelectMenu from '@/components/ui/SelectMenu.vue'
import ModuleSearchBox from '@/components/ModuleSearchBox.vue'
import iconRemove from '@/assets/figma/icon-remove.svg'
import iconGrip from '@/assets/figma/icon-grip.svg'

const props = defineProps({ mode: { type: String, default: 'onboarding' } }) // onboarding | edit
const emit = defineEmits(['saved', 'cancel'])
const user = useUserStore()
const planner = usePlannerStore()

// Editing from the profile page: start from what the student saved before
const editing = props.mode === 'edit'
const saved = editing ? user.profile : {}
// Track codes saved before the catalogue used the backend's codes
const savedTracks = (saved.tracks ?? []).map((c) => (c === 'SMT' ? 'SMCT' : c))

const MAX_TRACKS = 2
// TODO(backend): programmes come from GET /api/programmes. Only Information Systems is open for now.
const programmes = [{ value: 'Information Systems', label: 'BSc Information Systems' }]

const major = ref(programmes[0].value)
const selectedTracks = ref(savedTracks)
const undecided = ref(editing && !savedTracks.length) // wants to take the track quiz instead of picking now
const currentSem = ref(saved.currentSem ?? null)
const eCredits = ref(editing ? String(user.balance) : '')

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
const placed = ref(Object.fromEntries(SEM_IDS.map((id) => [id, [...(saved.takenBySem?.[id] ?? [])]])))
const dragging = ref(null)
const dragOver = ref(null)

const doneSems = computed(() => (currentSem.value ? SEM_IDS.slice(0, SEM_IDS.indexOf(currentSem.value)) : []))
// The done semesters plus the current one (modules being taken now, optional)
const openSems = computed(() => (currentSem.value ? [...doneSems.value, currentSem.value] : []))
const placedCodes = computed(() => Object.values(placed.value).flat())
const allCodes = computed(() => [...basket.value, ...placedCodes.value])

// Modules the student is exempted from. They count as cleared in Outstanding Modules, with no semester.
const exempted = ref([...(saved.exempted ?? [])])
const takenOrExempt = computed(() => [...allCodes.value, ...exempted.value])
function addExemption(m) {
  if (!takenOrExempt.value.includes(m.code)) exempted.value = [...exempted.value, m.code]
}
function removeExemption(code) {
  exempted.value = exempted.value.filter((c) => c !== code)
}

// Free electives exempted without a specific module (e.g. diploma credit). The degree has 6 free electives.
const MAX_FREE_EXEMPT = 6
const freeExempt = ref(saved.freeExemptions ?? 0)
const hasExemptions = computed(() => exempted.value.length > 0 || freeExempt.value > 0)
const emptySems = computed(() => doneSems.value.filter((id) => !placed.value[id].length))

function unplace(code) {
  if (picked.value === code) picked.value = null
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

// Tap a module, then tap a semester: dragging doesn't work on touch screens
const picked = ref(null)
function pick(code) {
  picked.value = picked.value === code ? null : code
}
function placePicked(semId) {
  if (!picked.value) return
  dragging.value = picked.value
  picked.value = null
  drop(semId)
}

// A semester that is no longer done or current gives its modules back to the basket.
// Editing: those modules just leave the list (the plan keeps them as planned), and a semester that has
// just become done or current starts with the modules the active plan has in it.
watch(currentSem, () => {
  SEM_IDS.filter((id) => !openSems.value.includes(id)).forEach((id) => {
    if (!editing) basket.value = [...basket.value, ...placed.value[id]]
    placed.value[id] = []
  })
  if (editing) {
    const taken = new Set([...basket.value, ...Object.values(placed.value).flat()])
    openSems.value
      .filter((id) => !placed.value[id].length)
      .forEach((id) => {
        const fromPlan = planner.activePlan.semesters.find((s) => s.id === id)?.modules.map(effectiveCode) ?? []
        placed.value[id] = fromPlan.filter((c) => !taken.has(c))
      })
  }
})

const eValue = computed(() => Number(eCredits.value))
const eValid = computed(() => eCredits.value !== '' && Number.isFinite(eValue.value) && /^\d+(?:\.\d{1,2})?$/.test(String(eValue.value)))

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

const saving = ref(false)
const saveError = ref('')
const intakeYear = ref(user.profile.intakeYear ?? 2025)

// The tracks on offer depend on the curriculum for this major and intake year
const catalogue = useCatalogueStore()
catalogue.load()
const curriculumId = computed(() => catalogue.majorIdFor(major.value, intakeYear.value))
const trackOptions = computed(() => catalogue.tracksFor(curriculumId.value))
watch(curriculumId, (id) => catalogue.loadMajor(id), { immediate: true })
// Once that curriculum has loaded, drop any chosen track it doesn't have
watch(
  () => catalogue.curricula[curriculumId.value],
  (curriculum) => {
    if (!curriculum) return
    const available = trackOptions.value.map((t) => t.code)
    selectedTracks.value = selectedTracks.value.filter((code) => available.includes(code))
  },
)

async function submit() {
  if (missing.value) return
  saving.value = true
  saveError.value = ''
  try {
  await user.completeOnboarding({
    intakeYear: Number(intakeYear.value),
    major: major.value,
    tracks: selectedTracks.value,
    currentSem: currentSem.value,
    takenBySem: Object.fromEntries(openSems.value.filter((id) => placed.value[id].length).map((id) => [id, placed.value[id]])),
    exempted: exempted.value,
    freeExemptions: freeExempt.value,
    balance: eValue.value,
  })
  emit('saved', { undecided: undecided.value })
  } catch (error) { saveError.value = error.message }
  finally { saving.value = false }
}

// Section number badge: turns into a green tick once that section is complete
const badge = (n) => [
  'flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-bold transition-colors',
  sectionDone.value[n - 1] ? 'bg-success-tint text-success' : 'bg-primary-tint text-primary',
]
</script>

<template>
  <form class="flex w-full flex-col gap-6" @submit.prevent="submit">
    <label class="text-sm font-medium">Intake year
      <input v-model="intakeYear" type="number" min="2000" max="2100" required class="ml-3 rounded border border-border bg-card p-2" />
    </label>
    <p v-if="saveError" role="alert" class="text-sm text-destructive">{{ saveError }}</p>
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
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            v-for="t in trackOptions"
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
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Current semester">
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
          <h2 class="text-h4">Which modules have you taken, or are taking now?</h2>
        </div>

        <p v-if="!currentSem" class="text-[13px] text-muted-foreground">Choose your semester above first.</p>
        <template v-else>
          <ModuleSearchBox :exclude="takenOrExempt" @pick="addModule" />

          <!-- Basket: search results land here, then drag each one into its semester -->
          <div
            class="flex min-h-[64px] flex-col gap-2 rounded-lg border border-dashed border-border p-3"
            @dragover.prevent
            @drop.prevent="drop(null)"
            @click="placePicked(null)"
          >
            <p class="text-overline text-muted-foreground">To place · {{ basket.length }}</p>
            <div v-if="basket.length" class="flex flex-wrap gap-2">
              <div
                v-for="code in basket"
                :key="code"
                draggable="true"
                role="button"
                tabindex="0"
                :aria-pressed="picked === code"
                class="flex cursor-grab items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-[13px] active:cursor-grabbing"
                :class="[dragging === code && 'opacity-40', picked === code ? 'border-primary ring-2 ring-primary/30' : 'border-border']"
                @dragstart="dragging = code"
                @dragend="dragging = dragOver = null"
                @click.stop="pick(code)"
                @keydown.enter.self="pick(code)"
              >
                <img :src="iconGrip" alt="" class="size-3" />
                <span class="font-mono font-bold">{{ code }}</span>
                <span class="max-w-[160px] truncate text-muted-foreground">{{ moduleName(code) }}</span>
                <button type="button" :aria-label="`Remove ${code}`" @click.stop="unplace(code)">
                  <img :src="iconRemove" alt="" class="size-3" />
                </button>
              </div>
            </div>
            <p v-else class="text-[13px] text-muted-foreground">Search above, then drag each module into the semester you took it, or tap it and then tap the semester.</p>
          </div>

          <p v-if="picked" role="status" class="rounded-md bg-primary-tint px-3 py-2 text-[13px]">Tap a semester to place {{ picked }}.</p>

          <!-- Done semesters and the current one: drop modules here -->
          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div
              v-for="id in openSems"
              :key="id"
              class="flex min-h-[112px] flex-col gap-1.5 rounded-lg border p-2 transition-colors"
              :class="
                dragOver === id
                  ? 'border-primary bg-primary-tint'
                  : id === currentSem
                    ? 'border-dashed border-warning bg-warning-tint/40'
                    : 'border-border bg-muted'
              "
              @dragover.prevent="dragOver = id"
              @dragleave="dragOver = null"
              @drop.prevent="drop(id)"
              @click="placePicked(id)"
            >
              <div class="flex items-center justify-between">
                <span class="font-mono text-[12px] font-bold">{{ id }}</span>
                <span v-if="id === currentSem" class="text-[11px] font-medium text-warning">Now · in progress</span>
                <span v-else class="text-[11px] text-muted-foreground">Done</span>
              </div>
              <div
                v-for="code in placed[id]"
                :key="code"
                draggable="true"
                class="group relative flex cursor-grab flex-col rounded-sm bg-card px-2 py-1.5 leading-normal active:cursor-grabbing"
                :class="[dragging === code && 'opacity-40', picked === code && 'ring-2 ring-primary']"
                @dragstart="dragging = code"
                @dragend="dragging = dragOver = null"
                @click.stop="picked && picked !== code ? placePicked(id) : pick(code)"
              >
                <span class="font-mono text-[12px] font-bold">{{ code }}</span>
                <span class="line-clamp-2 text-[11px] text-muted-foreground">{{ moduleName(code) }}</span>
                <button
                  type="button"
                  :aria-label="`Move ${code} back to the basket`"
                  class="absolute top-1 right-1.5 text-[11px] text-muted-foreground hover:text-foreground lg:hidden lg:group-hover:block"
                  @click.stop="backToBasket(code)"
                >✕</button>
              </div>
              <p v-if="!placed[id].length && id === currentSem" class="m-auto text-center text-[11px] text-muted-foreground">
                Optional: what you're taking this semester
              </p>
              <p v-else-if="!placed[id].length" class="m-auto text-center text-[11px] font-medium text-destructive">Needs a module</p>
            </div>
          </div>
          <p v-if="basket.length" class="text-[12px] font-medium text-destructive">
            {{ basket.length }} module{{ basket.length === 1 ? '' : 's' }} still need{{ basket.length === 1 ? 's' : '' }} a semester. Drag {{ basket.length === 1 ? 'it' : 'them' }} into the semester you took {{ basket.length === 1 ? 'it' : 'them' }}.
          </p>
          <p v-else-if="emptySems.length" class="text-[12px] font-medium text-destructive">
            Every finished semester needs at least one module. Still empty: {{ emptySems.join(', ') }}.
          </p>
          <p v-else class="text-[12px] text-muted-foreground">
            Drag a module card into the semester you took it, or into {{ currentSem }} if you're taking it now. Drag it again to move it.
          </p>
        </template>
      </section>

      <!-- 5. Exemptions (optional) -->
      <section class="flex flex-col gap-3 p-6">
        <div class="flex items-center gap-3">
          <span
            class="flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-bold"
            :class="hasExemptions ? 'bg-success-tint text-success' : 'bg-secondary text-muted-foreground'"
          >{{ hasExemptions ? '✓' : 5 }}</span>
          <h2 class="text-h4">Are you exempted from any modules?</h2>
          <span class="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Optional</span>
        </div>
        <ModuleSearchBox :exclude="takenOrExempt" placeholder="Search for a module you're exempted from" @pick="addExemption" />
        <div v-if="exempted.length" class="flex flex-wrap gap-2">
          <span
            v-for="code in exempted"
            :key="code"
            class="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px]"
          >
            <span class="font-mono font-bold">{{ code }}</span>
            <span class="max-w-[200px] truncate text-muted-foreground">{{ moduleName(code) }}</span>
            <button type="button" :aria-label="`Remove exemption for ${code}`" @click="removeExemption(code)">
              <img :src="iconRemove" alt="" class="size-3" />
            </button>
          </span>
        </div>
        <!-- Free electives exempted without a specific module -->
        <div class="flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-3">
          <span class="flex flex-col gap-0.5 leading-normal">
            <span class="text-[14px] font-semibold">Free elective exemptions</span>
            <span class="text-[12px] text-muted-foreground">Free electives you're exempted from without a specific module, e.g. diploma credit.</span>
          </span>
          <div class="flex shrink-0 items-center gap-2" role="group" aria-label="Free elective exemptions">
            <button
              type="button"
              aria-label="One fewer free elective exemption"
              :disabled="freeExempt === 0"
              class="flex size-8 items-center justify-center rounded-md border border-border text-[16px] hover:bg-muted disabled:opacity-40"
              @click="freeExempt--"
            >−</button>
            <span class="w-6 text-center font-mono text-[15px] font-bold" aria-live="polite">{{ freeExempt }}</span>
            <button
              type="button"
              aria-label="One more free elective exemption"
              :disabled="freeExempt >= MAX_FREE_EXEMPT"
              class="flex size-8 items-center justify-center rounded-md border border-border text-[16px] hover:bg-muted disabled:opacity-40"
              @click="freeExempt++"
            >+</button>
          </div>
        </div>
        <p class="text-[12px] text-muted-foreground">
          E.g. from A-levels, a diploma or a placement test. Exempted modules and free electives count as cleared, so they won't show up as outstanding.
        </p>
      </section>

      <!-- 6. e-credits -->
      <section class="flex flex-col gap-3 p-6">
        <div class="flex items-center gap-3">
          <span :class="badge(5)">{{ sectionDone[4] ? '✓' : 6 }}</span>
          <h2 class="text-h4">How many e-credits do you have?</h2>
        </div>
        <label class="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-[9px] focus-within:border-ring">
          <span class="text-[14px] text-muted-foreground">e$</span>
          <input
            v-model="eCredits"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 1200"
            aria-label="E-credit amount in e$"
            class="min-w-0 flex-1 bg-transparent font-mono text-[14px] font-medium outline-none"
          />
        </label>
        <p class="text-[12px] text-muted-foreground">Your current e-credit (e$) balance, with up to 2 decimal places. We use it to budget your bids.</p>
      </section>
    </div>

    <div class="flex items-center justify-end gap-4">
      <span v-if="missing" class="text-[13px] text-muted-foreground">{{ missing }}</span>
      <BaseButton v-if="editing" variant="ghost" @click="emit('cancel')">Cancel</BaseButton>
      <button
        type="submit"
        :disabled="!!missing || saving"
        class="inline-flex items-center rounded-md bg-primary px-5 py-[11px] text-[15px] leading-normal font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {{ saving ? 'Saving…' : editing ? 'Save changes' : undecided ? 'Finish and take the quiz' : 'Finish setup' }}
      </button>
    </div>
  </form>
</template>
