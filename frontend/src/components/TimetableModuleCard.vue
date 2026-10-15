<script setup>
// Module card inside a timetable cell.
// booked = green accent; option = alternative section (dashed); selected = opened in sidebar;
// chosen / chosen-success = filled slot picked in a collab room; clash = overlaps another booking.
defineProps({
  code: { type: String, required: true },
  section: { type: String, required: true },
  name: { type: String, required: true },
  meta: { type: String, default: '' },
  variant: { type: String, default: 'booked' },
})
</script>

<template>
  <div
    class="flex w-full flex-col gap-1 rounded-sm px-2.5 py-2 text-left leading-normal"
    :class="{
      'border-l-3 border-success bg-secondary': variant === 'booked',
      'border-l-3 border-destructive bg-destructive-soft': variant === 'clash',
      'border-[1.5px] border-dashed border-border bg-card': variant === 'option',
      'border-2 border-primary bg-primary-soft': variant === 'selected',
      'border-2 border-primary bg-primary text-primary-foreground': variant === 'chosen',
      'border-2 border-success bg-success text-primary-foreground': variant === 'chosen-success',
    }"
  >
    <div class="flex items-center justify-between whitespace-nowrap">
      <span class="text-[12px] font-semibold">{{ code }}</span>
      <span
        class="font-mono text-[10.5px] font-medium"
        :class="variant.startsWith('chosen') ? '' : 'text-muted-foreground'"
      >{{ section }}</span>
    </div>
    <p class="text-[11px]">{{ name }}</p>
    <p
      v-if="meta"
      class="truncate text-[10.5px]"
      :class="variant.startsWith('chosen') ? '' : 'text-muted-foreground'"
    >{{ meta }}</p>
    <slot />
  </div>
</template>
