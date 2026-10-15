<script setup>
defineProps({
  value: { type: Number, required: true }, // 0–1
  color: { type: String, default: 'bg-primary' },
  track: { type: String, default: 'w-[260px] h-2' },
})
</script>

<template>
  <div class="relative overflow-hidden rounded-full bg-muted" :class="track">
    <div
      class="absolute inset-y-0 left-0 rounded-full transition-[width]"
      :class="color"
      :style="{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }"
    />
  </div>
</template>
