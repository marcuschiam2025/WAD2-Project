<script setup>
// Search box for modules: results float under it while you type, nothing is listed until then.
// Emits `pick` with the chosen catalogue module. Modules in `exclude` (codes) are left out of the results.
// Searches the backend's full module catalogue once it has loaded.
import { computed, onMounted, ref } from 'vue';
import { liveModules } from '@core/data/catalogue';
import { useCatalogueStore } from '@core/stores/catalogue';
import iconSearch from '@/assets/figma/icon-search.svg';

const props = defineProps({
  exclude: { type: Array, default: () => [] },
  disabled: Boolean,
  placeholder: { type: String, default: 'Search by module code or name' },
});
const emit = defineEmits(['pick']);

const catalogue = useCatalogueStore();
onMounted(() => catalogue.load());
const all = computed(() =>
  Object.values(liveModules)
    .filter((m) => !m.archived)
    .map((m) => ({ code: m._id, name: m.title }))
    .sort((a, b) => a.code.localeCompare(b.code)),
);
const query = ref('');
const matches = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return all.value
    .filter((m) => !props.exclude.includes(m.code) && `${m.code} ${m.name}`.toLowerCase().includes(q))
    .slice(0, 8);
});

function pick(m) {
  emit('pick', m);
  query.value = '';
}
</script>

<template>
  <div class="relative">
    <div
      class="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-[9px] focus-within:border-ring"
      :class="disabled && 'opacity-50'"
    >
      <img :src="iconSearch" alt="" class="size-4" />
      <input
        v-model="query"
        :disabled="disabled"
        autocomplete="off"
        :placeholder="placeholder"
        aria-label="Search modules"
        class="min-w-0 flex-1 bg-transparent text-[14px] leading-normal outline-none"
        @keydown.enter.prevent="matches[0] && pick(matches[0])"
      />
    </div>
    <div
      v-if="query.trim() && !disabled"
      class="absolute inset-x-0 top-full z-10 mt-1 flex max-h-64 flex-col overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-md"
    >
      <button
        v-for="m in matches"
        :key="m.code"
        type="button"
        class="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] hover:bg-muted"
        @click="pick(m)"
      >
        <span class="font-mono font-bold">{{ m.code }}</span>
        <span class="min-w-0 flex-1 truncate">{{ m.name }}</span>
      </button>
      <p v-if="!matches.length" class="px-2 py-1.5 text-[13px] text-muted-foreground">No matching modules</p>
    </div>
  </div>
</template>
