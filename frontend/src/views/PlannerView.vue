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

const importingToBidding = ref(false)
const handoffError = ref('')
async function importToBidding() {
  importingToBidding.value = true
  handoffError.value = ''
  try {
    await planner.savePlans()
    await planner.saveBasket()
    await router.push({ path: '/bidding', query: { plan: planner.activePlanId } })
  } catch (error) { handoffError.value = error.message }
  finally { importingToBidding.value = false }
}
async function retryPlans() {
  try { await planner.savePlans() } catch { /* The save error remains visible. */ }
}
async function retryBasket() {
  try { await planner.saveBasket() } catch { /* The basket error remains visible for retry. */ }
}

const router = useRouter()
const planner = usePlannerStore()
const rooms = useRoomsStore()
const catalogue = useCatalogueStore()

// Modules whose section was accepted in a collab room get their own colour
const roomDecision = (code) => rooms.decided.find((d) => d.module === effectiveCode(code))
// Plans come from the authenticated backend through the planner store.
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

// Keyboard/touch alternative to dragging a basket module.
function placeFromSelect(code, event) {
  const semId = event.target.value
  event.target.value = ''
  if (!semId || !place(code, semId)) return
  if (planner.hasWarning(plan.value, code, semId)) warning.value = { code, semId }
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
// The Outstanding Modules checklist added up by area, so both always agree: one line = one course, split into
// cleared (before the current semester), in progress (current semester) and planned (later semesters).
const UNI_GROUPS = ['uni-cap', 'uni-com', 'uni-civ']
const countSlots = (b) => {
  const count = (status) => b.slots.filter((x) => x.status === status).length
  const cleared = count('cleared')
  const exempted = count('exempted')
  const inProgress = count('inProgress')
  const planned = count('planned')
  return { key: b.key, label: b.label, required: b.slots.length, cleared, exempted, inProgress, planned, filled: cleared + exempted + inProgress + planned }
}
const requirements = computed(() => {
  const groups = planner.checklist.groups
  // The live checklist (backend curriculum) already groups its requirements by area
  if (planner.checklist.live) return groups.filter((g) => g.slots.length).map(countSlots)
  const slotsOf = (keys) => groups.filter((g) => keys.includes(g.key)).flatMap((g) => g.slots)
  const electives = slotsOf(['major-elective'])
  // Track lines from the curriculum have ids like "track-PD-1"; one area per track (two for a double track)
  const trackCodes = [...new Set(electives.filter((s) => s.rule === 'trackList').map((s) => s.id.split('-')[1]))]
  const trackAreas = trackCodes.length
    ? trackCodes.map((code, i) => ({
        key: `track-${code}`,
        label: `Track${trackCodes.length > 1 ? ` ${i + 1}` : ''} · ${shortTrack(code)}`,
        slots: electives.filter((s) => s.id.startsWith(`track-${code}-`)),
      }))
    : [{ key: 'track', label: plan.value.tracks[0] ? `Track · ${shortTrack(plan.value.tracks[0])}` : 'Track (undecided)', slots: electives.filter((s) => s.rule === 'track') }]
  return [
    { key: 'uni', label: 'University core', slots: slotsOf(UNI_GROUPS) },
    { key: 'major', label: 'IS core', slots: slotsOf(['major-core']) },
    ...trackAreas,
    { key: 'is-electives', label: 'IS electives', slots: electives.filter((s) => s.rule === 'anyIs') },
    { key: 'free', label: 'Free electives', slots: slotsOf(['free']) },
  ]
    .filter((b) => b.slots.length)
    .map(countSlots)
})
const inPlan = computed(() => {
  const t = planner.checklist.totals
  return { filled: t.cleared + (t.exempted ?? 0) + t.inProgress + t.planned, required: t.required }
})
const pct = (n, of) => `${of ? (n / of) * 100 : 0}%`
// Same rule as the red cards: a prerequisite or co-requisite not met somewhere in the plan
const onTrack = computed(() => !planner.hasAnyWarning)

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
      <p v-if="planner.plansSaving" role="status" class="text-sm text-muted-foreground">Saving semester changes…</p>
      <p v-if="handoffError" role="alert" class="text-sm text-destructive">{{ handoffError }}</p>
      <!-- The backend refused a save (or the plans could not be loaded) -->
      <div
        v-if="planner.syncError"
        class="flex items-center justify-between gap-4 rounded-lg border border-destructive bg-destructive-tint px-4 py-3 text-[13px]"
      >
        <span><span class="font-semibold">Not saved:</span> {{ planner.syncError }}</span>
        <BaseButton variant="outline" size="sm" :disabled="planner.plansSaving" @click="retryPlans">Retry saving plans</BaseButton>
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
            <p v-if="planner.basketSaving" role="status" class="text-xs text-muted-foreground">Saving basket…</p>
            <div v-if="planner.basketError" role="alert" class="text-xs text-destructive">
              <p>Basket not saved: {{ planner.basketError }}</p>
              <BaseButton size="sm" variant="link" :disabled="planner.basketSaving" @click="retryBasket">Retry saving</BaseButton>
            </div>
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
                <select :aria-label="`Place ${m.code} in semester`" class="mt-2 w-full rounded border border-border bg-card p-1 text-xs" @change="placeFromSelect(m.code, $event)" @mousedown.stop draggable="false">
                  <option value="">Place in semester…</option>
                  <option v-for="semester in plan.semesters.filter(canDrop)" :key="semester.id" :value="semester.id" :disabled="isFull(semester)">{{ semester.label }}{{ isFull(semester) ? ' (full)' : '' }}</option>
                </select>
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
              <BaseButton variant="secondary" size="sm" :disabled="importingToBidding" @click="importToBidding">{{ importingToBidding ? 'Saving plan…' : 'Import to Bidding Planner' }}</BaseButton>
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

      <!-- Module requirements: the checklist below, added up by area -->
      <section v-enter="0.1" class="card flex flex-col gap-4 p-6"> <!-- motion: requirements strip fades in, 100ms delay -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-[17px] font-semibold">Module requirements · {{ plan.name }}</h2>
          <div class="flex items-center gap-3">
            <span class="font-mono text-[13px] text-muted-foreground">{{ inPlan.filled }} / {{ inPlan.required }} {{ planner.checklist.live ? 'requirements' : 'courses' }} in your plan</span>
            <StatusPill v-if="onTrack" tone="success">On track</StatusPill>
            <StatusPill v-else tone="destructive">Prereq issues</StatusPill>
          </div>
        </div>
        <div class="grid gap-x-10 gap-y-5" :style="{ gridTemplateColumns: `repeat(${requirements.length}, minmax(0, 1fr))` }">
          <div v-for="b in requirements" :key="b.key" class="flex flex-col gap-1.5">
            <span class="truncate text-[13px] text-muted-foreground" :title="b.label">{{ b.label }}</span>
            <span class="font-mono text-[14px] font-bold">{{ b.filled }} / {{ b.required }}</span>
            <div class="flex h-1.5 overflow-hidden rounded-full bg-border" role="img" :aria-label="`${b.label}: ${b.cleared} cleared, ${b.inProgress} in progress, ${b.planned} planned, of ${b.required}`">
              <span class="bg-success transition-[width] duration-500" :style="{ width: pct(b.cleared, b.required) }" />
              <span class="bg-exempt transition-[width] duration-500" :style="{ width: pct(b.exempted, b.required) }" />
              <span class="bg-warning transition-[width] duration-500" :style="{ width: pct(b.inProgress, b.required) }" />
              <span class="bg-primary transition-[width] duration-500" :style="{ width: pct(b.planned, b.required) }" />
            </div>
            <span class="text-[11.5px] text-muted-foreground">
              {{ b.filled === b.required && b.cleared + b.exempted === b.required ? 'Done' : `${b.cleared} cleared${b.exempted ? ` · ${b.exempted} exempted` : ''}${b.inProgress ? ` · ${b.inProgress} in progress` : ''}${b.planned ? ` · ${b.planned} planned` : ''}` }}
            </span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-5 text-[12px] text-muted-foreground">
          <span class="flex items-center gap-1.5"><span class="h-2 w-4 rounded-full bg-success" /> Cleared</span>
          <span class="flex items-center gap-1.5"><span class="h-2 w-4 rounded-full bg-exempt" /> Exempted</span>
          <span class="flex items-center gap-1.5"><span class="h-2 w-4 rounded-full bg-warning" /> In progress</span>
          <span class="flex items-center gap-1.5"><span class="h-2 w-4 rounded-full bg-primary" /> Planned</span>
          <span>{{ planner.checklist.live ? 'One requirement' : 'One course' }} = one line in Outstanding Modules below.</span>
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
