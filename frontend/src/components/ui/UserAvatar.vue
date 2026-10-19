<script setup>
// Member initials circle. `you` adds the primary ring marking the signed-in student.
defineProps({
  initials: { type: String, required: true },
  size: { type: Number, default: 24 }, // 24 | 32
  you: Boolean,
})
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-secondary font-semibold text-foreground"
    :class="[
      you ? 'border-primary' : 'border-card',
      size === 32 ? 'size-8 text-[12px]' : 'size-6 text-[10px]',
    ]"
  >
    {{ initials }}
  </span>
</template>
