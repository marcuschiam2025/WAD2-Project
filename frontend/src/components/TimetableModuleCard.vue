<script setup>
// v2 Components / Timetable Card: module card inside a timetable cell.
// booked = green accent; selected = opened in the sidebar; option = alternative section (dashed);
// clash = overlaps another booking; room = section accepted in a collab room (locked);
// chosen / chosen-success = filled slot picked in a collab room.
defineProps({
  code: { type: String, default: '' },
  section: { type: String, required: true },
  name: { type: String, default: '' },
  meta: { type: String, default: '' },
  variant: { type: String, default: 'booked' },
});
</script>

<template>
  <div
    class="relative flex min-h-0 w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded-sm px-2.5 py-2 text-left leading-normal transition-[background-color,border-color,opacity,filter] duration-200"
    :class="{
      'border-l-[3px] border-success bg-secondary': variant === 'booked',
      'border-l-[3px] border-destructive bg-destructive-tint': variant === 'clash',
      'border-2 border-primary bg-primary-tint': variant === 'selected',
      'border-2 border-dashed border-primary bg-primary-tint shadow-sm': variant === 'option',
      'border-2 border-success bg-success-tint': variant === 'room',
      'bg-primary text-primary-foreground': variant === 'chosen',
      'bg-success text-primary-foreground': variant === 'chosen-success',
    }"
  >
    <div class="flex items-start justify-between gap-1 whitespace-nowrap">
      <span
        class="min-w-0 truncate text-[12px] font-bold"
        :class="(variant === 'selected' || variant === 'option') && 'text-primary'"
        >{{ code || section }}</span
      >
      <span
        v-if="code"
        class="shrink-0 font-mono text-[11px]"
        :class="variant.startsWith('chosen') ? '' : 'text-muted-foreground'"
        >{{ section }}</span
      >
    </div>
    <p
      v-if="name"
      class="truncate text-[11.5px] font-medium"
      :class="variant.startsWith('chosen') ? '' : variant === 'option' ? 'text-primary' : 'text-foreground'"
    >
      {{ name }}
    </p>
    <p
      v-if="meta"
      class="truncate text-[10.5px]"
      :class="variant.startsWith('chosen') ? '' : 'text-muted-foreground'"
    >
      {{ meta }}
    </p>
    <slot />
  </div>
</template>
