<script setup>
// v2 Components / Avatar: initials circle. `you` adds the primary ring marking the signed-in student.
defineProps({
  initials: { type: String, required: true },
  size: { type: Number, default: 24 }, // 24 | 32 | 40 | 64
  you: Boolean,
});

const sizes = {
  24: 'size-6 text-[10px]',
  32: 'size-8 text-[12px]',
  40: 'size-10 text-[14px]',
  64: 'size-16 text-[22px]',
};
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-full bg-secondary leading-normal font-semibold text-secondary-foreground"
    :class="[sizes[size], you && 'border-2 border-primary']"
  >
    {{ initials }}
  </span>
</template>
