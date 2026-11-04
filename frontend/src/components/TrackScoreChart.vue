<script setup>
// One bar per track: the single score the track was ranked on, 0–100, best first.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import { quizTrackNames } from '@core/stores/quiz'
import { useThemeStore } from '@core/stores/theme'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

const props = defineProps({
  results: { type: Array, required: true }, // attempt.results, best first
  provisional: Boolean, // an older result ranked on scenario choices alone, with no match score
})

const themeStore = useThemeStore()
// Chart.js draws on a canvas, so it can't read CSS variables itself: take their current values
const cssColor = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const scoreOf = (r) => (props.provisional ? r.scenarioPreferenceIndex : r.alignmentIndex)
const rows = computed(() =>
  props.results.map((r) => ({ label: quizTrackNames[r.track] ?? r.track, score: typeof scoreOf(r) === 'number' ? Math.round(scoreOf(r)) : null })),
)
const chartData = () => ({
  labels: rows.value.map((row) => row.label),
  datasets: [{ data: rows.value.map((row) => row.score), backgroundColor: cssColor('--primary'), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 20 }],
})

const canvas = ref(null)
let chart
onMounted(() => {
  chart = new Chart(canvas.value, {
    type: 'bar',
    data: chartData(),
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { min: 0, max: 100, ticks: { stepSize: 25, color: cssColor('--text-muted') }, grid: { color: cssColor('--border') }, border: { display: false } },
        y: { ticks: { color: cssColor('--text') }, grid: { display: false }, border: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false, callbacks: { label: (item) => `${item.parsed.x} / 100` } },
      },
    },
  })
})
watch(rows, () => {
  if (!chart) return
  chart.data = chartData()
  chart.update()
})
watch(() => themeStore.theme, async () => {
  if (!chart) return
  await nextTick() // the page's variables change a moment after the attribute is set
  chart.data = chartData()
  chart.options.scales.x.ticks.color = cssColor('--text-muted')
  chart.options.scales.x.grid.color = cssColor('--border')
  chart.options.scales.y.ticks.color = cssColor('--text')
  chart.update()
})
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <figure class="flex flex-col gap-2">
    <div class="h-56">
      <canvas ref="canvas" role="img" aria-label="Bar chart of your score out of 100 for each track, highest first. The same figures are listed in the table below." />
    </div>
    <details class="text-xs text-muted-foreground">
      <summary class="cursor-pointer">View chart data as a table</summary>
      <table class="mt-2 w-full text-left">
        <thead><tr><th class="py-1 pr-3 font-medium">Track</th><th class="py-1 font-medium">Score</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.label" class="border-t border-border">
            <th class="py-1 pr-3 font-normal text-foreground">{{ row.label }}</th>
            <td class="py-1 font-mono">{{ row.score ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>
