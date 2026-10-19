<script setup>
// Ranked track match row. The bar fill is the match %.
import ProgressBar from '@/components/ui/ProgressBar.vue'

defineProps({
  rank: { type: Number, required: true },
  track: { type: String, required: true },
  pct: { type: Number, required: true },
  barWidth: { type: String, default: 'w-[240px]' },
  bordered: { type: Boolean, default: true },
})
</script>

<template>
  <div class="flex items-center gap-3 rounded-md bg-card px-3.5 py-2.5 leading-normal" :class="bordered && 'border border-border'">
    <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold">
      {{ rank }}
    </span>
    <span class="min-w-0 flex-1 text-[14px] font-semibold">{{ track }}</span>
    <ProgressBar :value="pct / 100" :track="`${barWidth} h-2 shrink-0`" />
    <span class="w-10 shrink-0 font-mono text-[13px] font-medium">{{ pct }}%</span>
  </div>
</template>
