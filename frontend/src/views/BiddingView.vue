<script setup>
import { computed, ref } from 'vue'
import { useBiddingStore } from '@backend/stores/bidding'
import { useUserStore } from '@backend/stores/user'
import { moduleName } from '@backend/data/catalogue'
import { sections } from '@backend/data/bidding'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TimetableGrid from '@/components/TimetableGrid.vue'
import TimetableModuleCard from '@/components/TimetableModuleCard.vue'
import BidSidebar from '@/components/BidSidebar.vue'
import dotWarning from '@/assets/figma/dot-warning-6.svg'
import iconPointer from '@/assets/figma/icon-pointer.svg'

const bidding = useBiddingStore()
const user = useUserStore()
const dragging = ref(null)

// Alternatives are shown for the module being dragged, or the one open in the sidebar
const focusModule = computed(() => dragging.value ?? bidding.selectedModule)

function cardsAt(day, slot) {
  const booked = bidding.bookedSections.filter((s) => s.day === day && s.slot === slot)
  const options = focusModule.value
    ? sections.filter(
        (s) => s.module === focusModule.value && s.day === day && s.slot === slot && bidding.booked[s.module] !== s.id,
      )
    : []
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

const clashList = computed(() =>
  [...bidding.clashes].map((id) => id.replace('-', ' ')).join(', '),
)
</script>

<template>
  <div>
    <PageHeader overline="AY24/25 · SEM 2 · ROUND 1A" title="BOSS Bidding Planner">
      <template #badge>
        <span class="flex items-center gap-[5px] rounded-full bg-warning-chip px-2.5 py-[3px] text-[12px] font-semibold text-warning">
          <img :src="dotWarning" alt="" class="size-1.5" /> Closes in 2h 15m
        </span>
      </template>
      <template #actions>
        <BaseButton href="https://boss.intranet.smu.edu.sg/">Go to BOSS</BaseButton>
      </template>
    </PageHeader>

    <main class="flex items-start gap-6 px-16 pt-8 pb-16">
      <div class="flex min-w-0 flex-1 flex-col gap-4">
        <div class="flex items-center gap-3">
          <div class="flex flex-1 flex-col gap-0.5">
            <h2 class="text-h4">Y2 · Sem 2 timetable — imported from What-If Planner</h2>
            <p class="text-small text-muted-foreground">
              Drag a module card between session slots to swap sections. Click a card to see details and simulate your bid.
            </p>
          </div>
          <div class="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 whitespace-nowrap">
            <span class="font-mono text-[13px] font-medium">e$ {{ bidding.allocated }}</span>
            <span class="text-[12px] text-muted-foreground">allocated of e$ {{ user.balance.toLocaleString() }}</span>
          </div>
        </div>

        <TimetableGrid @cell-drop="onDrop">
          <template #cell="{ day, slot }">
            <button
              v-for="s in cardsAt(day, slot)"
              :key="s.id"
              type="button"
              :draggable="!s.option"
              class="block w-full"
              :class="s.option && 'opacity-60 hover:opacity-100'"
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

        <p v-if="bidding.clashes.size" class="text-small text-destructive">
          Timetable clash: {{ clashList }} share a session slot. Drag one to an alternative section.
        </p>

        <div class="flex items-center gap-3">
          <BaseButton variant="outline" class="h-auto! px-4 py-2.5 text-[13px] font-normal!" @click="bidding.save()">Save plan</BaseButton>
          <BaseButton to="/bidding/finalised" class="h-auto! px-4 py-2.5 text-[13px] font-normal!">Go to Plans</BaseButton>
          <span v-if="bidding.savedAt" class="text-small text-muted-foreground">Saved at {{ bidding.savedAt.toLocaleTimeString() }}</span>
        </div>

        <div class="flex items-center gap-5 text-[12px] text-muted-foreground">
          <span class="flex items-center gap-1.5"><span class="h-3.5 w-[18px] rounded-sm border-l-3 border-success bg-secondary" /> Booked section</span>
          <span class="flex items-center gap-1.5"><span class="h-3.5 w-[18px] rounded-sm border-[1.5px] border-dashed border-border bg-card opacity-60" /> Alternative section (drag to swap)</span>
          <span class="flex items-center gap-1.5"><span class="h-3.5 w-[18px] rounded-sm border-2 border-primary bg-primary-soft" /> Selected</span>
        </div>
      </div>

      <BidSidebar v-if="bidding.selectedModule" :code="bidding.selectedModule" @close="bidding.selectedModule = null" />
      <aside
        v-else
        class="card flex min-h-[548px] w-[360px] shrink-0 flex-col items-center justify-center gap-3 self-stretch p-6 text-center"
      >
        <img :src="iconPointer" alt="" class="size-7" />
        <p class="text-h4">Select a module card</p>
        <p class="text-small text-muted-foreground">
          Its professor, section, venue and exam date will show here, along with the BOSS bidding simulator.
        </p>
      </aside>
    </main>
  </div>
</template>
