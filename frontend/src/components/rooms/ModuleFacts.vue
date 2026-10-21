<script setup>
// Shown under the module picker when creating a room: have you taken it, when is it recommended,
// and which graduation requirements it fulfils.
import { computed } from 'vue'
import { usePlannerStore } from '@core/stores/planner'
import { modules } from '@core/data/catalogue'
import { GRAD_LABELS } from '@core/data/degree'
import { moduleFacts } from '@core/utils/degreeChecklist'
import StatusPill from '@/components/ui/StatusPill.vue'
import SemesterChip from '@/components/SemesterChip.vue'

const props = defineProps({
  code: { type: String, required: true },
})

const planner = usePlannerStore()
const facts = computed(() => moduleFacts(modules[props.code], planner.activePlan, modules))

const taken = computed(() => {
  const t = facts.value.taken
  if (!t) return ['neutral', 'Not taken, and not in your plan']
  return t.status === 'cleared' ? ['success', `Taken · ${t.semId}`] : ['info', `Not yet · planned for ${t.semId}`]
})
</script>

<template>
  <dl class="flex flex-col divide-y divide-border rounded-lg border border-border text-[13px]">
    <div class="flex items-center justify-between gap-4 px-3.5 py-2.5">
      <dt class="shrink-0 whitespace-nowrap text-muted-foreground">Taken before</dt>
      <dd><StatusPill :tone="taken[0]">{{ taken[1] }}</StatusPill></dd>
    </div>

    <div class="flex items-start justify-between gap-4 px-3.5 py-2.5">
      <dt class="shrink-0 whitespace-nowrap text-muted-foreground">Recommended semester</dt>
      <dd v-if="facts.rec" class="flex min-w-0 flex-col items-end gap-1 leading-normal">
        <SemesterChip :item="{ chip: facts.chip, rec: facts.rec }" />
        <span class="text-right text-[12px] text-muted-foreground">{{ facts.rec.label }} · counts as {{ facts.countsAs.join(', ') }}</span>
      </dd>
      <dd v-else class="text-right text-muted-foreground">Not in the standard IS course sequence</dd>
    </div>

    <div class="flex items-start justify-between gap-4 px-3.5 py-2.5">
      <dt class="shrink-0 whitespace-nowrap text-muted-foreground">Graduation requirements</dt>
      <dd v-if="facts.grad.length" class="flex flex-wrap justify-end gap-1.5">
        <span v-for="g in facts.grad" :key="g" class="rounded-full bg-secondary px-2.5 py-[3px] text-[12px] font-medium">{{ GRAD_LABELS[g] }}</span>
      </dd>
      <dd v-else class="text-muted-foreground">None</dd>
    </div>
  </dl>
</template>
