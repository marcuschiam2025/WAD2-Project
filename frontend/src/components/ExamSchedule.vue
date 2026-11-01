<script setup>
// Final exams of the sections booked on the Bidding screen, soonest first, so students can see how
// their exams are spread out while they choose modules. Exams on the same day are flagged.
import { computed } from 'vue'
import { moduleName } from '@core/data/catalogue'
import { findExamClashes } from '@core/utils/clash'

const props = defineProps({
  sections: { type: Array, required: true }, // booked sections (the bidding store's bookedSections)
})

// "2027-04-20" → "Tue 20 Apr"
const dayLabel = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

const rows = computed(() => {
  const booked = props.sections.filter(Boolean)
  const clashing = new Set(findExamClashes(booked).flat())
  const result = booked.map((s) => ({
    id: s.id,
    module: s.module,
    section: s.section,
    exam: s.examPeriod,
    note: s.exam,
    clash: clashing.has(s.id),
  }))
  // Dated exams first by date and time, then "No final exam", then "Exam not yet announced"
  const order = (r) => (r.exam ? `0 ${r.exam.date} ${r.exam.start}` : r.note === 'No final exam' ? '1' : '2')
  return result.sort((a, b) => order(a).localeCompare(order(b)) || a.module.localeCompare(b.module))
})

// How many dated exams fall on each day, to point out busy days
const perDay = computed(() => {
  const count = {}
  for (const r of rows.value) if (r.exam) count[r.exam.date] = (count[r.exam.date] ?? 0) + 1
  return count
})
const unconfirmedEnds = computed(() => rows.value.some(row => row.exam && !row.exam.end))
</script>

<template>
  <section v-if="rows.length" class="flex flex-col gap-2 rounded-lg border border-border bg-card p-4" aria-label="Final exam schedule">
    <div class="flex items-baseline justify-between gap-2">
      <h2 class="text-[15px] font-semibold">Final exams</h2>
      <span class="text-[12px] text-muted-foreground">For the sections booked above</span>
    </div>
    <ul class="flex flex-col">
      <li
        v-for="r in rows"
        :key="r.id"
        class="grid grid-cols-[88px_1fr_auto] sm:grid-cols-[110px_1fr_auto] items-center gap-3 border-t border-border py-2 text-[13px] first:border-t-0"
      >
        <span v-if="r.exam" class="font-medium">{{ dayLabel(r.exam.date) }}</span>
        <span v-else class="text-muted-foreground">—</span>
        <span class="min-w-0 truncate">
          <span class="font-mono font-bold">{{ r.module }}</span>
          <span class="text-muted-foreground"> {{ moduleName(r.module) }}</span>
        </span>
        <span v-if="r.exam" class="font-mono" :class="r.clash && 'font-semibold text-destructive'">
          {{ r.exam.start }}<template v-if="r.exam.end">–{{ r.exam.end }}</template><span v-else class="text-warning"> · End time unconfirmed</span><span v-if="r.clash"> · clash</span
          ><span v-else-if="perDay[r.exam.date] > 1" class="text-warning"> · same day</span>
        </span>
        <span v-else class="text-muted-foreground">{{ r.note }}</span>
      </li>
    </ul>
    <p v-if="unconfirmedEnds" class="text-[12px] text-warning">Some exam end times are unconfirmed. Clash checks can detect definite overlaps but cannot rule out other overlaps until end times are verified. Check the official exam details.</p>
    <p v-else class="text-[12px] text-muted-foreground">Check the official exam schedule for venues and changes.</p>
  </section>
</template>
