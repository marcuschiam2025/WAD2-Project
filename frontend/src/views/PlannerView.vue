<script setup>
import { computed, ref } from 'vue'
import { usePlannerStore, MAX_PLANS, effectiveCode } from '@/stores/planner'
import { modules, tracks, trackName } from '@/data/catalogue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import SelectField from '@/components/ui/SelectField.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import ModuleChip from '@/components/ModuleChip.vue'
import BasketModule from '@/components/BasketModule.vue'
import PrereqWarningModal from '@/components/modals/PrereqWarningModal.vue'
import PlanLimitModal from '@/components/modals/PlanLimitModal.vue'
import iconPlusWhite from '@/assets/figma/plus-white.svg'
import iconPlusDark from '@/assets/figma/plus-dark.svg'
import iconPlusMuted from '@/assets/figma/plus-muted.svg'
import iconPlus14 from '@/assets/figma/plus-14.svg'
import iconUsers from '@/assets/figma/icon-users.svg'
import iconGavel from '@/assets/figma/icon-gavel.svg'
import iconInfoMuted from '@/assets/figma/info-muted.svg'
import iconInfoPrimary from '@/assets/figma/info-primary.svg'

const planner = usePlannerStore()
const plan = computed(() => planner.activePlan)

const tabsRef = ref(null)
const showPlanLimit = ref(false)
const warning = ref(null) // { code, semId }
const dragging = ref(null)
const addingModule = ref(false)
const moduleToAdd = ref('')

function planSubtitle(p) {
  const names = p.tracks.map((c) => tracks.find((t) => t.code === c)?.short ?? c)
  return names.length === 1 ? `${names[0]} only` : names.join(' + ')
}

// --- Controls -------------------------------------------------------------
const semesterOptions = computed(() =>
  plan.value.semesters.filter((s) => !s.loa).map((s) => ({ value: s.id, label: s.label.replace('S', 'Sem ') })),
)
const trackOptions = tracks.map((t) => ({ value: t.code, label: t.name }))
const secondTrackOptions = computed(() => [
  { value: '', label: 'None' },
  ...trackOptions.filter((o) => o.value !== plan.value.tracks[0]),
])
const firstTrack = computed({
  get: () => plan.value.tracks[0],
  set: (v) => (plan.value.tracks = [v, ...plan.value.tracks.slice(1).filter((c) => c !== v)]),
})
const secondTrack = computed({
  get: () => plan.value.tracks[1] ?? '',
  set: (v) => (plan.value.tracks = v ? [plan.value.tracks[0], v] : [plan.value.tracks[0]]),
})

// --- Plans ----------------------------------------------------------------
function addPlan() {
  if (!planner.addPlan()) showPlanLimit.value = true
}

function goToPlans() {
  showPlanLimit.value = false
  tabsRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// --- Drag & drop ----------------------------------------------------------
function onDragStart(e, code) {
  dragging.value = code
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', code)
}

function onDragEnd() {
  dragging.value = null
}

function dropOnSemester(sem) {
  const code = dragging.value
  dragging.value = null
  if (!code || sem.loa) return
  planner.placeModule(code, sem.id)
  if (planner.hasWarning(plan.value, code, sem.id)) warning.value = { code, semId: sem.id }
}

function dropOnBasket() {
  if (dragging.value) planner.returnToBasket(dragging.value)
  dragging.value = null
}

function chipState(code, sem) {
  if (dragging.value === code) return 'dragging'
  if (planner.semStatus(plan.value, sem.id) === 'done') return 'completed'
  if (planner.hasWarning(plan.value, code, sem.id)) return 'warning'
  return 'default'
}

// --- Prereq warning -------------------------------------------------------
const warningInfo = computed(() => {
  if (!warning.value) return null
  const { code, semId } = warning.value
  const semesters = plan.value.semesters.filter((s) => !s.loa)
  const i = semesters.findIndex((s) => s.id === semId)
  return {
    code,
    sem: semesters[i],
    prev: semesters[i - 1],
    next: semesters[i + 1],
    ...planner.checkModule(plan.value, code, semId),
  }
})

function resolveWarning(action, target) {
  const w = warningInfo.value
  if (action === 'prereq') planner.placeModule(target, w.prev.id)
  if (action === 'coreq') planner.placeModule(target, w.sem.id)
  if (action === 'move') {
    planner.placeModule(w.code, w.next.id)
    warning.value = planner.hasWarning(plan.value, w.code, w.next.id) ? { code: w.code, semId: w.next.id } : null
    return
  }
  if (!planner.hasWarning(plan.value, w.code, w.sem.id)) warning.value = null
}

// --- Basket ---------------------------------------------------------------
const addableModules = computed(() => {
  const placed = new Set(plan.value.semesters.flatMap((s) => s.modules.map(effectiveCode)))
  return Object.values(modules)
    .filter((m) => !placed.has(m.code) && !planner.basket.includes(m.code))
    .map((m) => ({ value: m.code, label: `${m.code} · ${m.name}` }))
})

function confirmAddModule() {
  if (moduleToAdd.value) planner.addToBasket(moduleToAdd.value)
  moduleToAdd.value = ''
  addingModule.value = false
}
</script>

<template>
  <div>
    <PageHeader overline="BSc INFORMATION SYSTEMS · CLASS OF 2027" title="What-If Planner">
      <template #actions>
        <BaseButton variant="outline" @click="planner.addSemester({ loa: true })">Add LOA term</BaseButton>
        <BaseButton @click="addPlan">
          <img :src="iconPlusWhite" alt="" class="size-4" /> Add plan
        </BaseButton>
      </template>
    </PageHeader>

    <main class="flex flex-col gap-6 px-16 pt-8 pb-16">
      <!-- Module basket -->
      <section class="card flex flex-col gap-4 p-5" @dragover.prevent @drop.prevent="dropOnBasket">
        <div class="flex items-center gap-3">
          <div class="flex flex-1 flex-col gap-0.5">
            <h2 class="text-h4">Module basket · {{ planner.basket.length }}</h2>
            <p class="text-small text-muted-foreground">
              Saved from Match Results and search. Drag a module onto a semester column.
            </p>
          </div>
          <BaseButton variant="outline" @click="addingModule = !addingModule">
            <img :src="iconPlusDark" alt="" class="size-4" /> Add module
          </BaseButton>
          <BaseButton variant="outline" to="/rooms">
            <img :src="iconUsers" alt="" class="size-4" /> Import to Collab Room
          </BaseButton>
          <BaseButton variant="secondary" to="/bidding">
            <img :src="iconGavel" alt="" class="size-4" /> Import to Bidding Planner
          </BaseButton>
        </div>
        <div v-if="addingModule" class="flex items-end gap-2">
          <SelectField
            v-model="moduleToAdd"
            label="Add a module to your basket"
            :options="[{ value: '', label: 'Choose a module…' }, ...addableModules]"
            width="w-[420px]"
          />
          <BaseButton :disabled="!moduleToAdd" @click="confirmAddModule">Add</BaseButton>
        </div>
        <div class="flex flex-wrap gap-3">
          <BasketModule
            v-for="code in planner.basket"
            :key="code"
            :code="code"
            :name="modules[code]?.name ?? code"
            draggable="true"
            @dragstart="onDragStart($event, code)"
            @dragend="onDragEnd"
          />
          <p v-if="!planner.basket.length" class="text-small text-muted-foreground">
            Your basket is empty. Save modules from your track matches or drag one back here.
          </p>
        </div>
      </section>

      <!-- Semester roadmap -->
      <section class="card flex flex-col gap-4 p-5">
        <div ref="tabsRef" class="flex items-stretch gap-2">
          <button
            v-for="p in planner.plans"
            :key="p.id"
            type="button"
            class="flex flex-col gap-0.5 rounded-md px-3.5 py-2 text-left whitespace-nowrap"
            :class="p.id === planner.activePlanId ? 'border-[1.5px] border-primary bg-primary-soft' : 'border border-border hover:bg-muted'"
            @click="planner.activePlanId = p.id"
          >
            <span class="text-[13px] font-semibold" :class="p.id === planner.activePlanId && 'text-primary'">{{ p.name }}</span>
            <span class="text-[12px] text-muted-foreground">{{ planSubtitle(p) }}</span>
          </button>
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3.5 py-2 text-[13px] font-medium text-muted-foreground"
            :class="planner.plans.length >= MAX_PLANS && 'opacity-60'"
            @click="addPlan"
          >
            <img :src="iconPlusMuted" alt="" class="size-3.5" />
            {{ planner.plans.length }} / {{ MAX_PLANS }} plans
          </button>
        </div>

        <div class="flex items-end gap-4">
          <SelectField v-model="plan.currentSem" label="Current semester" :options="semesterOptions" width="w-[220px]" />
          <SelectField v-model="firstTrack" label="1st track" :options="trackOptions" width="w-[260px]" />
          <SelectField v-model="secondTrack" label="2nd track / major" :options="secondTrackOptions" width="w-[340px]" />
          <div class="flex flex-1 items-center gap-1.5 pb-2.5">
            <img :src="iconInfoMuted" alt="" class="size-3.5" />
            <p class="text-small text-muted-foreground">2nd track or second major can be added later on.</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex flex-1 flex-col gap-0.5">
            <h2 class="text-h4">{{ plan.name }} · {{ plan.semesters.length }}-semester roadmap</h2>
            <p class="text-small text-muted-foreground">
              Drag modules from the basket onto a semester. Past semesters are locked; drop modules there to mark them
              as done for prereq checks.
            </p>
          </div>
          <BaseButton v-if="planner.plans.length > 1" variant="ghost" size="sm" @click="planner.deletePlan(plan.id)">
            Delete plan
          </BaseButton>
          <BaseButton variant="outline" size="sm" @click="planner.addSemester()">
            <img :src="iconPlus14" alt="" class="size-3.5" /> Add sem
          </BaseButton>
        </div>

        <div class="flex gap-2.5 overflow-x-auto pb-1">
          <div
            v-for="sem in plan.semesters"
            :key="sem.id"
            class="flex min-h-[260px] min-w-[120px] flex-1 flex-col gap-2 rounded-md px-2.5 py-3"
            :class="{
              'border border-border bg-muted opacity-75': planner.semStatus(plan, sem.id) === 'done',
              'border-[1.5px] border-primary bg-card':
                planner.semStatus(plan, sem.id) === 'now' || (sem.exchange && planner.semStatus(plan, sem.id) !== 'done'),
              'border border-border bg-card':
                planner.semStatus(plan, sem.id) === 'future' && !sem.exchange && !sem.loa,
              'border border-dashed border-border bg-muted': sem.loa,
            }"
            @dragover.prevent
            @drop.prevent="dropOnSemester(sem)"
          >
            <div
              class="flex items-center justify-between text-[11px] font-medium"
              :class="planner.semStatus(plan, sem.id) === 'now' || (sem.exchange && planner.semStatus(plan, sem.id) !== 'done') ? 'text-primary' : 'text-muted-foreground'"
            >
              <span class="tracking-[0.44px]">{{ sem.loa ? `${sem.label} · LOA` : sem.label }}</span>
              <span v-if="planner.semStatus(plan, sem.id) === 'done'">Done</span>
              <span v-else-if="planner.semStatus(plan, sem.id) === 'now'" class="font-semibold">Now</span>
            </div>

            <template v-if="sem.loa">
              <p class="text-[11.5px] text-muted-foreground">Leave of absence — no modules this term.</p>
            </template>
            <template v-else>
              <ToggleSwitch
                :model-value="sem.exchange"
                class="text-[11px] font-medium"
                :class="sem.exchange ? 'text-foreground' : 'text-muted-foreground'"
                @update:model-value="planner.toggleExchange(sem.id)"
              >Exchange sem</ToggleSwitch>

              <div
                v-for="code in sem.modules"
                :key="code"
                class="group relative"
                draggable="true"
                @dragstart="onDragStart($event, code)"
                @dragend="onDragEnd"
              >
                <ModuleChip :code="code" :state="chipState(code, sem)" class="w-full cursor-grab" />
                <button
                  v-if="planner.semStatus(plan, sem.id) !== 'done'"
                  type="button"
                  :aria-label="`Move ${code} back to basket`"
                  class="absolute top-1/2 right-1.5 hidden -translate-y-1/2 text-[12px] text-muted-foreground group-hover:block hover:text-foreground"
                  @click="planner.returnToBasket(code)"
                >
                  ✕
                </button>
              </div>

              <div
                v-if="planner.semStatus(plan, sem.id) !== 'done' && sem.modules.length < 5"
                class="flex justify-center rounded-sm border border-dashed border-border p-2 text-[11.5px] text-muted-foreground"
              >
                + Drop module
              </div>
            </template>
          </div>
        </div>

        <div class="flex items-center gap-5 text-[12px] text-muted-foreground">
          <span class="flex items-center gap-1.5"><ModuleChip state="completed" class="h-3.5 w-5 px-1!" /> Completed (past sem)</span>
          <span class="flex items-center gap-1.5"><span class="h-3.5 w-5 rounded-sm bg-secondary" /> Planned</span>
          <span class="flex items-center gap-1.5"><ModuleChip state="warning" class="h-3.5 w-[22px] px-1!" /> Prereq not met</span>
          <span class="flex items-center gap-1.5"><span class="h-4 w-6 rounded-sm border-2 border-primary bg-primary-soft" /> Dragging</span>
        </div>

        <!-- Requirements overview -->
        <div class="flex items-center gap-3">
          <div class="flex flex-1 flex-col gap-0.5">
            <h2 class="text-h4">Module requirements overview — {{ plan.name }}</h2>
            <p class="text-small text-muted-foreground">
              {{ planner.plannedCu }} / {{ planner.requiredCu }} CU planned · graduation check updates as you drag modules.
            </p>
          </div>
          <BaseBadge v-if="!planner.hasAnyWarning" variant="success" dot>On track</BaseBadge>
          <BaseBadge v-else variant="warning" dot>Prereq issues</BaseBadge>
        </div>

        <div class="flex overflow-hidden rounded-md border border-border">
          <div
            v-for="(bucket, bi) in planner.requirements"
            :key="bucket.key"
            class="flex min-w-0 flex-1 flex-col"
            :class="bi < planner.requirements.length - 1 && 'border-r border-border'"
          >
            <div class="flex flex-col gap-0.5 bg-muted px-3 py-2.5">
              <p class="text-[12.5px] font-semibold">
                {{ bucket.key === 'track' ? `IS Track #1 · ${trackName(plan.tracks[0])}` : bucket.label }}
              </p>
              <p class="font-mono text-[11px] font-medium text-muted-foreground">
                {{ Math.min(bucket.planned, bucket.required) }} / {{ bucket.required }} CU
              </p>
            </div>
            <div class="flex flex-col gap-2 p-3">
              <div v-for="m in bucket.modules" :key="m.code" class="flex items-center gap-1.5">
                <ModuleChip :code="m.code" />
                <span v-if="bucket.key === 'uni-core'" class="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">{{ m.name }}</span>
                <BaseBadge v-else-if="bucket.key === 'track' && m.compulsory" variant="info" dot>Compulsory</BaseBadge>
                <BaseBadge v-else-if="bucket.key === 'track'">Elective</BaseBadge>
              </div>
              <p v-if="!bucket.modules.length" class="text-[11.5px] text-muted-foreground">Nothing planned yet</p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2.5 rounded-md bg-primary-soft px-3.5 py-3">
          <img :src="iconInfoPrimary" alt="" class="size-4" />
          <p class="flex-1 text-small">
            Once 4 track modules are met, extra track modules can shift to IS Depth (only shown when you take 1 track) —
            otherwise they move to Free Electives.
          </p>
        </div>
      </section>
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
    <PlanLimitModal v-if="showPlanLimit" @close="showPlanLimit = false" @go-to-plans="goToPlans" />
  </div>
</template>
