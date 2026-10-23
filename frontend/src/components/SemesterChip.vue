<script setup>
// Semester tag for a checklist item. Hover it to see every recommended semester in one row.
import { computed, ref } from 'vue'
import { SEM_IDS } from '@core/data/degree'
import { popEnter, popLeave } from '@/motion'
import { semesterTone } from '@/semesterTones'

const props = defineProps({
  item: { type: Object, required: true }, // needs item.chip { text, tone } and item.rec { ids, tone, label, now, placed }
})

const POPOVER_W = 436
const POPOVER_H = 124
const chip = ref(null)
const open = ref(false)
const pos = ref({})

// Opens beside the row (right of it) so it never covers the list being read
function show() {
  const r = chip.value.getBoundingClientRect()
  const rowRight = chip.value.closest('button')?.getBoundingClientRect().right ?? r.right
  const left = Math.max(8, Math.min(rowRight + 8, window.innerWidth - POPOVER_W - 8))
  const top = Math.max(8, Math.min(r.top + r.height / 2 - POPOVER_H / 2, window.innerHeight - POPOVER_H - 8))
  pos.value = { left: `${left}px`, top: `${top}px` }
  open.value = true
}

const years = [SEM_IDS.slice(0, 2), SEM_IDS.slice(2, 4), SEM_IDS.slice(4, 6), SEM_IDS.slice(6, 8)]
const summary = computed(() => {
  const { rec, chip: c } = props.item
  const when = { now: 'Recommended this semester', later: 'Coming up', late: 'Past the recommended term' }[rec.tone]
  if (c.tone === 'inProgress') return `In progress this semester (${rec.placed})`
  return c.tone === 'planned' ? `In your plan (${rec.placed}) · ${when.toLowerCase()}` : when
})
</script>

<template>
  <span class="inline-flex">
  <span
    ref="chip"
    class="rounded-[5px] border px-1.5 py-0.5 font-mono text-[11px] leading-none font-medium"
    :class="semesterTone[item.chip.tone]"
    :aria-label="`${summary}. Recommended ${item.rec.label}`"
    @mouseenter="show"
    @mouseleave="open = false"
  >{{ item.chip.text }}</span>

  <!-- Teleported so the scrolling list does not clip it. motion: pops in under the tag -->
  <Teleport to="body">
    <Transition :css="false" @enter="popEnter" @leave="popLeave">
      <div
        v-if="open"
        class="pointer-events-none fixed z-50 flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3.5 shadow-lg"
        :style="pos"
      >
        <div class="flex flex-col gap-0.5 leading-normal">
          <p class="text-[13px] font-semibold">Recommended {{ item.rec.label }}</p>
          <p class="text-[12px] text-muted-foreground">{{ summary }}</p>
        </div>
        <div class="flex gap-3">
          <div v-for="(year, yi) in years" :key="yi" class="flex gap-1">
            <div v-for="id in year" :key="id" class="flex flex-col items-center gap-1">
              <span
                class="flex h-8 w-11 items-center justify-center rounded-sm border font-mono text-[11px] font-medium"
                :class="item.rec.ids.includes(id) ? semesterTone[item.rec.tone] : 'border-border text-muted-foreground opacity-50'"
              >{{ id }}</span>
              <span class="h-3 text-[10px] leading-none font-semibold text-muted-foreground">
                {{ [id === item.rec.now && 'Now', id === item.rec.placed && 'Plan'].filter(Boolean).join(' · ') }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
  </span>
</template>
