<script setup>
// Timetable of a module's sections where a room member ticks the slots they'd take.
import { computed } from 'vue'
import { sections } from '@/data/bidding'
import { moduleName } from '@/data/catalogue'
import TimetableGrid from '@/components/TimetableGrid.vue'
import TimetableModuleCard from '@/components/TimetableModuleCard.vue'

const props = defineProps({
  module: { type: String, required: true },
  readonly: Boolean,
  chosenVariant: { type: String, default: 'chosen' }, // chosen | chosen-success
})
const selected = defineModel({ type: Array, default: () => [] })

const moduleSections = computed(() => sections.filter((s) => s.module === props.module))

function toggle(id) {
  if (props.readonly) return
  selected.value = selected.value.includes(id) ? selected.value.filter((x) => x !== id) : [...selected.value, id]
}
</script>

<template>
  <TimetableGrid>
    <template #cell="{ day, slot }">
      <button
        v-for="s in moduleSections.filter((x) => x.day === day && x.slot === slot)"
        :key="s.id"
        type="button"
        role="checkbox"
        :aria-checked="selected.includes(s.id)"
        :disabled="readonly"
        class="relative block w-full disabled:cursor-default"
        @click="toggle(s.id)"
      >
        <TimetableModuleCard
          :code="s.module"
          :section="s.section"
          :name="moduleName(s.module)"
          :meta="`${s.profShort} · ${s.venueShort}`"
          :variant="selected.includes(s.id) ? chosenVariant : 'option'"
        />
        <span
          class="absolute right-2 bottom-2 flex size-4 items-center justify-center rounded-[3px] border text-[13px] leading-none"
          :class="selected.includes(s.id) ? 'border-primary-foreground bg-primary-foreground text-primary' : 'border-border bg-primary-foreground'"
        >
          <template v-if="selected.includes(s.id)">✓</template>
        </span>
      </button>
    </template>
  </TimetableGrid>
</template>
