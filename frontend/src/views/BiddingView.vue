<script setup>
import { computed, ref } from 'vue'
import { useBiddingStore } from '@core/stores/bidding'
import { usePlannerStore } from '@core/stores/planner'
import { planLabel } from '@/trackLabels'
import { moduleName } from '@core/data/catalogue'
import { sections } from '@core/data/bidding'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TimetableGrid from '@/components/TimetableGrid.vue'
import TimetableModuleCard from '@/components/TimetableModuleCard.vue'
import BidSidebar from '@/components/BidSidebar.vue'
import { popEnter, popLeave } from '@/motion'

// TODO(backend): booked sections, bids and alternatives come from the bidding store / @core/data/bidding
const bidding = useBiddingStore()
const planner = usePlannerStore()
const dragging = ref(null)

// The timetable is the next semester of whichever What-If plan is picked here
const planOptions = computed(() => planner.plans.map((p) => ({ value: p.id, label: planLabel(p) })))
const semLabel = computed(() => bidding.targetSem?.label.replace('S', 'Sem ') ?? '')
const emptyReason = computed(() => {
  const t = bidding.targetSem
  if (bidding.bookedSections.length) return ''
  if (!t) return `${bidding.plan.name} has no semester after ${bidding.plan.currentSem}, so there is nothing to bid for.`
  if (t.exchange) return `${t.label} is an exchange semester in ${bidding.plan.name}, so there is nothing to bid for.`
  return `${bidding.plan.name} has no biddable modules in ${t.label} (or they were all dropped from the cart). Drag modules into that semester in the What-If Planner.`
})

// TODO(backend): replace with the current round from GET /api/bidding/round
const round = { term: 'AY24/25 · Sem 2 · Round 1A', closesIn: '2h 15m' }

// Alternative sections only appear for the module that has been clicked (selected)
function cardsAt(day, slot) {
  const focus = bidding.selectedModule
  const booked = bidding.bookedSections.filter((s) => s.day === day && s.slot === slot)
  const options = focus
    ? sections.filter((s) => s.module === focus && s.day === day && s.slot === slot && bidding.booked[focus] !== s.id)
    : []
  return [...booked.map((s) => ({ ...s, option: false })), ...options.map((s) => ({ ...s, option: true }))]
}

// While a module is selected, everything except it and its alternatives is greyed out
const isDimmed = (s) => bidding.selectedModule && !s.option && s.module !== bidding.selectedModule

function variantFor(s) {
  if (s.option) return 'option'
  if (bidding.selectedModule === s.module) return 'selected'
  if (bidding.clashes.has(s.id)) return 'clash'
  return 'booked'
}

function onDragStart(e, s) {
  if (s.module !== bidding.selectedModule) return e.preventDefault()
  dragging.value = s.module
  e.dataTransfer.effectAllowed = 'move'
}

function onDrop({ day, slot }) {
  const target = sections.find((s) => s.module === dragging.value && s.day === day && s.slot === slot)
  if (target) bidding.swapSection(target.module, target.id)
  dragging.value = null
}

// Clicks on a greyed-out card or empty space bubble up to the grid, which deselects
function onCardClick(e, s) {
  if (isDimmed(s)) return
  e.stopPropagation()
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
        <SelectField v-model="bidding.planId" :options="planOptions" width="w-[270px]" />
        <BaseButton variant="ghost" size="lg" href="https://boss.intranet.smu.edu.sg/">Go to BOSS</BaseButton>
        <BaseButton variant="outline" size="lg" to="/bidding/finalised">Go to Plans</BaseButton>
      </template>
    </PageHeader>

    <main class="flex flex-col gap-4 px-16 pt-8 pb-12">
      <div class="flex items-end justify-between gap-6">
        <div class="flex flex-col gap-0.5">
          <h2 class="text-[17px] font-semibold">{{ semLabel }} timetable, imported from {{ bidding.plan.name }} in the What-If Planner</h2>
          <p class="text-[13px] text-muted-foreground">
            Click a card to see its other sections, then click or drag onto one to swap. Other modules are locked. Click the card again, or anywhere else on the calendar, to deselect.
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-4 text-[12px] text-muted-foreground">
          <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border-l-[3px] border-success bg-secondary" /> Booked section</span>
          <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border-2 border-dashed border-primary bg-primary-tint" /> Alternative section (shown after you click a card)</span>
          <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border-2 border-primary" /> Selected</span>
        </div>
      </div>

      <div v-if="emptyReason" v-enter class="card flex flex-col items-start gap-3 p-6"> <!-- motion: fade + slide up on mount -->
        <p class="text-[14px] leading-normal">{{ emptyReason }}</p>
        <BaseButton variant="outline" to="/planner">Open the What-If Planner</BaseButton>
      </div>

      <div v-else v-enter class="flex items-stretch gap-4"> <!-- motion: fade + slide up on mount -->
        <div class="flex min-w-0 flex-1 flex-col gap-3">
          <div @click="bidding.selectedModule = null">
          <TimetableGrid row-height="min-h-[100px]" @cell-drop="onDrop">
            <template #cell="{ day, slot }">
              <!-- motion: alternative sections pop in when a card is selected, and out when deselected -->
              <TransitionGroup tag="div" class="flex min-h-0 flex-1 flex-col gap-1" :css="false" @enter="popEnter" @leave="popLeave">
              <button
                v-for="s in cardsAt(day, slot)"
                :key="s.id"
                type="button"
                :aria-disabled="isDimmed(s)"
                :draggable="!s.option && s.module === bidding.selectedModule"
                class="flex min-h-0 w-full shrink"
                :class="!s.option && s.module === bidding.selectedModule && 'cursor-grab active:cursor-grabbing'"
                @dragstart="onDragStart($event, s)"
                @dragend="dragging = null"
                @click="onCardClick($event, s)"
              >
                <TimetableModuleCard
                  :code="s.module"
                  :section="s.section"
                  :name="moduleName(s.module)"
                  :meta="`${s.profShort} · ${s.venueShort}`"
                  :variant="variantFor(s)"
                  :class="isDimmed(s) && 'opacity-30 grayscale'"
                />
              </button>
              </TransitionGroup>
            </template>
          </TimetableGrid>
          </div>
          <p v-if="bidding.fromRooms.length" class="text-[13px] text-muted-foreground">
            Accepted in collab rooms:
            <template v-for="(d, i) in bidding.fromRooms" :key="d.roomId"
              ><RouterLink :to="`/rooms/${d.roomId}/votes`" class="font-medium text-primary hover:underline">{{ d.module }} {{ d.sectionId.split('-')[1] }} ({{ d.roomName }})</RouterLink
              ><span v-if="i < bidding.fromRooms.length - 1">, </span></template
            >. Undo it in the room.
          </p>
          <p v-if="bidding.notOffered.length" class="text-[13px] text-muted-foreground">
            No section data yet for {{ bidding.notOffered.join(', ') }}, so {{ bidding.notOffered.length === 1 ? 'it is' : 'they are' }} not shown here.
          </p>
          <p v-if="bidding.clashes.size" class="text-[13px] text-destructive">
            Timetable clash: {{ clashList }} share a session slot. Click one and pick an alternative section.
          </p>
        </div>

        <BidSidebar :code="bidding.selectedModule" @close="bidding.selectedModule = null" />
      </div>
    </main>
  </div>
</template>
