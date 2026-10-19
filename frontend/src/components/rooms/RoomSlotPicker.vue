<script setup>
// Timetable of a module's sections where a room member ticks the slots they'd take.
import { computed } from 'vue'
import { days, slots, sections } from '@core/data/bidding'
import { moduleName } from '@core/data/catalogue'
import TimetableGrid from '@/components/TimetableGrid.vue'

const props = defineProps({
  module: { type: String, required: true },
  readonly: Boolean,
})
const selected = defineModel({ type: Array, default: () => [] })

// TODO(backend): sections come from GET /api/bidding/sections?module=… (sample data for now)
const moduleSections = computed(() => sections.filter((s) => s.module === props.module))

function toggle(id) {
  if (props.readonly) return
  selected.value = selected.value.includes(id) ? selected.value.filter((x) => x !== id) : [...selected.value, id]
}

const label = (s) => `${days[s.day].slice(0, 3)} ${slots[s.slot].start}–${slots[s.slot].end}`
</script>

<template>
  <TimetableGrid short row-height="h-[104px]">
    <template #cell="{ day, slot }">
      <button
        v-for="s in moduleSections.filter((x) => x.day === day && x.slot === slot)"
        :key="s.id"
        type="button"
        role="checkbox"
        :aria-checked="selected.includes(s.id)"
        :disabled="readonly"
        class="flex w-full flex-col gap-0.5 rounded-sm px-2.5 py-2 text-left text-[11px] leading-normal transition-colors disabled:cursor-default"
        :class="
          selected.includes(s.id)
            ? 'bg-primary text-primary-foreground'
            : 'border-[1.5px] border-dashed border-border text-muted-foreground hover:border-primary hover:text-foreground'
        "
        @click="toggle(s.id)"
      >
        <span class="flex items-center gap-1.5 font-mono text-[12px] font-bold">
          {{ s.section }}<span v-if="selected.includes(s.id)">✓</span>
        </span>
        <span>{{ moduleName(s.module) }}</span>
        <span>{{ label(s) }}</span>
      </button>
    </template>
  </TimetableGrid>
</template>
