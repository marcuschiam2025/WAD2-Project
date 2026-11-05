<script setup>
// What-If Planner / Degree checklist: only the courses still to clear (cleared = in a semester before the current one).
// Click a course on the left -> a second column lists the modules you could take for it -> click one for its details.
// The lines and the modules that fill them come from the backend's curriculum and catalogue.
import { computed, ref, watch } from 'vue';
import { usePlannerStore } from '@core/stores/planner';
import { useUserStore } from '@core/stores/user';
import { useCatalogueStore } from '@core/stores/catalogue';
import { bidHistory } from '@core/data/bidding';
import { useBiddingStore } from '@core/stores/bidding';
import { api } from '@core/services/api';
import { MARK_DONE } from '@core/data/degree';
import { candidatesFor } from '@core/utils/degreeChecklist';
import { slideEnter, slideLeave } from '@/motion';
import { semesterTone, semesterToneLabel } from '@/semesterTones';
import StatusPill from '@/components/ui/StatusPill.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import DegreeChecklistRow from '@/components/DegreeChecklistRow.vue';

const planner = usePlannerStore();
const user = useUserStore();
const catalogue = useCatalogueStore();
const bidding = useBiddingStore();
const plan = computed(() => planner.activePlan);
const checklist = computed(() => planner.checklist);
const totals = computed(() => checklist.value.totals);
const pct = (n) => `${totals.value.required ? (n / totals.value.required) * 100 : 0}%`;

// Optional filters, remembered in this browser: hide the lines being taken this semester, and the ones planned
// for a later semester. Cleared lines are always hidden.
function remembered(key) {
  let start = false;
  try {
    start = localStorage.getItem(key) === 'true';
  } catch {
    // storage blocked: the toggle still works for this visit
  }
  const flag = ref(start);
  watch(flag, (on) => {
    try {
      localStorage.setItem(key, String(on));
    } catch {
      // storage blocked
    }
  });
  return flag;
}
const hideInProgress = remembered('bidmaxxer:hideInProgress');
const hidePlanned = remembered('bidmaxxer:hidePlanned');
const filters = [
  { label: 'Hide in progress', flag: hideInProgress, tone: 'warning' },
  { label: 'Hide planned', flag: hidePlanned, tone: 'primary' },
];

// Cleared lines are hidden; in progress and planned ones only if their filter is on
const shown = (s) =>
  s.status !== 'cleared' &&
  s.status !== 'exempted' &&
  !(hideInProgress.value && s.status === 'inProgress') &&
  !(hidePlanned.value && s.status === 'planned');
const sections = computed(() =>
  [
    ...checklist.value.groups.map((g) => ({ key: g.key, label: g.label, items: g.slots.filter(shown) })),
    { key: 'other', label: 'Graduation requirements & exposure', items: checklist.value.other.filter(shown) },
  ].filter((s) => s.items.length),
);
const left = computed(() => totals.value.inProgress + totals.value.planned + totals.value.todo);

const selectedId = ref(null);
const moduleKey = ref(null);
const item = computed(
  () => sections.value.flatMap((s) => s.items).find((i) => i.id === selectedId.value) ?? null,
);
// The modules that can fill a checklist line, from the backend catalogue
const candidatesOf = (i) =>
  candidatesFor(i, plan.value, planner.checklistCatalogue, planner.exempted).filter(
    (m) => !planner.checklistCatalogue[m.code]?.archived || m.placement,
  );

const candidates = computed(() => (item.value ? candidatesOf(item.value) : []));
// Long lists (baskets, electives) get a filter box
const optionQuery = ref('');
const shownCandidates = computed(() => {
  const q = optionQuery.value.trim().toLowerCase();
  if (!q) return candidates.value;
  return candidates.value.filter((m) => m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
});
const selectedModule = computed(() => candidates.value.find((m) => m.key === moduleKey.value) ?? null);

// The list leaves descriptions out, so fetch the picked module from GET /api/modules/:code
watch(selectedModule, (m) => {
  if (!m) return;
  catalogue.loadDetail(m.code);
  if (!bidHistory[m.code])
    api
      .bidHistory(m.code)
      .then(
        (rows) =>
          (bidHistory[m.code] = rows.map(({ term, round, median, min }) => ({ term, round, median, min }))),
      )
      .catch(() => {});
});
const description = computed(() => {
  const m = selectedModule.value;
  const d = m && catalogue.details[m.code];
  if (!d) return 'Loading the course description…';
  return d.description || 'No description in the catalogue yet.';
});

// Below lg the columns stack, so bring a panel that just opened into view
function revealStacked(el) {
  if (window.matchMedia('(max-width: 1023.98px)').matches)
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function selectItem(i) {
  if (selectedId.value === i.id) {
    selectedId.value = null;
    moduleKey.value = null;
    return;
  }
  selectedId.value = i.id;
  optionQuery.value = '';
  const list = candidatesOf(i);
  moduleKey.value = list.length === 1 ? list[0].key : null;
}

watch(
  () => planner.activePlanId,
  () => {
    selectedId.value = null;
    moduleKey.value = null;
  },
);

// Catalogue tags in the database -> readable labels
const FULFILS_LABEL = {
  'CORE:MANAGING': 'Managing basket',
  'CORE:TECH_SCIENCE_SOCIETY': 'Technology, Science & Society basket',
  'CORE:CULTURES_MODERN_WORLD': 'Cultures of the Modern World basket',
  'CORE:INTERNSHIP': 'Internship',
  'CORE:GLOBAL_EXPOSURE': 'Global Exposure',
  'GRAD:SUSTAINABILITY': 'Sustainability',
  'GRAD:SG_ASIA_STUDIES': 'Singapore & Asia Studies',
  'GRAD:DIGITAL_TECH': 'Digital Technology',
};
const CATEGORY_LABEL = {
  IS: 'IS course',
  IS_TRACK: 'IS track course',
  IS_RELATED: 'IS related course',
  CS: 'CS course',
  SMT: 'SMT course',
  SE: 'SE course',
  LAW: 'Law course',
  COMMUNITIES_BASKET: 'Communities course',
};

// Internship, Community Service and Global Exposure can be marked as done; the line then counts as cleared
// and leaves the list (undo it from the profile page)
function markDone(i) {
  user.markDone(i.manualDoneId ?? i.id);
  selectedId.value = null;
  moduleKey.value = null;
}

const tags = (m) => [
  ...m.categories.map((c) => CATEGORY_LABEL[c] ?? c),
  ...m.fulfils.map((f) => FULFILS_LABEL[f] ?? f),
];

const placementPill = (p) =>
  !p
    ? ['neutral', 'Not in your plan']
    : {
        cleared: ['success', `Cleared · ${p.semId}`],
        exempted: ['exempt', 'Exempted'],
        inProgress: ['warning', `In progress · ${p.semId}`],
        planned: ['info', `Planned · ${p.semId}`],
      }[p.status];

// [['IS111', 'CS101'], ['IS217']] -> "IS111 or CS101, and IS217"
const requisiteText = (groups) => groups.map((g) => g.join(' or ')).join(', and ') || 'None';
const offeredText = (terms) =>
  terms.length ? `Term ${terms.map((t) => t.replace(/^T/, '')).join(' & ')}` : 'Not listed';

// The newest result for the current round if there is one, else the newest of any round
function lastMedian(code) {
  const rows = bidHistory[code] ?? [];
  const row = rows.find((r) => r.round === bidding.round.round) ?? rows[0];
  return row ? `e$ ${row.median} · Round ${row.round}` : '-';
}

const facts = (m) => [
  { label: 'Offered', value: offeredText(m.termsOffered) },
  { label: 'Median bid', value: lastMedian(m.code), mono: !!bidHistory[m.code]?.length },
  { label: 'Prerequisites', value: requisiteText(m.prerequisites) },
  { label: 'Co-requisites', value: requisiteText(m.corequisites) },
];

const inBasket = computed(() => !!selectedModule.value && planner.basket.includes(selectedModule.value.code));
const addLabel = computed(() => {
  if (selectedModule.value?.placement) return 'Already in your plan';
  return inBasket.value ? 'In your module basket' : 'Add to module basket';
});
</script>

<template>
  <section v-if="!checklist.unavailable" v-enter="0.2" class="card flex flex-col gap-4 p-6">
    <!-- motion: checklist card fades in, 200ms delay -->
    <div class="flex flex-col gap-0.5">
      <h2 class="text-[17px] font-semibold">Outstanding Modules</h2>
      <p class="text-[13px] text-muted-foreground">
        {{ plan.name }} · {{ left }} of {{ totals.required }} courses still to clear. Pick one to see what you
        can take for it.
      </p>
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex h-2 overflow-hidden rounded-full bg-border">
        <span class="bg-success transition-[width] duration-500" :style="{ width: pct(totals.cleared) }" />
        <span
          class="bg-exempt transition-[width] duration-500"
          :style="{ width: pct(totals.exempted ?? 0) }"
        />
        <span class="bg-warning transition-[width] duration-500" :style="{ width: pct(totals.inProgress) }" />
        <span class="bg-primary transition-[width] duration-500" :style="{ width: pct(totals.planned) }" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <StatusPill tone="success">{{ totals.cleared }} cleared</StatusPill>
        <StatusPill v-if="totals.exempted" tone="exempt">{{ totals.exempted }} exempted</StatusPill>
        <StatusPill tone="warning">{{ totals.inProgress }} in progress</StatusPill>
        <StatusPill tone="info">{{ totals.planned }} planned</StatusPill>
        <StatusPill tone="neutral">{{ totals.todo }} not in your plan yet</StatusPill>
        <StatusPill v-if="totals.late" tone="destructive"
          >{{ totals.late }} behind the recommended term</StatusPill
        >
        <div class="ml-auto flex flex-wrap items-center gap-2">
          <button
            v-for="f in filters"
            :key="f.label"
            type="button"
            :aria-pressed="f.flag.value"
            class="flex items-center gap-2 rounded-md border px-2.5 py-1 text-[12.5px] font-medium transition-colors"
            :class="
              f.flag.value
                ? f.tone === 'warning'
                  ? 'border-warning bg-warning-tint'
                  : 'border-primary bg-primary-tint'
                : 'border-border hover:bg-muted'
            "
            @click="f.flag.value = !f.flag.value"
          >
            <span
              class="flex size-3.5 items-center justify-center rounded-[3px] border text-[10px] leading-none"
              :class="
                f.flag.value
                  ? f.tone === 'warning'
                    ? 'border-warning bg-warning text-primary-foreground'
                    : 'border-primary bg-primary text-primary-foreground'
                  : 'border-border'
              "
              >{{ f.flag.value ? '✓' : '' }}</span
            >
            {{ f.label }}
          </button>
        </div>
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
      <template v-if="left"
        >Nothing to show: everything left is hidden by "Hide in progress" or "Hide planned". Turn a filter off
        to see it.</template
      >
      <template v-else>All {{ totals.required }} courses are cleared.</template>
    </p>

    <div
      v-else
      class="flex flex-col overflow-hidden rounded-lg border border-border lg:h-[560px] lg:flex-row"
    >
      <!-- 1. Courses still to clear -->
      <div
        class="max-h-[420px] w-full shrink-0 overflow-y-auto border-b border-border lg:max-h-none lg:w-[340px] lg:border-r lg:border-b-0"
      >
        <div v-for="s in sections" :key="s.key">
          <div
            class="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-muted px-4 py-2"
          >
            <h3 class="text-overline text-muted-foreground">{{ s.label }}</h3>
            <span class="font-mono text-[11px] font-medium text-muted-foreground"
              >{{ s.items.length }} left</span
            >
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
      <Transition
        mode="out-in"
        :css="false"
        @enter="slideEnter"
        @leave="slideLeave"
        @after-enter="revealStacked"
      >
        <div
          v-if="item"
          :key="item.id"
          class="flex max-h-[420px] w-full shrink-0 flex-col border-b border-border lg:max-h-none lg:w-[300px] lg:border-r lg:border-b-0"
        >
          <div class="flex flex-col gap-0.5 border-b border-border px-4 py-3 leading-normal">
            <p class="text-[14px] font-semibold">{{ item.label }}</p>
            <p class="text-[12px] text-muted-foreground">
              {{ item.rec ? 'Recommended ' + item.rec.label : 'No recommended semester specified'
              }}<template v-if="candidates.length">
                · {{ candidates.length }} option{{ candidates.length === 1 ? '' : 's' }}</template
              >
            </p>
            <BaseButton
              v-if="(item.manualDoneId ?? item.id) in MARK_DONE"
              size="sm"
              variant="outline"
              class="mt-2 self-start"
              @click="markDone(item)"
            >
              Mark as done
            </BaseButton>
          </div>
          <div v-if="candidates.length > 12" class="border-b border-border px-4 py-2">
            <input
              v-model="optionQuery"
              :placeholder="`Filter ${candidates.length} courses...`"
              class="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus:border-ring"
            />
          </div>
          <ul v-if="shownCandidates.length" class="flex-1 divide-y divide-border overflow-y-auto">
            <li v-for="m in shownCandidates" :key="m.key">
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
                  :class="
                    {
                      cleared: 'bg-success-tint text-foreground',
                      exempted: 'bg-exempt-tint text-exempt',
                      inProgress: 'bg-warning-tint text-warning',
                      planned: 'bg-primary-tint text-primary',
                    }[m.placement.status]
                  "
                  >{{ m.placement.semId }}</span
                >
              </button>
            </li>
          </ul>
          <p v-else-if="candidates.length" class="px-4 py-4 text-[13px] text-muted-foreground">
            No course matches "{{ optionQuery }}".
          </p>
          <p v-else class="px-4 py-4 text-[13px] leading-normal text-muted-foreground">
            {{ item.detail }}.<template v-if="item.requirement?.tag === 'CORE:GLOBAL_EXPOSURE'">
              Mark a semester as an exchange in Plan settings to count this.</template
            >
          </p>
        </div>
      </Transition>

      <!-- 3. Details of the selected module -->
      <div class="min-w-0 flex-1 overflow-y-auto">
        <Transition
          mode="out-in"
          :css="false"
          @enter="slideEnter"
          @leave="slideLeave"
          @after-enter="revealStacked"
        >
          <div v-if="selectedModule" :key="selectedModule.key" class="flex flex-col gap-4 p-6">
            <div class="flex flex-col gap-1.5">
              <p class="text-overline text-primary">
                {{ selectedModule.code || item.label }} · {{ selectedModule.cu ?? 1 }} CU
              </p>
              <h3 class="text-h3">{{ selectedModule.name }}</h3>
              <div class="flex flex-wrap items-center gap-2 pt-1">
                <StatusPill :tone="placementPill(selectedModule.placement)[0]">{{
                  placementPill(selectedModule.placement)[1]
                }}</StatusPill>
                <span
                  v-for="t in tags(selectedModule)"
                  :key="t"
                  class="rounded-full bg-secondary px-2.5 py-[3px] text-[12px] font-medium"
                  >{{ t }}</span
                >
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <p class="text-[13px] font-semibold">Description</p>
              <p class="rounded-lg bg-muted px-3.5 py-3 text-[14px] leading-[22px] whitespace-pre-line">
                {{ description }}
              </p>
            </div>
            <dl class="grid grid-cols-2 gap-x-6 gap-y-3">
              <div
                v-for="f in facts(selectedModule)"
                :key="f.label"
                class="flex flex-col gap-0.5 leading-normal"
              >
                <dt class="text-[12px] text-muted-foreground">{{ f.label }}</dt>
                <dd class="text-[14px] font-medium" :class="f.mono && 'font-mono'">{{ f.value }}</dd>
              </div>
            </dl>

            <div class="flex flex-col gap-1 rounded-lg border border-border px-3.5 py-3 leading-normal">
              <p class="text-overline text-muted-foreground">Counts as</p>
              <p class="text-[14px] font-medium">{{ item.label }}</p>
              <p class="text-[13px] text-muted-foreground">
                {{ item.rec ? 'Recommended ' + item.rec.label : 'No recommended semester specified'
                }}<template v-if="item.how">
                  ·
                  {{
                    item.how === 'Bid'
                      ? 'bid for it in BOSS'
                      : item.how === 'PASG'
                        ? 'pre-assigned by the school'
                        : 'pre-assigned, or bid for it'
                  }}</template
                >
              </p>
              <p v-if="item.note" class="text-[13px] text-muted-foreground">{{ item.note }}</p>
            </div>

            <div class="flex justify-end">
              <BaseButton
                :disabled="!!selectedModule.placement || inBasket"
                @click="planner.addToBasket(selectedModule.code)"
              >
                {{ addLabel }}
              </BaseButton>
            </div>
          </div>
          <div
            v-else
            key="hint"
            class="flex h-full items-center justify-center p-8 text-center text-[13px] leading-normal text-muted-foreground"
          >
            {{
              item ? 'Pick a module to see more about it.' : 'Pick a course to see what you can take for it.'
            }}
          </div>
        </Transition>
      </div>
    </div>
  </section>
  <section v-else class="card p-6">
    <h2 class="text-[17px] font-semibold">Degree Requirements</h2>
    <p class="mt-2 text-sm text-muted-foreground">{{ checklist.unavailableReason }}</p>
  </section>
</template>
