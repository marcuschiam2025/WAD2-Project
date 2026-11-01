<script setup>
// Weekly grid: rows are BOSS session slots, columns are weekdays.
// Use the #cell slot to render cards for a given { day, slot } (both are indexes).
import { days, slots } from '@core/data/bidding'

defineProps({
  short: Boolean, // Mon/Tue… instead of Monday/Tuesday…
  rowHeight: { type: String, default: 'h-[100px]' },
})
defineEmits(['cell-drop', 'cell-dragover'])
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-border bg-card">
   <div class="min-w-[720px]">
    <div class="flex bg-muted">
      <div class="w-[68px] shrink-0 px-2.5 py-2.5 text-overline text-muted-foreground">Time</div>
      <div v-for="d in days" :key="d" class="min-w-0 flex-1 border-l border-border px-2.5 py-2.5 text-[13px] font-semibold">
        {{ short ? d.slice(0, 3) : d }}
      </div>
    </div>
    <div v-for="(s, si) in slots" :key="s.start" class="flex border-t border-border" :class="rowHeight">
      <div class="flex w-[68px] shrink-0 flex-col gap-0.5 px-2.5 py-2.5 font-mono text-[11px] leading-normal font-medium">
        <span>{{ s.start }}</span>
        <span class="text-muted-foreground">{{ s.end }}</span>
      </div>
      <div
        v-for="(d, di) in days"
        :key="d"
        class="relative flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden border-l border-border p-1.5"
        @dragover.prevent="$emit('cell-dragover', { day: di, slot: si })"
        @drop.prevent="$emit('cell-drop', { day: di, slot: si })"
      >
        <slot name="cell" :day="di" :slot="si" />
      </div>
    </div>
   </div>
  </div>
</template>
