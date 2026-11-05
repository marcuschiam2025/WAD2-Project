<script setup>
// Native select styled like the V2 Select field. Use SelectMenu for the searchable / multi-select listbox.
import chevronDown from '@/assets/v2/chevron-down.svg';

const model = defineModel({ type: [String, Number], default: '' });
defineProps({
  label: { type: String, default: '' },
  options: { type: Array, required: true }, // [{ value, label }]
  width: { type: String, default: 'w-full' },
});
</script>

<template>
  <label class="flex flex-col gap-1.5" :class="width">
    <span v-if="label" class="text-[13px] font-medium">{{ label }}</span>
    <span class="relative block">
      <select
        v-model="model"
        class="w-full appearance-none rounded-md border border-border bg-card py-2.5 pr-9 pl-3 text-[14px] leading-normal text-foreground outline-none transition-colors focus:border-ring"
      >
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <img
        :src="chevronDown"
        alt=""
        class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      />
    </span>
  </label>
</template>
