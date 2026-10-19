<script setup>
// White header strip under the nav bar: overline, title (with optional leading/badge slots) and actions.
defineProps({
  overline: { type: String, default: '' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <section class="flex flex-col gap-2 border-b border-border bg-card px-16 py-6">
    <p v-if="overline" class="text-overline text-muted-foreground">{{ overline }}</p>
    <div class="flex items-center justify-between gap-4">
      <div class="flex min-w-0 items-center gap-3">
        <slot name="leading" />
        <h1 class="text-page-title leading-normal">{{ title }}</h1>
        <slot name="badge" />
      </div>
      <div v-if="$slots.actions" class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <p v-if="subtitle" class="text-[14px] text-muted-foreground">{{ subtitle }}</p>
    <slot />
  </section>
</template>
