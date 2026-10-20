<script setup>
// What-If Planner / Degree checklist: only the courses still to clear, out of the 36 in the degree.
// Click a course on the left -> a second column lists the modules you could take for it -> click one for its details.
import { computed, ref, watch } from 'vue'
import { usePlannerStore } from '@core/stores/planner'
import { modules, moduleName } from '@core/data/catalogue'
import { BASKETS, GRAD_LABELS } from '@core/data/degree'
import { buildChecklist, candidatesFor } from '@core/utils/degreeChecklist'
import { slideEnter, slideLeave } from '@/motion'
import { semesterTone, semesterToneLabel } from '@/semesterTones'
import StatusPill from '@/components/ui/StatusPill.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import DegreeChecklistRow from '@/components/DegreeChecklistRow.vue'

// TODO(backend): cleared modules should come from the student's completed-module history, not just the plan
const planner = usePlannerStore()
const plan = computed(() => planner.activePlan)
const checklist = computed(() => buildChecklist(plan.value, modules))
const totals = computed(() => checklist.value.totals)
const pct = (n) => `${(n / totals.value.required) * 100}%`

// Finished courses are hidden: only planned and not-yet-planned ones are listed.
const sections = computed(() =>
  [
    ...checklist.value.groups.map((g) => ({ key: g.key, label: g.label, items: g.slots.filter((s) => s.status !== 'cleared') })),
    { key: 'other', label: 'Graduation requirements & exposure', items: checklist.value.other.filter((o) => o.status !== 'cleared') },
  ].filter((s) => s.items.length),
)
const left = computed(() => totals.value.planned + totals.value.todo)

const selectedId = ref(null)
const moduleKey = ref(null)
const item = computed(() => sections.value.flatMap((s) => s.items).find((i) => i.id === selectedId.value) ?? null)
const candidates = computed(() => (item.value ? candidatesFor(item.value, plan.value, modules) : []))
const selectedModule = computed(() => candidates.value.find((m) => m.key === moduleKey.value) ?? null)

function selectItem(i) {
  if (selectedId.value === i.id) {
    selectedId.value = null
    moduleKey.value = null
    return
  }
  selectedId.value = i.id
  const list = candidatesFor(i, plan.value, modules)
  moduleKey.value = list.length === 1 ? list[0].key : null
}

watch(
  () => planner.activePlanId,
  () => {
    selectedId.value = null
    moduleKey.value = null
  },
)

const tags = (m) => [
  ...(m.basket ? [`${BASKETS[m.basket]} basket`] : []),
  ...(m.tracks ?? []),
  ...(m.grad ?? []).map((g) => GRAD_LABELS[g]),
]

const placementPill = (p) =>
  !p ? ['neutral', 'Not in your plan'] : p.status === 'cleared' ? ['success', `Cleared · ${p.semId}`] : ['info', `Planned · ${p.semId}`]

const facts = (m) => [
  { label: 'Offered', value: m.offered ?? 'Term 1 & 2' },
  { label: 'Median bid', value: m.medianBid ? `e$ ${m.medianBid}` : '—', mono: !!m.medianBid },
  { label: 'Prerequisites', value: m.prereqs?.map((c) => `${c} ${moduleName(c)}`).join(', ') || 'None' },
  { label: 'Co-requisites', value: m.coreqs?.map((c) => `${c} ${moduleName(c)}`).join(', ') || 'None' },
]

const inBasket = computed(() => !!selectedModule.value && planner.basket.includes(selectedModule.value.code))
const addLabel = computed(() => {
  if (selectedModule.value?.placement) return 'Already in your plan'
  return inBasket.value ? 'In your module basket' : 'Add to module basket'
})
</script>

<template>
  <section v-enter="0.2" class="card flex flex-col gap-4 p-6"> <!-- motion: checklist card fades in, 200ms delay -->
    <div class="flex flex-col gap-0.5">
      <h2 class="text-[17px] font-semibold">Outstanding Modules</h2>
      <p class="text-[13px] text-muted-foreground">
        {{ plan.name }} · {{ left }} of {{ totals.required }} courses still to clear. Pick one to see what you can take for it.
      </p>
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex h-2 overflow-hidden rounded-full bg-border">
        <span class="bg-success transition-[width] duration-500" :style="{ width: pct(totals.cleared) }" />
        <span class="bg-primary transition-[width] duration-500" :style="{ width: pct(totals.planned) }" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <StatusPill tone="success">{{ totals.cleared }} cleared</StatusPill>
        <StatusPill tone="info">{{ totals.planned }} planned</StatusPill>
        <StatusPill tone="neutral">{{ totals.todo }} not in your plan yet</StatusPill>
        <StatusPill v-if="totals.late" tone="destructive">{{ totals.late }} behind the recommended term</StatusPill>
      </div>
      <div class="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-muted-foreground">
        <span class="font-medium text-foreground">Semester tags</span>
        <span v-for="(label, tone) in semesterToneLabel" :key="tone" class="flex items-center gap-1.5">
          <span class="h-3 w-5 rounded-[4px] border" :class="semesterTone[tone]" /> {{ label }}
        </span>
        <span>Hover a tag to see every recommended semester</span>
      </div>
    </div>

    <p v-if="!sections.length" class="rounded-md bg-success-tint px-4 py-3 text-[13px] font-medium">
      All {{ totals.required }} courses are cleared.
    </p>

    <div v-else class="flex h-[560px] overflow-hidden rounded-lg border border-border">
      <!-- 1. Courses still to clear -->
      <div class="w-[340px] shrink-0 overflow-y-auto border-r border-border">
        <div v-for="s in sections" :key="s.key">
          <div class="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-muted px-4 py-2">
            <h3 class="text-overline text-muted-foreground">{{ s.label }}</h3>
            <span class="font-mono text-[11px] font-medium text-muted-foreground">{{ s.items.length }} left</span>
          </div>
          <ul class="divide-y divide-border border-b border-border">
            <DegreeChecklistRow
              v-for="i in s.items"
              :key="i.id"
              :item="i"
              :selected="i.id === selectedId"
              @select="selectItem(i)"
            />
          </ul>
        </div>
      </div>

      <!-- 2. Options for the selected course (motion: slides out beside the list) -->
      <Transition mode="out-in" :css="false" @enter="slideEnter" @leave="slideLeave">
        <div v-if="item" :key="item.id" class="flex w-[300px] shrink-0 flex-col border-r border-border">
          <div class="flex flex-col gap-0.5 border-b border-border px-4 py-3 leading-normal">
            <p class="text-[14px] font-semibold">{{ item.label }}</p>
            <p class="text-[12px] text-muted-foreground">
              Recommended {{ item.rec.label }}<template v-if="candidates.length"> · {{ candidates.length }} option{{ candidates.length === 1 ? '' : 's' }}</template>
            </p>
          </div>
          <ul v-if="candidates.length" class="flex-1 divide-y divide-border overflow-y-auto">
            <li v-for="m in candidates" :key="m.key">
              <button
                type="button"
                class="flex w-full items-start gap-2 px-4 py-3 text-left transition-colors"
                :class="m.key === moduleKey ? 'bg-primary-tint' : 'hover:bg-muted'"
                :aria-pressed="m.key === moduleKey"
                @click="moduleKey = m.key"
              >
                <div class="min-w-0 flex-1 leading-normal">
                  <p v-if="m.code" class="font-mono text-[12px] font-bold">{{ m.code }}</p>
                  <p class="text-[13px] font-medium">{{ m.name }}</p>
                </div>
                <span
                  v-if="m.placement"
                  class="shrink-0 rounded-full px-1.5 text-[10.5px] font-semibold"
                  :class="m.placement.status === 'cleared' ? 'bg-success-tint text-foreground' : 'bg-primary-tint text-primary'"
                >{{ m.placement.semId }}</span>
              </button>
            </li>
          </ul>
          <p v-else class="px-4 py-4 text-[13px] leading-normal text-muted-foreground">
            {{ item.detail }}. Mark a semester as an exchange in Plan settings to count this.
          </p>
        </div>
      </Transition>

      <!-- 3. Details of the selected module -->
      <div class="min-w-0 flex-1 overflow-y-auto">
        <Transition mode="out-in" :css="false" @enter="slideEnter" @leave="slideLeave">
          <div v-if="selectedModule" :key="selectedModule.key" class="flex flex-col gap-4 p-6">
            <div class="flex flex-col gap-1.5">
              <p class="text-overline text-primary">
                {{ selectedModule.code || item.label }}<template v-if="!selectedModule.stub"> · {{ selectedModule.cu ?? 1 }} CU</template>
              </p>
              <h3 class="text-h3">{{ selectedModule.name }}</h3>
              <div class="flex flex-wrap items-center gap-2 pt-1">
                <StatusPill :tone="placementPill(selectedModule.placement)[0]">{{ placementPill(selectedModule.placement)[1] }}</StatusPill>
                <span
                  v-for="t in tags(selectedModule)"
                  :key="t"
                  class="rounded-full bg-secondary px-2.5 py-[3px] text-[12px] font-medium"
                >{{ t }}</span>
              </div>
            </div>

            <template v-if="!selectedModule.stub">
              <div class="flex flex-col gap-2">
                <p class="text-[13px] font-semibold">Description</p>
                <!-- TODO(backend): description / offered / median bid come from GET /api/modules/:code -->
                <p class="rounded-lg bg-muted px-3.5 py-3 text-[14px] leading-[22px]">
                  {{ selectedModule.description ?? 'Course description will be loaded from the module catalogue.' }}
                </p>
              </div>
              <dl class="grid grid-cols-2 gap-x-6 gap-y-3">
                <div v-for="f in facts(selectedModule)" :key="f.label" class="flex flex-col gap-0.5 leading-normal">
                  <dt class="text-[12px] text-muted-foreground">{{ f.label }}</dt>
                  <dd class="text-[14px] font-medium" :class="f.mono && 'font-mono'">{{ f.value }}</dd>
                </div>
              </dl>
            </template>
            <p v-else class="rounded-lg bg-muted px-3.5 py-3 text-[14px] leading-[22px]">
              Course details will be loaded from the module catalogue.
            </p>

            <div class="flex flex-col gap-1 rounded-lg border border-border px-3.5 py-3 leading-normal">
              <p class="text-overline text-muted-foreground">Counts as</p>
              <p class="text-[14px] font-medium">{{ item.label }}</p>
              <p class="text-[13px] text-muted-foreground">
                Recommended {{ item.rec.label }}<template v-if="item.how"> · {{ item.how === 'Bid' ? 'bid for it in BOSS' : item.how === 'PASG' ? 'pre-assigned by the school' : 'pre-assigned, or bid for it' }}</template>
              </p>
              <p v-if="item.note" class="text-[13px] text-muted-foreground">{{ item.note }}</p>
            </div>

            <div class="flex justify-end">
              <BaseButton
                :disabled="selectedModule.stub || !!selectedModule.placement || inBasket"
                @click="planner.addToBasket(selectedModule.code)"
              >
                {{ addLabel }}
              </BaseButton>
            </div>
          </div>
          <div v-else key="hint" class="flex h-full items-center justify-center p-8 text-center text-[13px] leading-normal text-muted-foreground">
            {{ item ? 'Pick a module to see more about it.' : 'Pick a course on the left to see what you can take for it.' }}
          </div>
        </Transition>
      </div>
    </div>
  </section>
</template>
