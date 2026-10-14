<script setup>
import { computed } from 'vue'
import { useBiddingStore } from '@backend/stores/bidding'
import { useUserStore } from '@backend/stores/user'
import { moduleName } from '@backend/data/catalogue'
import { sections } from '@backend/data/bidding'
import { buildIcs, downloadFile } from '@backend/utils/ics'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TimetableModuleCard from '@/components/TimetableModuleCard.vue'
import arrowLeft from '@/assets/figma/arrow-left.svg'
import iconInfo from '@/assets/figma/info-20.svg'
import iconCheck from '@/assets/figma/check-white-12.svg'
import iconDownload from '@/assets/figma/download-white-16.svg'
import lockKeyhole from '@/assets/figma/lock-keyhole.svg'

const bidding = useBiddingStore()
const user = useUserStore()
const TERM_START = new Date(2025, 0, 6) // Monday, week 1 of AY24/25 Term 2

// Plan 1 is the booked timetable; Plans 2 and 3 are alternative snapshots with one section swapped
const copies = computed(() => {
  const base = { ...bidding.booked }
  const variants = [
    { name: 'Plan 1', note: 'Original timetable · booked sessions from the planner.', swap: null },
    { name: 'Plan 2', note: 'Alternative snapshot · IS212 moves to Thursday, section G1.', swap: ['IS212', 'IS212-G1'] },
    { name: 'Plan 3', note: 'Alternative snapshot · IS213 moves to the later Tuesday session, section G4.', swap: ['IS213', 'IS213-G4'] },
  ]
  return variants.map((v) => {
    const booked = v.swap ? { ...base, [v.swap[0]]: v.swap[1] } : base
    const schedule = Object.values(booked)
      .map((id) => sections.find((s) => s.id === id))
      .sort((a, b) => a.day - b.day || a.slot - b.slot)
      .map((s) => ({ ...s, changed: booked[s.module] !== base[s.module] }))
    return { ...v, schedule, original: !v.swap }
  })
})

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
    <PageHeader
      overline="AY24/25 · SEM 2 · ROUND 1A"
      title="BOSS — Finalised Plans"
      subtitle="Review each plan’s module and session summary, then choose the copy to export."
      large
    >
      <template #actions>
        <RouterLink
          to="/bidding"
          class="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-[9px] text-body font-medium text-primary hover:bg-muted"
        >
          <img :src="arrowLeft" alt="" class="size-4" /> Back to planner
        </RouterLink>
      </template>
    </PageHeader>

    <main class="flex flex-col gap-6 px-16 pt-8 pb-12">
      <div class="flex items-center gap-3 rounded-md border border-primary-soft-border bg-primary-soft p-4">
        <img :src="iconInfo" alt="" class="size-5" />
        <div class="flex flex-col gap-1 text-[13px]">
          <p class="font-semibold text-primary">Export to Google Calendar</p>
          <p class="leading-[18px] text-muted-foreground">
            Each copy downloads as an .ics file you can import into Google Calendar. Plan 2 and Plan 3 use observed
            alternative sessions.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-6">
        <article v-for="copy in copies" :key="copy.name" class="card flex flex-col">
          <div class="flex flex-col gap-3 p-5">
            <div class="flex items-center justify-between">
              <h2 class="text-h3">{{ copy.name }}</h2>
              <span class="flex items-center gap-[5px] rounded-full bg-success px-[9px] py-1 text-[11px] font-medium text-primary-foreground">
                <img :src="iconCheck" alt="" class="size-3" /> Finalised
              </span>
            </div>
            <p class="h-9 text-small text-muted-foreground">{{ copy.note }}</p>
            <div class="flex h-11 items-center gap-1.5 rounded-sm bg-muted px-3">
              <template v-if="copy.original">
                <span class="font-mono text-[16px] leading-[22px] font-medium">e$ {{ bidding.allocated }}</span>
                <span class="text-small text-muted-foreground">allocated of e$ {{ user.balance.toLocaleString() }}</span>
              </template>
              <span v-else class="text-small text-muted-foreground">Alternative allocation not provided</span>
            </div>
          </div>
          <div class="h-px bg-border" />
          <div class="flex flex-1 flex-col gap-3.5 p-5">
            <div class="flex items-center justify-between">
              <h3 class="text-h4">Module &amp; session summary</h3>
              <span class="text-small text-muted-foreground">Y2 · Sem 2</span>
            </div>
            <div v-for="s in copy.schedule" :key="s.id" class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <span class="text-small">{{ bidding.slotLabel(s) }}</span>
                <span v-if="s.changed" class="text-[11px] font-medium text-primary">Changed</span>
              </div>
              <TimetableModuleCard
                :code="s.module"
                :section="s.section"
                :name="moduleName(s.module)"
                :meta="`${s.profShort} · ${s.venueShort}`"
              />
            </div>
          </div>
          <div class="flex flex-col gap-2 px-5 pt-1 pb-5">
            <BaseButton block @click="exportCopy(copy)">
              <img :src="iconDownload" alt="" class="size-4" /> Export copy
            </BaseButton>
            <p class="text-center text-overline text-muted-foreground uppercase">{{ copy.name }} · .ics</p>
          </div>
        </article>
      </div>

      <div class="flex items-center gap-2">
        <img :src="lockKeyhole" alt="" class="size-3.5" />
        <p class="text-small text-muted-foreground">Finalised copies are read-only. To adjust a session, return to the planner.</p>
      </div>
    </main>
  </div>
</template>
