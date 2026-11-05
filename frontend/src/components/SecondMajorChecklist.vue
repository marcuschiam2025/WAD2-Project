<script setup>
// A plan's second major: progress per requirement and how its courses double-count with the first major
import { computed } from 'vue';
import { usePlannerStore } from '@core/stores/planner';
import StatusPill from '@/components/ui/StatusPill.vue';

const planner = usePlannerStore();
const progress = computed(() => planner.secondMajorProgress);

const STATUS = {
  cleared: { text: 'Cleared', tone: 'success' },
  inProgress: { text: 'In progress', tone: 'warning' },
  planned: { text: 'Planned', tone: 'info' },
  todo: { text: 'Not in your plan yet', tone: 'neutral' },
};
const USE = {
  major: 'also counts for your 1st major',
  track: 'also counts for your 1st major',
  free: 'also counts as a Free Elective',
  addOn: 'add-on',
};
</script>

<template>
  <section v-if="progress" v-enter="0.2" class="card flex flex-col gap-4 p-6">
    <div class="flex flex-col gap-0.5">
      <h2 class="text-[17px] font-semibold">Second Major</h2>
      <p class="text-[13px] text-muted-foreground">
        {{ progress.name }}<template v-if="progress.track"> · {{ progress.track }}</template>
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <StatusPill tone="success">{{ progress.totals.cleared }} cleared</StatusPill>
      <StatusPill tone="warning">{{ progress.totals.inProgress }} in progress</StatusPill>
      <StatusPill tone="info">{{ progress.totals.planned }} planned</StatusPill>
      <StatusPill tone="neutral">{{ progress.totals.todo }} not in your plan yet</StatusPill>
      <StatusPill v-if="progress.addOnCu" tone="neutral">
        {{ progress.addOnCu }} CU add-on, on top of your degree
      </StatusPill>
    </div>

    <p v-if="progress.overLimitCu" role="alert" class="text-[13px] text-destructive">
      At least 3 CU of a second major must not double-count with your 1st major. You are
      {{ progress.overLimitCu }} CU over: add a course that doesn't count for your 1st major.
    </p>

    <ul class="flex flex-col divide-y divide-border">
      <li v-for="row in progress.rows" :key="row.id" class="flex flex-col gap-1.5 py-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-[14px] font-medium">{{ row.label }}</span>
          <StatusPill :tone="STATUS[row.status].tone">{{ STATUS[row.status].text }}</StatusPill>
        </div>
        <p v-for="t in row.taken" :key="t.code" class="text-[13px] text-muted-foreground">
          {{ t.code }} {{ t.name }} · {{ t.semId }}<template v-if="USE[t.use]"> · {{ USE[t.use] }}</template>
        </p>
        <p v-if="row.options.length" class="text-[13px] text-muted-foreground">
          Options: {{ row.options.map((o) => o.code).join(', ') }}
        </p>
      </li>
    </ul>

    <p v-for="b in progress.blocked" :key="b.code" class="text-[13px] text-muted-foreground">
      {{ b.code }} doesn't count for this second major because it {{ b.reason }}.
    </p>
  </section>
</template>
