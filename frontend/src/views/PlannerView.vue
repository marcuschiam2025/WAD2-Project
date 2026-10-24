<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore, effectiveCode, hasRoom, MAX_MODULES_PER_SEM } from '@core/stores/planner'
import { useRoomsStore } from '@core/stores/rooms'
import { useCatalogueStore } from '@core/stores/catalogue'
import { modules, moduleName, tracks, trackName } from '@core/data/catalogue'
import { planLabel } from '@/trackLabels'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import DegreeChecklist from '@/components/DegreeChecklist.vue'
import PrereqWarningModal from '@/components/modals/PrereqWarningModal.vue'
import PlanLimitModal from '@/components/modals/PlanLimitModal.vue'
import PlanSettingsModal from '@/components/modals/PlanSettingsModal.vue'
import SemesterFullModal from '@/components/modals/SemesterFullModal.vue'
import iconSearch from '@/assets/v2/search.svg'
import iconCheck from '@/assets/figma/check-success.svg'
import iconAlert from '@/assets/figma/alert-12.svg'
import iconGrip from '@/assets/figma/icon-grip.svg'
import iconPlus from '@/assets/figma/plus-14.svg'

const router = useRouter()
const planner = usePlannerStore()
const rooms = useRoomsStore()
const catalogue = useCatalogueStore()

// Modules whose section was accepted in a collab room get their own colour
const roomDecision = (code) => rooms.decided.find((d) => d.module === effectiveCode(code))
// Plans come from /api/plans through the planner store (sample plans when the backend isn't running)
const plan = computed(() => planner.activePlan)

const tabsRef = ref(null)
const showPlanLimit = ref(false)
const showSettings = ref(false)
const warning = ref(null) // { code, semId }
const fullSem = ref(null) // semester that refused a module because it already holds the maximum
const dragging = ref(null)
const dragOver = ref(null) // semester id under the cursor while dragging
const query = ref('')
const expandedYears = ref([])

const shortTrack = (c) => tracks.find((t) => t.code === c)?.short ?? c
const status = (sem) => planner.semStatus(plan.value, sem.id)
const nowSem = computed(() => plan.value.semesters.find((s) => s.id === plan.value.currentSem))

// --- Columns: finished years collapse into one narrow "Y1 ✓ 8 done" column ------------------
const columns = computed(() => {
  const cols = []
  plan.value.semesters.forEach((sem) => {
    const year = sem.id.slice(0, 2)
    if (status(sem) === 'done' && !expandedYears.value.includes(year)) {
      const last = cols.at(-1)
      if (last?.type === 'year' && last.year === year) last.count += sem.modules.length
      else cols.push({ type: 'year', key: year, year, count: sem.modules.length })
    } else {
      cols.push({ type: 'sem', key: sem.id, sem })
    }
  })
  return cols
})

function toggleYear(year) {
  expandedYears.value = expandedYears.value.includes(year)
    ? expandedYears.value.filter((y) => y !== year)
    : [...expandedYears.value, year]
}

// --- Plans ---------------------------------------------------------------------------------
function addPlan() {
  if (!planner.addPlan()) showPlanLimit.value = true
}

function goToPlans() {
  showPlanLimit.value = false
  tabsRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// --- Drag & drop ---------------------------------------------------------------------------
const canDrop = (sem) => !sem.loa && status(sem) !== 'done'
const isFull = (sem) => sem.modules.length >= MAX_MODULES_PER_SEM

// Place a module, or tell the student the semester is full. The room check happens here too, so a
// semester can never go over the maximum even if the store still holds older code (e.g. after a live reload).
function place(code, semId) {
  const sem = plan.value.semesters.find((s) => s.id === semId)
  if (!hasRoom(sem, code)) {
    fullSem.value = sem
    return false
  }
  planner.placeModule(code, semId)
  return true
}

function onDragStart(e, code) {
  dragging.value = code
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', code)
}

function onDragEnd() {
  dragging.value = null
  dragOver.value = null
}

function dropOnSemester(sem) {
  const code = dragging.value
  onDragEnd()
  if (!code || !canDrop(sem)) return
  if (!place(code, sem.id)) return
  if (planner.hasWarning(plan.value, code, sem.id)) warning.value = { code, semId: sem.id }
}

// Clearing the basket can be undone for a few seconds, in case it was a mis-click
const clearedCodes = ref(null)
let undoTimer
const clearable = computed(() => planner.basket.some((code) => !roomDecision(code)))
function clearBasket() {
  clearedCodes.value = planner.clearBasket()
  clearTimeout(undoTimer)
  undoTimer = setTimeout(() => (clearedCodes.value = null), 6000)
}
function undoClear() {
  clearedCodes.value?.forEach((code) => planner.addToBasket(code))
  clearedCodes.value = null
}

function dropOnBasket() {
  if (dragging.value) planner.returnToBasket(dragging.value)
  onDragEnd()
}

function cardState(code, sem) {
  if (status(sem) === 'done') return 'done'
  if (planner.hasWarning(plan.value, code, sem.id)) return 'warning'
  return 'planned'
}

function warningText(code, sem) {
  const { prereqs, coreqs } = planner.checkModule(plan.value, code, sem.id)
  return prereqs.length ? `Prereq ${prereqs[0]} not met` : `Coreq ${coreqs[0]} needed`
}

// --- Prereq warning overlay ----------------------------------------------------------------
const warningInfo = computed(() => {
  if (!warning.value) return null
  const { code, semId } = warning.value
  const semesters = plan.value.semesters.filter((s) => !s.loa)
  const i = semesters.findIndex((s) => s.id === semId)
  return { code, sem: semesters[i], prev: semesters[i - 1], next: semesters[i + 1], ...planner.checkModule(plan.value, code, semId) }
})

function resolveWarning(action, target) {
  const w = warningInfo.value
  if (action === 'prereq' && !place(target, w.prev.id)) return
  if (action === 'coreq' && !place(target, w.sem.id)) return
  if (action === 'move') {
    if (!place(w.code, w.next.id)) return
    warning.value = planner.hasWarning(plan.value, w.code, w.next.id) ? { code: w.code, semId: w.next.id } : null
    return
  }
  if (!planner.hasWarning(plan.value, w.code, w.sem.id)) warning.value = null
}

// --- Basket + search -----------------------------------------------------------------------
const q = computed(() => query.value.trim().toLowerCase())
const matches = (m) => !q.value || m.code.toLowerCase().includes(q.value) || m.name.toLowerCase().includes(q.value)
const basket = computed(() =>
  planner.basket.map((code) => ({ ...modules[code], code, name: moduleName(code) })).filter(matches),
)

// Search: GET /api/modules?q=… when the backend is up (debounced), the sample catalogue otherwise
const apiResults = ref([])
let searchTimer
watch(q, (text) => {
  clearTimeout(searchTimer)
  if (!text || !catalogue.online) return (apiResults.value = [])
  searchTimer = setTimeout(async () => {
    const found = await catalogue.search(text, 12).catch(() => [])
    if (q.value === text) apiResults.value = found
  }, 250)
})
const searchResults = computed(() => {
  if (!q.value) return []
  const placed = new Set(plan.value.semesters.flatMap((s) => s.modules.map(effectiveCode)))
  const pool = catalogue.online ? apiResults.value : Object.values(modules).filter(matches)
  return pool.filter((m) => !placed.has(m.code) && !planner.basket.includes(m.code)).slice(0, 4)
})

// --- Requirements strip --------------------------------------------------------------------
// TODO(backend): the V2 design shows a "Track 2" bucket; the requirement checker only has IS depth for now
const bucketOrder = ['major-core', 'track', 'depth', 'free', 'uni-core']
const bucketLabel = (b) =>
  ({
    'major-core': 'IS core',
    track: `Track 1 · ${shortTrack(plan.value.tracks[0])}`,
    depth: 'IS depth',
    free: 'Electives',
    'uni-core': 'General education',
  })[b.key] ?? b.label
// With the backend, the buckets add up GET /api/plans/:id/check: track requirements, then the rest
// by what they count toward. Offline, the local overview from the sample catalogue.
const checkBuckets = [
  { key: 'MAJOR_CORE', label: () => 'IS core' },
  { key: 'track', label: () => `Track 1 · ${shortTrack(plan.value.tracks[0])}` },
  { key: 'MAJOR_ELECTIVES', label: () => 'IS electives' },
  { key: 'FREE_ELECTIVES', label: () => 'Electives' },
  { key: 'UNI_CORE', label: () => 'University core' },
]
const requirements = computed(() => {
  const check = planner.activeCheck
  if (!check) {
    return bucketOrder
      .map((key) => planner.requirements.find((b) => b.key === key))
      .filter(Boolean)
      .map((b) => ({ key: b.key, label: bucketLabel(b), planned: Math.min(b.planned, b.required), required: b.required }))
  }
  return checkBuckets
    .map(({ key, label }) => {
      const reqs = check.requirements.filter((r) => (r.level === 'track' ? 'track' : r.countsToward) === key)
      return {
        key,
        label: label(),
        planned: reqs.reduce((a, r) => a + Math.min(r.cuPlanned, r.cuRequired), 0),
        required: reqs.reduce((a, r) => a + r.cuRequired, 0),
      }
    })
    .filter((b) => b.required > 0)
})
// Prereq problems from the planner, plus exclusions and other rules only the backend's check knows about
const onTrack = computed(() => !planner.hasAnyWarning && (planner.activeCheck?.onTrack ?? true))
</script>

<template>
  <div>
    <PageHeader overline="BSc Information Systems · Class of 2027" title="What-If Planner">
      <template #actions>
        <BaseButton variant="outline" size="lg" @click="planner.addSemester({ loa: true })">Add LOA term</BaseButton>
        <BaseButton size="lg" @click="addPlan">Add plan</BaseButton>
      </template>
    </PageHeader>

    <main class="flex flex-col gap-6 px-16 pt-8 pb-12">
      <!-- The backend refused a save (or the plans could not be loaded) -->
      <div
        v-if="planner.syncError"
        class="flex items-center justify-between gap-4 rounded-lg border border-destructive bg-destructive-tint px-4 py-3 text-[13px]"
      >
        <span><span class="font-semibold">Not saved:</span> {{ planner.syncError }}</span>
        <BaseButton variant="outline" size="sm" @click="planner.reload()">Reload saved plans</BaseButton>
      </div>
      <section v-enter class="card flex items-stretch overflow-hidden"> <!-- motion: fade + slide up on mount -->
        <!-- Module basket -->
        <aside
          class="flex w-[260px] shrink-0 flex-col gap-3 border-r border-border p-4 transition-colors"
          :class="dragging && !planner.basket.includes(dragging) && 'bg-primary-tint'"
          @dragover.prevent
          @drop.prevent="dropOnBasket"
        >
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <h2 class="text-h4">Module basket</h2>
              <div class="flex items-center gap-2">
                <span class="text-[13px] text-muted-foreground">{{ planner.basket.length }}</span>
                <button
                  v-if="clearable"
                  type="button"
                  class="rounded-sm px-1.5 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-destructive"
                  @click="clearBasket"
                >Clear</button>
              </div>
            </div>
            <p class="text-[12px] text-muted-foreground">Saved from Match Results and search.</p>
          </div>

          <label class="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 focus-within:border-ring">
            <img :src="iconSearch" alt="" class="size-4" />
            <input v-model="query" placeholder="Search modules..." class="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
          </label>

          <ul v-stagger class="flex flex-col gap-2"> <!-- motion: basket modules stagger in -->
            <li
              v-for="m in basket"
              :key="m.code"
              draggable="true"
              class="group flex cursor-grab items-center gap-2 rounded-md border bg-background px-2.5 py-2 transition-[opacity,border-color] active:cursor-grabbing"
              :class="dragging === m.code ? 'border-primary opacity-50' : 'border-border hover:border-primary/50'"
              @dragstart="onDragStart($event, m.code)"
              @dragend="onDragEnd"
            >
              <img :src="iconGrip" alt="" class="size-3.5" />
              <div class="flex min-w-0 flex-1 flex-col leading-normal">
                <span class="font-mono text-[13px] font-bold">{{ m.code }}</span>
                <span class="truncate text-[12px] text-muted-foreground">{{ m.name }}</span>
              </div>
              <button
                v-if="!roomDecision(m.code)"
                type="button"
                draggable="false"
                :aria-label="`Remove ${m.code} from the basket`"
                class="shrink-0 rounded-sm px-1 text-[12px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                @click.stop="planner.removeFromBasket(m.code)"
              >✕</button>
            </li>
          </ul>
          <p v-if="clearedCodes?.length" class="flex items-center justify-between rounded-md bg-muted px-2.5 py-2 text-[12px]">
            Cleared {{ clearedCodes.length }} module{{ clearedCodes.length === 1 ? '' : 's' }}
            <button type="button" class="font-semibold text-primary hover:underline" @click="undoClear">Undo</button>
          </p>

          <div v-if="searchResults.length" class="flex flex-col gap-1.5">
            <p class="text-overline text-muted-foreground">Add from catalogue</p>
            <button
              v-for="m in searchResults"
              :key="m.code"
              type="button"
              class="flex items-center gap-2 rounded-md border border-dashed border-border px-2.5 py-2 text-left transition-colors hover:border-primary"
              @click="planner.addToBasket(m.code)"
            >
              <img :src="iconPlus" alt="" class="size-3.5" />
              <span class="min-w-0 flex-1 truncate text-[12px]"><span class="font-mono font-bold">{{ m.code }}</span> {{ m.name }}</span>
            </button>
          </div>

          <p v-if="!planner.basket.length" class="text-[12px] text-muted-foreground">
            Your basket is empty. Save modules from your track matches, or drag one back here.
          </p>
          <p v-else class="text-[12px] text-muted-foreground">Drag a module onto a semester.</p>

          <div class="mt-auto border-t border-border pt-3">
            <BaseButton variant="ghost" @click="router.push('/rooms')">Import basket to Collab Room</BaseButton>
          </div>
        </aside>

        <!-- Plans -->
        <div class="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div ref="tabsRef" class="flex items-center justify-between gap-3 border-b border-border">
            <div class="flex min-w-0 gap-5">
              <button
                v-for="p in planner.plans"
                :key="p.id"
                type="button"
                class="-mb-px border-b-2 pb-2.5 text-[14px] whitespace-nowrap transition-colors"
                :class="
                  p.id === planner.activePlanId
                    ? 'border-foreground font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                "
                @click="planner.activePlanId = p.id"
              >
                {{ planLabel(p) }}
              </button>
            </div>
            <div class="flex gap-2 pb-2">
              <BaseButton variant="outline" size="sm" @click="showSettings = true">Plan settings</BaseButton>
              <BaseButton variant="secondary" size="sm" to="/bidding">Import to Bidding Planner</BaseButton>
            </div>
          </div>

          <p class="text-[13px] text-muted-foreground">
            Now: {{ nowSem?.label.replace('S', 'Sem ') }}
            · 1st track: {{ trackName(plan.tracks[0]) }}
            <template v-if="plan.tracks[1]"> · 2nd track: {{ trackName(plan.tracks[1]) }}</template>
          </p>

          <div class="flex gap-2.5 overflow-x-auto pb-1">
            <template v-for="col in columns" :key="col.key">
              <!-- Collapsed finished year -->
              <button
                v-if="col.type === 'year'"
                type="button"
                class="flex min-h-[330px] w-14 shrink-0 flex-col items-center gap-2 rounded-md bg-muted py-3 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-border"
                :title="`Show ${col.year} semesters`"
                @click="toggleYear(col.year)"
              >
                {{ col.year }}
                <img :src="iconCheck" alt="" class="size-3.5" />
                <span class="font-sans">{{ col.count }} done</span>
              </button>

              <!-- Semester -->
              <div
                v-else
                class="flex min-h-[330px] min-w-[140px] flex-1 flex-col gap-2 rounded-md p-2 transition-colors"
                :class="{
                  'border-[1.5px] border-primary bg-card': status(col.sem) === 'now',
                  'border border-border bg-card': status(col.sem) === 'future' && !col.sem.loa,
                  'border border-border bg-muted': status(col.sem) === 'done',
                  'border border-dashed border-border bg-muted': col.sem.loa,
                }"
                @dragenter="canDrop(col.sem) && (dragOver = col.sem.id)"
                @dragover.prevent
                @drop.prevent="dropOnSemester(col.sem)"
              >
                <div class="flex items-center justify-between px-0.5 font-mono text-[11px]">
                  <button
                    v-if="status(col.sem) === 'done'"
                    type="button"
                    class="text-muted-foreground hover:text-foreground"
                    @click="toggleYear(col.sem.id.slice(0, 2))"
                  >{{ col.sem.label }}</button>
                  <span v-else :class="status(col.sem) === 'now' ? 'text-primary' : 'text-muted-foreground'">{{ col.sem.label }}</span>
                  <span v-if="col.sem.loa" class="font-sans text-muted-foreground">LOA</span>
                  <span v-else-if="status(col.sem) === 'now'" class="font-sans font-semibold text-primary">Now</span>
                  <span v-else-if="col.sem.exchange" class="font-sans font-semibold text-primary">Exchange</span>
                  <span v-else :class="isFull(col.sem) ? 'font-semibold text-destructive' : 'text-muted-foreground'">{{ col.sem.modules.length }}/{{ MAX_MODULES_PER_SEM }}</span>
                </div>

                <p v-if="col.sem.loa" class="px-0.5 text-[11.5px] text-muted-foreground">Leave of absence. No modules this term.</p>

                <div
                  v-for="code in col.sem.modules"
                  :key="code"
                  :draggable="status(col.sem) !== 'done'"
                  :title="roomDecision(code) ? `Accepted in ${roomDecision(code).roomName}. Undo it in the room to remove it.` : undefined"
                  class="group relative flex flex-col rounded-sm px-2 py-1.5 leading-normal transition-opacity"
                  :class="[
                    roomDecision(code)
                      ? 'border-2 border-success bg-success-tint'
                      : cardState(code, col.sem) === 'warning'
                        ? 'border border-destructive bg-destructive-tint'
                        : 'bg-secondary',
                    status(col.sem) !== 'done' && 'cursor-grab',
                    dragging === code && 'opacity-40',
                  ]"
                  @dragstart="onDragStart($event, code)"
                  @dragend="onDragEnd"
                >
                  <span class="flex items-center gap-1 font-mono text-[12px] font-bold">
                    {{ code }}
                    <img v-if="cardState(code, col.sem) === 'warning'" :src="iconAlert" alt="" class="size-3" />
                  </span>
                  <span v-if="cardState(code, col.sem) === 'warning'" class="text-[11px] text-destructive">{{ warningText(code, col.sem) }}</span>
                  <span v-else class="line-clamp-2 text-[11px] text-muted-foreground">{{ moduleName(effectiveCode(code)) }}</span>
                  <button
                    v-if="status(col.sem) !== 'done' && !roomDecision(code)"
                    type="button"
                    :aria-label="`Move ${code} back to basket`"
                    class="absolute top-1 right-1.5 hidden text-[11px] text-muted-foreground group-hover:block hover:text-foreground"
                    @click="planner.returnToBasket(code)"
                  >
                    ✕
                  </button>
                </div>

                <div
                  v-if="dragging && dragOver === col.sem.id && !col.sem.modules.includes(dragging)"
                  class="flex justify-center rounded-sm border-[1.5px] border-dashed px-2 py-2.5 text-[11.5px] font-medium"
                  :class="isFull(col.sem) ? 'border-destructive text-destructive' : 'border-primary text-primary'"
                >
                  {{ isFull(col.sem) ? `Full: ${MAX_MODULES_PER_SEM} modules max` : `Drop ${dragging} here` }}
                </div>
              </div>
            </template>
          </div>

          <div class="flex flex-wrap items-center gap-5 text-[12px] text-muted-foreground">
            <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] bg-muted" /> Done</span>
            <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] bg-secondary" /> Planned</span>
            <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border border-destructive bg-destructive-tint" /> Prereq not met</span>
            <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border-2 border-success bg-success-tint" /> Accepted in a collab room</span>
            <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border border-dashed border-primary" /> Drop target</span>
            <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border-[1.5px] border-primary" /> Current semester</span>
          </div>
        </div>
      </section>

      <!-- Module requirements -->
      <section v-enter="0.1" class="card flex flex-col gap-4 p-6"> <!-- motion: requirements strip fades in, 100ms delay -->
        <div class="flex items-center justify-between">
          <h2 class="text-[17px] font-semibold">Module requirements · {{ plan.name }}</h2>
          <div class="flex items-center gap-3">
            <span v-if="planner.activeCheck" class="font-mono text-[13px] text-muted-foreground">
              {{ planner.activeCheck.plannedCu }} / {{ planner.activeCheck.requiredCu }} CU planned
            </span>
            <StatusPill v-if="onTrack" tone="success">On track</StatusPill>
            <StatusPill v-else tone="destructive">Prereq issues</StatusPill>
          </div>
        </div>
        <div class="grid grid-cols-5 gap-14">
          <div v-for="b in requirements" :key="b.key" class="flex flex-col gap-1.5">
            <span class="text-[13px] text-muted-foreground">{{ b.label }}</span>
            <span class="font-mono text-[14px] font-bold">{{ b.planned }} / {{ b.required }} CU</span>
            <ProgressBar
              :value="Math.min(1, b.planned / b.required)"
              :color="b.planned >= b.required ? 'bg-success' : 'bg-primary'"
              track="h-1.5 w-full"
            />
          </div>
        </div>
      </section>

      <!-- Degree checklist: the 36 courses, what is cleared and what is still to take -->
      <DegreeChecklist />
    </main>

    <PrereqWarningModal
      v-if="warningInfo"
      :code="warningInfo.code"
      :sem-label="warningInfo.sem.label"
      :prev-sem-label="warningInfo.prev?.label"
      :next-sem-label="warningInfo.next?.label"
      :prereqs="warningInfo.prereqs"
      :coreqs="warningInfo.coreqs"
      @close="warning = null"
      @add-prereq="resolveWarning('prereq', $event)"
      @add-coreq="resolveWarning('coreq', $event)"
      @move-next="resolveWarning('move')"
    />
    <SemesterFullModal v-if="fullSem" :sem-label="fullSem.label" :max="MAX_MODULES_PER_SEM" @close="fullSem = null" />
    <PlanLimitModal v-if="showPlanLimit" @close="showPlanLimit = false" @go-to-plans="goToPlans" />
    <PlanSettingsModal v-if="showSettings" @close="showSettings = false" />
  </div>
</template>
