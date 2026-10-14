<script setup>
// Module code chip for planner semester columns and the requirement overview.
// completed = past sem (greyed), warning = prereq not met, dragging = active drag.
import iconCheck from '@/assets/figma/check-success.svg'
import iconAlert from '@/assets/figma/alert-12.svg'

defineProps({
  code: { type: String, default: '' },
  state: { type: String, default: 'default' }, // default | completed | warning | dragging
})
</script>

<template>
  <div
    class="flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[12.5px] font-medium whitespace-nowrap"
    :class="{
      'bg-secondary text-foreground': state === 'default',
      'bg-muted text-muted-foreground': state === 'completed',
      'border border-warning bg-warning-soft text-foreground': state === 'warning',
      'border-2 border-primary bg-primary-soft text-foreground': state === 'dragging',
    }"
  >
    <img v-if="state === 'completed'" :src="iconCheck" alt="" class="size-3" />
    <img v-if="state === 'warning'" :src="iconAlert" alt="" class="size-3" />
    <slot>{{ code }}</slot>
  </div>
</template>
