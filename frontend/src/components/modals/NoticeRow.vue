<script setup>
// Bordered row with a coloured accent bar, overline label and message — used inside AlertModal.
defineProps({
  label: { type: String, required: true },
  tone: { type: String, default: 'danger' }, // danger | info
})
</script>

<template>
  <div class="flex items-center gap-3 rounded-lg border border-border py-3 pr-3.5 pl-0">
    <span class="my-[-12px] w-[3px] shrink-0 self-stretch" :class="tone === 'info' ? 'bg-primary' : 'bg-destructive'" />
    <div class="flex min-w-0 flex-1 flex-col gap-1 leading-normal">
      <p class="text-overline" :class="tone === 'info' ? 'text-primary' : 'text-destructive'">{{ label }}</p>
      <p class="text-[14px] leading-[22px]"><slot /></p>
    </div>
    <slot name="action" />
  </div>
</template>
