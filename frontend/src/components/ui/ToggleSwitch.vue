<script setup>
const model = defineModel({ type: Boolean, default: false });
defineProps({ label: { type: String, default: '' } });
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    class="inline-flex items-center gap-2"
    @click="model = !model"
  >
    <span
      class="relative h-5 w-[34px] shrink-0 rounded-full transition-colors"
      :class="model ? 'bg-primary' : 'bg-switch-off'"
      aria-hidden="true"
    >
      <span
        class="absolute top-[2px] left-[2px] size-4 rounded-full shadow-sm transition-transform"
        :class="model ? 'translate-x-[14px] bg-primary-foreground' : 'bg-card dark:bg-muted-foreground'"
      />
    </span>
    <span v-if="label || $slots.default"
      ><slot>{{ label }}</slot></span
    >
  </button>
</template>
