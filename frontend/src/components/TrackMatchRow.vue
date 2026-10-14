<script setup>
// Ranked track match row. The bar fill is the match %.
defineProps({
  rank: { type: Number, required: true },
  track: { type: String, required: true },
  pct: { type: Number, required: true },
  bordered: { type: Boolean, default: true },
})
</script>

<template>
  <div
    class="flex h-[30px] items-center gap-4 rounded-md bg-card px-4"
    :class="bordered && 'border border-border'"
  >
    <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold">
      {{ rank }}
    </span>
    <span class="min-w-0 flex-1 text-[15px] font-semibold">{{ track }}</span>
    <span class="relative h-2 w-[220px] shrink-0 overflow-hidden rounded-full bg-muted">
      <span class="absolute inset-y-0 left-0 rounded-full bg-primary" :style="{ width: `${pct}%` }" />
    </span>
    <span class="w-11 shrink-0 text-right font-mono text-[14px] font-medium">{{ pct }}%</span>
  </div>
</template>
