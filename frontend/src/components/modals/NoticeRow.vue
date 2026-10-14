<script setup>
// Bordered row with a coloured accent bar, overline label and message — used inside AlertModal.
defineProps({
  label: { type: String, required: true },
  tone: { type: String, default: 'warning' }, // warning | info
})
</script>

<template>
  <div class="flex items-center gap-3 rounded-md border border-border px-3.5 py-3">
    <span class="h-10 w-[3px] shrink-0 rounded-[2px]" :class="tone === 'info' ? 'bg-primary' : 'bg-warning'" />
    <div class="flex min-w-0 flex-1 flex-col gap-[3px]">
      <p class="text-overline" :class="tone === 'info' ? 'text-primary' : 'text-warning'">{{ label }}</p>
      <p class="text-small"><slot /></p>
    </div>
    <slot name="action" />
  </div>
</template>
