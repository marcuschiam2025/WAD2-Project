<script setup>
import { computed, ref } from 'vue'
import { useBiddingStore } from '@backend/stores/bidding'
import { moduleName } from '@backend/data/catalogue'
import { sections } from '@backend/data/bidding'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import TimetableGrid from '@/components/TimetableGrid.vue'
import TimetableModuleCard from '@/components/TimetableModuleCard.vue'
import BidSidebar from '@/components/BidSidebar.vue'

// TODO(backend): booked sections, bids and alternatives come from the bidding store / @backend/data/bidding
const bidding = useBiddingStore()
const dragging = ref(null)

// TODO(backend): replace with the current round from GET /api/bidding/round
const round = { term: 'AY24/25 · Sem 2 · Round 1A', closesIn: '2h 15m', semester: 'Y2 · Sem 2' }

// Alternative sections are shown for the module being dragged, or the one open in the sidebar
const focusModule = computed(() => dragging.value ?? bidding.selectedModule)

function cardsAt(day, slot) {
  const booked = bidding.bookedSections.filter((s) => s.day === day && s.slot === slot)
  const options = sections.filter(
    (s) => s.day === day && s.slot === slot && bidding.booked[s.module] && bidding.booked[s.module] !== s.id,
  )
  return [...booked.map((s) => ({ ...s, option: false })), ...options.map((s) => ({ ...s, option: true }))]
}

function variantFor(s) {
  if (s.option) return 'option'
  if (bidding.selectedModule === s.module) return 'selected'
  if (bidding.clashes.has(s.id)) return 'clash'
  return 'booked'
}

function onDragStart(e, s) {
  dragging.value = s.module
  e.dataTransfer.effectAllowed = 'move'
}

function onDrop({ day, slot }) {
  const target = sections.find((s) => s.module === dragging.value && s.day === day && s.slot === slot)
  if (target) bidding.swapSection(target.module, target.id)
  dragging.value = null
}

function onCardClick(s) {
  if (s.option) bidding.swapSection(s.module, s.id)
  else bidding.selectedModule = bidding.selectedModule === s.module ? null : s.module
}

const clashList = computed(() => [...bidding.clashes].map((id) => id.replace('-', ' ')).join(', '))
</script>

<template>
  <div>
    <PageHeader :overline="round.term" title="BOSS Bidding Planner">
      <template #badge>
        <StatusPill tone="warning">Closes in {{ round.closesIn }}</StatusPill>
      </template>
      <template #actions>
        <BaseButton variant="ghost" size="lg" href="https://boss.intranet.smu.edu.sg/">Go to BOSS</BaseButton>
        <BaseButton variant="outline" size="lg" to="/bidding/finalised">Go to Plans</BaseButton>
      </template>
    </PageHeader>

    <main class="flex flex-col gap-4 px-16 pt-8 pb-12">
      <div class="flex items-end justify-between gap-6">
        <div class="flex flex-col gap-0.5">
          <h2 class="text-[17px] font-semibold">{{ round.semester }} timetable, imported from What-If Planner</h2>
          <p class="text-[13px] text-muted-foreground">
            Drag a card between session slots to swap sections. Click a card to see details and simulate your bid.
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-4 text-[12px] text-muted-foreground">
          <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border-l-[3px] border-success bg-secondary" /> Booked section</span>
          <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border border-dashed border-border" /> Alternative section (drag to swap)</span>
          <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border-2 border-primary" /> Selected</span>
        </div>
      </div>

      <div v-enter class="flex items-stretch gap-4">
        <div class="flex min-w-0 flex-1 flex-col gap-3">
          <TimetableGrid @cell-drop="onDrop">
            <template #cell="{ day, slot }">
              <button
                v-for="s in cardsAt(day, slot)"
                :key="s.id"
                type="button"
                :draggable="!s.option"
                class="block w-full transition-opacity"
                :class="[
                  s.option && focusModule && focusModule !== s.module && 'opacity-40',
                  s.option && 'hover:opacity-100',
                  !s.option && 'cursor-grab active:cursor-grabbing',
                ]"
                @dragstart="onDragStart($event, s)"
                @dragend="dragging = null"
                @click="onCardClick(s)"
              >
                <TimetableModuleCard
                  :code="s.module"
                  :section="s.section"
                  :name="moduleName(s.module)"
                  :meta="`${s.profShort} · ${s.venueShort}`"
                  :variant="variantFor(s)"
                />
              </button>
            </template>
          </TimetableGrid>
          <p v-if="bidding.clashes.size" class="text-[13px] text-destructive">
            Timetable clash: {{ clashList }} share a session slot. Drag one to an alternative section.
          </p>
        </div>

        <BidSidebar :code="bidding.selectedModule" @close="bidding.selectedModule = null" />
      </div>
    </main>
  </div>
</template>
