<script setup>
import chevronDown from '@/assets/figma/chevron-down.svg'

const model = defineModel({ type: [String, Number], default: '' })
defineProps({
  label: { type: String, default: '' },
  options: { type: Array, required: true }, // [{ value, label }]
  width: { type: String, default: 'w-full' },
  chevron: { type: String, default: chevronDown },
})
</script>

<template>
  <label class="flex flex-col gap-1.5" :class="width">
    <span v-if="label" class="text-[13px] font-medium">{{ label }}</span>
    <span class="relative block">
      <select
        v-model="model"
        class="w-full appearance-none rounded-md border border-border bg-card py-[9px] pr-9 pl-3 text-[14px] text-foreground outline-none focus:border-primary"
      >
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <img :src="chevron" alt="" class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
    </span>
  </label>
</template>
