<script setup>
// v2 Components / Timetable Card — module card inside a timetable cell.
// booked = green accent; selected = opened in the sidebar; option = alternative section (dashed);
// clash = overlaps another booking; chosen / chosen-success = filled slot picked in a collab room.
defineProps({
  code: { type: String, default: '' },
  section: { type: String, required: true },
  name: { type: String, default: '' },
  meta: { type: String, default: '' },
  variant: { type: String, default: 'booked' },
})
</script>

<template>
  <div
    class="relative flex w-full flex-col gap-0.5 overflow-hidden rounded-sm px-2.5 py-2 text-left leading-normal transition-[background-color,border-color,opacity]"
    :class="{
      'border-l-[3px] border-success bg-secondary': variant === 'booked',
      'border-l-[3px] border-destructive bg-destructive/10': variant === 'clash',
      'border-2 border-primary bg-primary/10': variant === 'selected',
      'border-[1.5px] border-dashed border-border text-muted-foreground': variant === 'option',
      'bg-primary text-primary-foreground': variant === 'chosen',
      'bg-success text-primary-foreground': variant === 'chosen-success',
    }"
  >
    <div class="flex items-start justify-between whitespace-nowrap">
      <span class="text-[12px] font-bold" :class="variant === 'selected' && 'text-primary'">{{ code || section }}</span>
      <span
        v-if="code"
        class="font-mono text-[11px]"
        :class="variant.startsWith('chosen') ? '' : 'text-muted-foreground'"
      >{{ section }}</span>
    </div>
    <p v-if="name" class="text-[11.5px] font-medium" :class="variant === 'option' ? '' : 'text-foreground'">{{ name }}</p>
    <p v-if="meta" class="text-[10.5px]" :class="variant.startsWith('chosen') ? '' : 'text-muted-foreground'">{{ meta }}</p>
    <slot />
  </div>
</template>
