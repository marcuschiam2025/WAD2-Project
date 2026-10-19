<script setup>
// White header strip under the nav bar: overline, title, optional leading/badge slot and actions.
defineProps({
  overline: { type: String, default: '' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  large: Boolean,
})
</script>

<template>
  <section class="flex flex-col gap-3 border-b border-border bg-card px-7 py-6">
    <p v-if="overline" class="text-overline text-muted-foreground uppercase">{{ overline }}</p>
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <slot name="leading" />
        <h1 :class="large ? 'text-h1' : 'text-[26px] font-bold text-black'">{{ title }}</h1>
        <slot name="badge" />
      </div>
      <div class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <p v-if="subtitle" class="text-small text-muted-foreground">{{ subtitle }}</p>
  </section>
</template>
