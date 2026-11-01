<script setup>
// Grouped bar chart: one group per quiz section (plus the overall index), one bar per track, scored 0–100.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { quizTrackNames, sectionLabels } from '@core/stores/quiz'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const props = defineProps({
  results: { type: Array, required: true }, // attempt.results: { track, scenarioPreferenceIndex, sectionPreferenceIndices }
})

const palette = { SMT: '#2563eb', BA: '#16a34a', PD: '#f59e0b', FT: '#7c3aed' }
const fallback = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#dc2626']

const labels = computed(() => ['Overall', ...Object.values(sectionLabels)])
const datasets = computed(() =>
  props.results.map((r, i) => ({
    label: quizTrackNames[r.track] ?? r.track,
    backgroundColor: palette[r.track] ?? fallback[i % fallback.length],
    borderRadius: 4,
    data: [r.scenarioPreferenceIndex, ...Object.keys(sectionLabels).map((s) => r.sectionPreferenceIndices?.[s])].map((v) => (typeof v === 'number' ? Math.round(v) : null)),
  })),
)

const canvas = ref(null)
let chart
onMounted(() => {
  chart = new Chart(canvas.value, {
    type: 'bar',
    data: { labels: labels.value, datasets: datasets.value },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { min: 0, max: 100, ticks: { stepSize: 25 } }, x: { grid: { display: false } } },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12 } } },
    },
  })
})
watch(datasets, () => {
  if (!chart) return
  chart.data.labels = labels.value
  chart.data.datasets = datasets.value
  chart.update()
})
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <figure class="flex flex-col gap-2">
    <div class="h-72 sm:h-80">
      <canvas ref="canvas" role="img" aria-label="Grouped bar chart of scenario preference scores out of 100 for each track, overall and by quiz section. The same figures are listed in the table below." />
    </div>
    <details class="text-xs text-muted-foreground">
      <summary class="cursor-pointer">View chart data as a table</summary>
      <div class="mt-2 overflow-x-auto">
        <table class="w-full text-left">
          <thead><tr><th class="py-1 pr-3 font-medium">Track</th><th v-for="l in labels" :key="l" class="py-1 pr-3 font-medium">{{ l }}</th></tr></thead>
          <tbody>
            <tr v-for="d in datasets" :key="d.label" class="border-t border-border">
              <th class="py-1 pr-3 font-normal text-foreground">{{ d.label }}</th>
              <td v-for="(v, i) in d.data" :key="i" class="py-1 pr-3 font-mono">{{ v ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </figure>
</template>
