<script setup>
import { computed } from 'vue'
import { useBiddingStore } from '@core/stores/bidding'
import { useUserStore } from '@core/stores/user'
import { moduleName } from '@core/data/catalogue'
import { days, slots, sections } from '@core/data/bidding'
import { buildIcs, downloadFile } from '@core/utils/ics'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import arrowLeft from '@/assets/figma/arrow-left.svg'
import iconInfo from '@/assets/figma/info-primary.svg'
import iconLock from '@/assets/figma/lock-keyhole.svg'

const bidding = useBiddingStore()
const user = useUserStore()
const TERM_START = new Date(2025, 0, 6) // Monday, week 1 of AY24/25 Term 2

// TODO(backend): replace with GET /api/bidding/plans — one finalised copy per plan (max 3).
// `swap` is [module, sectionId] for the one section that differs from Plan 1; Plan 1 has none.
// The sample copies swap a section of whichever modules are in the chosen What-If plan's timetable.
function sampleSwap(base, n) {
  const swappable = Object.keys(base).filter((code) => bidding.sectionsFor(code).length > 1)
  const code = swappable[n % swappable.length]
  if (!code) return null
  const others = bidding.sectionsFor(code).filter((sec) => sec.id !== base[code])
  return [code, others[Math.floor(n / swappable.length) % others.length].id]
}

const semText = computed(() => bidding.targetSem?.label.replace('S', 'Sem ') ?? '')
const when = (s) => `${days[s.day].slice(0, 3)} ${slots[s.slot].start}`

// "moves to Thursday" when the day changes, otherwise "moves to section G4"
function moveText(s, base) {
  const before = sections.find((x) => x.id === base[s.module])
  return before.day === s.day ? `${s.module} moves to section ${s.section}` : `${s.module} moves to ${days[s.day]}`
}

const copies = computed(() => {
  const base = { ...bidding.booked }
  const variants = [
    { name: 'Plan 1', swap: null },
    { name: 'Plan 2', swap: sampleSwap(base, 0) },
    { name: 'Plan 3', swap: sampleSwap(base, 1) },
  ]
  return variants.map((v) => {
    const booked = v.swap ? { ...base, [v.swap[0]]: v.swap[1] } : base
    const schedule = Object.values(booked)
      .map((id) => sections.find((s) => s.id === id))
      .sort((a, b) => a.day - b.day || a.slot - b.slot)
      .map((s) => ({ ...s, changed: booked[s.module] !== base[s.module] }))
    const changed = schedule.filter((s) => s.changed)
    return {
      ...v,
      schedule,
      original: !v.swap,
      summary: v.swap ? `${changed.length} change from Plan 1 · ${moveText(changed[0], base)}` : 'Original timetable from the Bidding Planner',
    }
  })
})

// One row per module; each plan column shows its section or "Same as Plan 1"
const rows = computed(() =>
  copies.value[0].schedule.map((base) => ({
    module: base.module,
    cells: copies.value.map((c, i) => {
      const s = c.schedule.find((x) => x.module === base.module)
      return { s, changed: s.changed, same: i > 0 && !s.changed }
    }),
  })),
)

function exportCopy(copy) {
  const ics = buildIcs(
    copy.schedule.map((s) => ({ ...s, name: moduleName(s.module) })),
    TERM_START,
  )
  downloadFile(`bidmaxxer-${copy.name.toLowerCase().replace(' ', '-')}.ics`, ics)
}
</script>

<template>
  <div>
    <PageHeader overline="AY24/25 · Sem 2 · Round 1A" title="Finalised plans" subtitle="Compare your plans, then add one to Google Calendar.">
      <template #actions>
        <RouterLink
          to="/bidding"
          class="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-[9px] text-[14px] font-medium transition-colors hover:bg-muted"
        >
          <img :src="arrowLeft" alt="" class="size-4" /> Back to planner
        </RouterLink>
      </template>
    </PageHeader>

    <main class="flex flex-col gap-6 px-16 pt-8 pb-12">
      <!-- TODO(backend): remove once plans are real, this only labels the sample data -->
      <div v-enter class="flex items-start gap-3 rounded-lg border border-primary bg-primary-tint px-3.5 py-3"> <!-- motion: info banner fades in on mount -->
        <img :src="iconInfo" alt="" class="mt-0.5 size-4" />
        <div class="flex flex-col gap-0.5 text-[13px] leading-normal">
          <p class="font-semibold text-primary">Example finalised state · sample copies</p>
          <p>These copies illustrate the finalised view. Plan 2 and Plan 3 use observed alternative sessions.</p>
        </div>
      </div>

      <div v-stagger="0.05" class="grid grid-cols-3 gap-6"> <!-- motion: plan cards stagger in 50ms apart -->
        <article v-for="copy in copies" :key="copy.name" class="card flex flex-col gap-3 p-5">
          <div class="flex items-center justify-between">
            <h2 class="text-h3">{{ copy.name }}</h2>
            <StatusPill tone="success">Finalised</StatusPill>
          </div>
          <p v-if="copy.original" class="flex items-baseline gap-1.5 leading-normal">
            <span class="font-mono text-[22px] font-bold">e$ {{ bidding.allocated }}</span>
            <span class="text-[13px] text-muted-foreground">allocated</span>
          </p>
          <p v-else class="flex items-baseline gap-1.5 leading-normal">
            <span class="font-mono text-[22px] font-bold">—</span>
            <span class="text-[13px] text-muted-foreground">no bids set</span>
          </p>
          <p class="text-[13px] text-muted-foreground">{{ copy.summary }}</p>
          <BaseButton :variant="copy.original ? 'primary' : 'outline'" block @click="exportCopy(copy)">
            Add to Google Calendar
          </BaseButton>
        </article>
      </div>

      <section v-enter="0.15" class="card overflow-hidden"> <!-- motion: comparison table fades in, 150ms delay -->
        <div class="flex items-center justify-between px-5 py-4">
          <h2 class="text-h4">Module and session comparison</h2>
          <span class="text-[12px] text-muted-foreground">{{ semText }} · only cells that differ from Plan 1 are tinted</span>
        </div>
        <div class="grid grid-cols-[minmax(0,1.1fr)_repeat(3,minmax(0,1fr))] bg-muted text-overline text-muted-foreground">
          <span class="px-5 py-2.5">Module</span>
          <span v-for="c in copies" :key="c.name" class="px-4 py-2.5">{{ c.name }}</span>
        </div>
        <div
          v-for="r in rows"
          :key="r.module"
          class="grid grid-cols-[minmax(0,1.1fr)_repeat(3,minmax(0,1fr))] border-t border-border text-[13px]"
        >
          <p class="flex items-center gap-2 px-5 py-3 leading-normal">
            <span class="font-mono font-bold">{{ r.module }}</span>
            <span>{{ moduleName(r.module) }}</span>
          </p>
          <div
            v-for="(cell, i) in r.cells"
            :key="i"
            class="flex items-center gap-2 px-4 py-3"
            :class="cell.changed && 'border-l-[3px] border-primary bg-primary-tint'"
          >
            <span v-if="cell.same" class="text-muted-foreground">Same as Plan 1</span>
            <template v-else>
              <span class="font-mono font-bold">{{ cell.s.section }}</span>
              <span class="text-muted-foreground">{{ when(cell.s) }}</span>
              <span v-if="cell.changed" class="text-[12px] font-semibold text-primary">Changed</span>
            </template>
          </div>
        </div>
      </section>

      <p class="flex items-center gap-2 text-[13px] text-muted-foreground">
        <img :src="iconLock" alt="" class="size-3.5" />
        Finalised copies are read-only. To adjust a session, return to the planner.
      </p>
    </main>
  </div>
</template>
