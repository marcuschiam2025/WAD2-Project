<script setup>
// Searchable checkbox dropdown, with what is selected shown as removable chips
import { computed } from 'vue';
import SelectMenu from '@/components/ui/SelectMenu.vue';

const model = defineModel({ type: Array, default: () => [] });
const props = defineProps({
  options: { type: Array, required: true }, // [{ value, label }]
  placeholder: { type: String, default: 'Search' },
  joiner: { type: String, default: '' }, // shown between chips, e.g. "or"
  exclude: { type: Array, default: () => [] }, // codes that can't be picked here
});

// A saved code that isn't in the catalogue (e.g. a retired course) is still listed, so it can be unticked
const allOptions = computed(() => {
  const known = new Set(props.options.map((o) => o.value));
  const missing = model.value
    .filter((code) => !known.has(code))
    .map((code) => ({ value: code, label: `${code} (not in the catalogue)` }));
  // An excluded code that is already selected stays listed, so it can be unticked
  const pickable = props.options.filter(
    (o) => !props.exclude.includes(o.value) || model.value.includes(o.value),
  );
  return [...missing, ...pickable];
});
const chips = computed(() =>
  model.value.map((code) => ({ code, known: props.options.some((o) => o.value === code) })),
);
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <SelectMenu
      v-model="model"
      :options="allOptions"
      :placeholder="placeholder"
      multiple
      searchable
      hide-summary
    />
    <ul v-if="chips.length" class="flex flex-wrap items-center gap-1.5">
      <template v-for="(chip, i) in chips" :key="chip.code">
        <li v-if="joiner && i > 0" class="text-xs text-muted-foreground">{{ joiner }}</li>
        <li
          class="flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium"
        >
          {{ chip.code
          }}<span v-if="!chip.known" class="font-normal text-muted-foreground"> (not in catalogue)</span>
          <button
            type="button"
            :aria-label="`Remove ${chip.code}`"
            class="leading-none"
            @click="model = model.filter((code) => code !== chip.code)"
          >
            ×
          </button>
        </li>
      </template>
    </ul>
  </div>
</template>
