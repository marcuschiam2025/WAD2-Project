<script setup>
// Draggable module in the What-If Planner basket. Drag onto a semester column.
import iconGrip from '@/assets/figma/icon-grip.svg'

defineProps({
  code: { type: String, required: true },
  name: { type: String, required: true },
})
</script>

<template>
  <div
    class="flex cursor-grab items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2.5 drop-shadow-[0_1px_1px_rgba(20,20,24,0.05)] active:cursor-grabbing"
  >
    <img :src="iconGrip" alt="" class="size-4" />
    <div class="flex flex-col gap-0.5 whitespace-nowrap">
      <span class="text-[13px] font-semibold">{{ code }}</span>
      <span class="text-[12px] text-muted-foreground">{{ name }}</span>
    </div>
  </div>
</template>
