<script setup>
import { onMounted, ref, watch } from 'vue'
import { animate } from 'motion'
import { ease } from '@/motion'

const props = defineProps({
  value: { type: Number, required: true }, // 0–1
  color: { type: String, default: 'bg-primary' },
  track: { type: String, default: 'w-full h-2' },
})

const fill = ref(null)
const pct = () => `${Math.min(1, Math.max(0, props.value)) * 100}%`

// Grow from empty on mount, then ease to each new value
onMounted(() => animate(fill.value, { width: ['0%', pct()] }, { duration: 0.7, ease }))
watch(
  () => props.value,
  () => animate(fill.value, { width: pct() }, { duration: 0.4, ease }),
)
</script>

<template>
  <div class="relative overflow-hidden rounded-full bg-muted" :class="track">
    <div ref="fill" class="absolute inset-y-0 left-0 rounded-full" :class="color" :style="{ width: pct() }" />
  </div>
</template>
