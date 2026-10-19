<script setup>
// Weekly grid: rows are BOSS session slots, columns are weekdays.
// Use the #cell slot to render cards for a given { day, slot }.
import { days, slots } from '@/data/bidding'

defineEmits(['cell-drop', 'cell-dragover'])
</script>

<template>
  <div class="card overflow-hidden">
    <div class="flex bg-muted">
      <div class="w-[88px] shrink-0 px-3 py-2.5 text-overline text-muted-foreground">TIME</div>
      <div v-for="d in days" :key="d" class="flex-1 border-l border-border px-3 py-2.5 text-[13px] font-semibold">
        {{ d }}
      </div>
    </div>
    <div v-for="(s, si) in slots" :key="s.start" class="flex h-32 border-t border-border">
      <div class="flex w-[88px] shrink-0 flex-col gap-0.5 px-3 py-2.5 font-mono text-[12px] font-medium">
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
</template>
