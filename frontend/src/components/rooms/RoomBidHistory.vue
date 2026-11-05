<script setup>
import { ref, watch } from 'vue';
import { api } from '@core/services/api';
const props = defineProps({ module: { type: String, required: true } });
const history = ref([]),
  loaded = ref(false),
  loading = ref(false),
  error = ref('');
let revision = 0;
watch(
  () => props.module,
  () => {
    revision++;
    loaded.value = false;
    history.value = [];
    error.value = '';
    loading.value = false;
  },
);
async function load() {
  if (loading.value || loaded.value) return;
  const version = ++revision;
  loading.value = true;
  error.value = '';
  try {
    const data = await api.bidHistory(props.module);
    if (version !== revision) return;
    history.value = data.slice(0, 6);
    loaded.value = true;
  } catch (failure) {
    if (version === revision) error.value = failure.message;
  } finally {
    if (version === revision) loading.value = false;
  }
}
</script>
<template>
  <details class="card p-5" @toggle="$event.target.open && load()">
    <summary class="cursor-pointer font-semibold">
      Past bid results <span class="ml-2 text-sm font-normal text-muted-foreground">{{ module }}</span>
    </summary>
    <p class="mt-4 text-xs text-muted-foreground">
      Recorded results for this module, not a particular section. Past results do not guarantee a successful
      bid.
    </p>
    <p v-if="loading" role="status" class="mt-3 text-sm">Loading history…</p>
    <div v-else-if="error" class="mt-3">
      <p role="alert" class="text-sm text-destructive">{{ error }}</p>
      <button class="mt-2 rounded-md border border-border px-3 py-2 text-sm" @click="load">Try again</button>
    </div>
    <p v-else-if="loaded && !history.length" class="mt-3 text-sm text-muted-foreground">
      No historical bid results are recorded for this module yet.
    </p>
    <div v-else-if="history.length" class="mt-4 overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-border">
            <th class="py-2">Term</th>
            <th>Round</th>
            <th>Minimum (e$)</th>
            <th>Median (e$)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, i) in history" :key="i" class="border-b border-border last:border-0">
            <td class="py-3">{{ entry.term }}</td>
            <td>{{ entry.round }}</td>
            <td>{{ entry.min ?? '-' }}</td>
            <td>{{ entry.median ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>
