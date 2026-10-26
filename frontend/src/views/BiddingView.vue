<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBiddingStore } from '@core/stores/bidding'
import { usePlannerStore } from '@core/stores/planner'
import { useRoomsStore } from '@core/stores/rooms'
import { planLabel } from '@/trackLabels'
import { moduleName } from '@core/data/catalogue'
import { sectionMeetings } from '@core/utils/clash'
import { sections } from '@core/data/bidding'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import SelectField from '@/components/ui/SelectField.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import TimetableGrid from '@/components/TimetableGrid.vue'
import TimetableModuleCard from '@/components/TimetableModuleCard.vue'
import BidSidebar from '@/components/BidSidebar.vue'
import ExamSchedule from '@/components/ExamSchedule.vue'
import { popEnter, popLeave } from '@/motion'

// Booked sections, bids and alternatives come from the bidding store (backend data, live section catalogue)
const bidding = useBiddingStore()
const planner = usePlannerStore()
const rooms = useRoomsStore()
const route = useRoute()
const router = useRouter()
watch(() => route.query.plan, id => {
  if (id && planner.plans.some(plan => plan.id === id)) bidding.planId = id
}, { immediate: true })
watch(() => bidding.planId, id => {
  if (id && route.query.plan !== id) router.replace({ query: { ...route.query, plan: id } })
})
const dragging = ref(null)

// Refresh personal room picks made in another tab without changing ballots or membership.
let roomTimer
onMounted(() => {
  rooms.load()
  roomTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && !rooms.loading && !rooms.busy) rooms.load()
  }, 10000)
})
onBeforeUnmount(() => clearInterval(roomTimer))

// A module booked in the section a collab room confirmed is locked to it, and shows the whole party on its card:
// you first (with your ring), then the people you are bidding with. If several rooms confirmed the same section,
// everyone from all of them.
const partyOf = (code) => {
  const d = bidding.locked[code]
  if (!d) return []
  const ids = new Set(d.roomIds.flatMap((roomId) => {
    const room = rooms.getRoom(roomId)
    return (room?.members ?? []).filter(id => room.sharedSections?.[id] === d.sectionId)
  }))
  ids.delete('me')
  return [rooms.person('me'), ...[...ids].map(rooms.person)]
}
// Just the others, for the sentence under the calendar
const friendsOf = (code) => partyOf(code).filter((p) => !p.you)
const lockedFocus = computed(() => (bidding.selectedModule ? (bidding.locked[bidding.selectedModule] ?? null) : null))

// The timetable is the next semester of whichever What-If plan is picked here
const planOptions = computed(() => planner.plans.map((p) => ({ value: p.id, label: planLabel(p) })))
const semLabel = computed(() => bidding.targetSem?.label.replace('S', 'Sem ') ?? '')
const emptyReason = computed(() => {
  const t = bidding.targetSem
  if (bidding.bookedSections.length || bidding.unavailableSelections.length) return ''
  if (!t) return `${bidding.plan.name} has no semester after ${bidding.plan.currentSem}, so there is nothing to bid for.`
  if (bidding.notOffered.length && !bidding.bookedSections.length) return 'Your planned modules are saved. A bidding timetable will be available when section data is loaded for this term.'
  if (t.exchange) return `${t.label} is an exchange semester in ${bidding.plan.name}, so there is nothing to bid for.`
  return `${bidding.plan.name} has no biddable modules in ${t.label} (or they were all dropped from the cart). Drag modules into that semester in the What-If Planner.`
})

// The current BOSS round (GET /api/bidding/round, via the bidding store)
const round = computed(() => {
  if (!bidding.roundInfo.closesAt) return { term: bidding.roundInfo.term, closesIn: null }
  if (bidding.roundInfo.closesAt <= Date.now()) return { term: bidding.roundInfo.term, closesIn: 'Closed' }
  const mins = Math.max(0, Math.floor((bidding.roundInfo.closesAt - Date.now()) / 60_000))
  const closesIn = mins >= 1440 ? `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h` : `${Math.floor(mins / 60)}h ${mins % 60}m`
  return { term: bidding.roundInfo.term, closesIn }
})

// Alternative sections only appear for the module that has been clicked (selected)
function cardsAt(day, slot) {
  const focus = bidding.selectedModule
  const expand = (rows, option) => rows.flatMap(s => sectionMeetings(s)
    .filter(m => m.day === day && m.slot === slot)
    .map(m => ({ ...s, meeting: m, venueShort: m.venue || s.venueShort, option })))
  const options = focus && !bidding.isLocked(focus)
    ? bidding.sectionsFor(focus).filter(s => bidding.booked[focus] !== s.id)
    : []
  return [...expand(bidding.bookedSections, false), ...expand(options, true)]
}

// While a module is selected, everything except it and its alternatives is greyed out
const isDimmed = (s) => bidding.selectedModule && !s.option && s.module !== bidding.selectedModule

function variantFor(s) {
  if (s.option) return 'option'
  if (bidding.isLocked(s.module)) return 'room'
  if (bidding.selectedModule === s.module) return 'selected'
  if (bidding.clashes.has(s.id)) return 'clash'
  return 'booked'
}

function onDragStart(e, s) {
  if (s.module !== bidding.selectedModule || bidding.isLocked(s.module)) return e.preventDefault()
  dragging.value = s.module
  e.dataTransfer.effectAllowed = 'move'
}

function onDrop({ day, slot }) {
  const target = sections.find((s) => s.module === dragging.value && sectionMeetings(s).some(m => m.day === day && m.slot === slot))
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

// Work-study electives and SMU-X projects have no fixed class time, so they can't sit on the grid: they are
// listed under it instead, with the selected module's other timetable-free sections to swap to
const noTime = (s) => !sectionMeetings(s).length
const unscheduled = computed(() => {
  const focus = bidding.selectedModule
  const booked = bidding.bookedSections.filter((s) => s && noTime(s)).map((s) => ({ ...s, option: false }))
  const options = focus && !bidding.isLocked(focus)
    ? bidding.sectionsFor(focus).filter((s) => bidding.booked[focus] !== s.id && noTime(s)).map((s) => ({ ...s, option: true }))
    : []
  return [...booked, ...options]
})

const clashList = computed(() => [...bidding.clashes].map((id) => id.replace('-', ' ')).join(', '))
</script>

<template>
  <div>
    <PageHeader :overline="round.term" title="BOSS Bidding Planner">
      <template #badge>
        <StatusPill tone="warning">{{ round.closesIn ? (round.closesIn === 'Closed' ? 'Round closed' : `Closes in ${round.closesIn}`) : 'Deadline not configured' }}</StatusPill>
      </template>
      <template #actions>
        <SelectField v-model="bidding.planId" :options="planOptions" width="w-[270px]" />
        <BaseButton variant="ghost" size="lg" href="https://boss.intranet.smu.edu.sg/">Go to BOSS</BaseButton>
        <BaseButton variant="outline" size="lg" to="/bidding/finalised">Go to Plans</BaseButton>
      </template>
    </PageHeader>

    <main class="flex flex-col gap-4 px-5 lg:px-16 pt-8 pb-12">
      <div class="flex flex-col items-start justify-between gap-6 xl:flex-row xl:items-end">
        <div class="flex flex-col gap-0.5">
          <h2 class="text-[17px] font-semibold">{{ semLabel }} timetable, imported from {{ bidding.plan.name }} in the What-If Planner</h2>
          <p class="text-[13px] text-muted-foreground">
            Click a card to see its other sections, then click or drag onto one to swap. Other modules are locked. Click the card again, or anywhere else on the calendar, to deselect.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
          <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border-l-[3px] border-success bg-secondary" /> Booked section</span>
          <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border-2 border-dashed border-primary bg-primary-tint" /> Alternative section (shown after you click a card)</span>
          <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border-2 border-primary" /> Selected</span>
          <span class="flex items-center gap-1.5"><span class="h-3 w-4 rounded-[3px] border-2 border-success bg-success-tint" /> Your shared room section (locked)</span>
        </div>
      </div>

      <p v-if="!bidding.roundInfo.configured" class="text-sm text-muted-foreground">Catalogue preview: {{ round.term }}. An active bidding term and round have not been configured.</p>
      <p v-if="bidding.loadError" role="alert" class="text-sm text-destructive">{{ bidding.loadError }} <button type="button" class="underline" @click="bidding.load()">Retry</button></p>
      <p v-if="bidding.roomConflicts.length" role="alert" class="text-sm text-destructive">You picked different sections for {{ bidding.roomConflicts.join(', ') }} in different rooms. Update or stop sharing a pick in those rooms before saving bids.</p>
      <p v-if="bidding.notOffered.length" role="status" class="text-sm text-muted-foreground">
        Section data is not available for {{ bidding.notOffered.join(', ') }} in {{ bidding.round.term }}. Your modules remain in the degree plan.
      </p>
      <section v-if="bidding.unavailableSelections.length" class="card flex flex-col gap-4 border-destructive p-5" aria-labelledby="unavailable-sections-title">
        <div>
          <h2 id="unavailable-sections-title" class="font-semibold">Saved sections unavailable</h2>
          <p role="alert" class="mt-1 text-sm text-destructive">Your saved choices have been retained. Choose replacements or remove these modules before saving bids.</p>
        </div>
        <div v-for="item in bidding.unavailableSelections" :key="item.module" class="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <div class="min-w-48 flex-1 text-sm">
            <p class="font-semibold">{{ item.module }} {{ item.section }} · Section unavailable</p>
            <p class="text-muted-foreground">{{ moduleName(item.module) }} · Saved bid e$ {{ bidding.bids[item.module] }}</p>
          </div>
          <label v-if="bidding.sectionsFor(item.module).length" class="flex flex-col gap-1 text-sm">
            Replacement section for {{ item.module }}
            <select :value="''" class="rounded-md border border-border bg-card p-2" @change="bidding.swapSection(item.module, $event.target.value)">
              <option value="" disabled>Choose a replacement</option>
              <option v-for="s in bidding.sectionsFor(item.module)" :key="s.id" :value="s.id">{{ s.section }} · {{ bidding.slotLabel(s) }}</option>
            </select>
          </label>
          <p v-else class="text-sm text-muted-foreground">No active alternatives available.</p>
          <BaseButton variant="destructive-outline" size="sm" :aria-label="`Remove unavailable ${item.module} from bidding`" @click="bidding.dropModule(item.module)">Remove module</BaseButton>
        </div>
      </section>
      <div v-if="emptyReason" v-enter class="card flex flex-col items-start gap-3 p-6"> <!-- motion: fade + slide up on mount -->
        <p class="text-[14px] leading-normal">{{ emptyReason }}</p>
        <BaseButton variant="outline" to="/planner">Open the What-If Planner</BaseButton>
      </div>

      <div v-else v-enter class="flex flex-col items-stretch gap-4 xl:flex-row"> <!-- motion: fade + slide up on mount -->
        <div class="flex min-w-0 flex-1 flex-col gap-3">
          <div @click="bidding.selectedModule = null">
          <TimetableGrid row-height="min-h-[100px]" @cell-drop="onDrop">
            <template #cell="{ day, slot }">
              <!-- motion: alternative sections pop in when a card is selected, and out when deselected -->
              <TransitionGroup tag="div" class="flex min-h-0 flex-1 flex-col gap-1" :css="false" @enter="popEnter" @leave="popLeave">
              <button
                v-for="s in cardsAt(day, slot)"
                :key="`${s.id}:${s.meeting.start}`"
                type="button"
                :aria-disabled="isDimmed(s)"
                :draggable="!s.option && s.module === bidding.selectedModule && !bidding.isLocked(s.module)"
                class="flex min-h-0 w-full shrink"
                :class="!s.option && s.module === bidding.selectedModule && !bidding.isLocked(s.module) && 'cursor-grab active:cursor-grabbing'"
                @dragstart="onDragStart($event, s)"
                @dragend="dragging = null"
                @click="onCardClick($event, s)"
              >
                <TimetableModuleCard
                  :code="s.module"
                  :section="s.section"
                  :name="moduleName(s.module)"
                  :meta="`${s.meeting.start}–${s.meeting.end} · ${s.profShort} · ${s.venueShort}`"
                  :variant="variantFor(s)"
                  :class="[isDimmed(s) && 'opacity-30 grayscale', bidding.isLocked(s.module) && bidding.selectedModule === s.module && 'ring-2 ring-success ring-offset-2']"
                >
                  <span v-if="partyOf(s.module).length" class="mt-1 flex">
                    <UserAvatar
                      v-for="(f, i) in partyOf(s.module)"
                      :key="f.id"
                      :initials="f.initials"
                      :title="f.you ? 'You' : f.name"
                      :you="f.you"
                      class="ring-2 ring-success-tint"
                      :class="i > 0 && '-ml-1'"
                    />
                  </span>
                </TimetableModuleCard>
              </button>
              </TransitionGroup>
            </template>
          </TimetableGrid>
          <div v-if="unscheduled.length" class="mt-3 flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
            <p class="text-overline text-muted-foreground">No fixed class time</p>
            <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <button
                v-for="s in unscheduled"
                :key="s.id"
                type="button"
                :aria-disabled="isDimmed(s)"
                class="flex w-full"
                @click="onCardClick($event, s)"
              >
                <TimetableModuleCard
                  :code="s.module"
                  :section="s.section"
                  :name="moduleName(s.module)"
                  :meta="`No fixed class time · ${s.profShort || 'Instructor not listed'}`"
                  :variant="variantFor(s)"
                  :class="isDimmed(s) && 'opacity-30 grayscale'"
                />
              </button>
            </div>
            <p class="text-[12px] text-muted-foreground">Work-study electives and SMU-X projects have no weekly classes, so they never clash.</p>
          </div>
          </div>
          <p v-if="lockedFocus" class="text-[13px] leading-normal">
            <span class="font-mono font-bold">{{ lockedFocus.module }} {{ lockedFocus.sectionId.split(':').pop() }}</span> is locked because
            you shared it in {{ lockedFocus.roomName }}<template v-if="friendsOf(lockedFocus.module).length">, alongside {{ friendsOf(lockedFocus.module).map((f) => f.name).join(', ') }}</template>. Change or stop sharing your section in the room to unlock it.
            <RouterLink :to="`/rooms/${lockedFocus.roomId}`" class="font-medium text-primary hover:underline">Open room</RouterLink>
          </p>
          <p v-if="bidding.fromRooms.length" class="text-[13px] text-muted-foreground">
            Your shared room picks:
            <template v-for="(d, i) in bidding.fromRooms" :key="d.roomId"
              ><RouterLink :to="`/rooms/${d.roomId}`" class="font-medium text-primary hover:underline">{{ d.module }} {{ d.sectionId.split(':').pop() }} ({{ d.roomName }})</RouterLink
              ><span v-if="i < bidding.fromRooms.length - 1">, </span></template
            >. Review the amounts and save your bids. Your What-If plans stay unchanged.
          </p>
          <p v-if="bidding.notOffered.length" class="text-[13px] text-muted-foreground">
            No active sections available for {{ bidding.notOffered.join(', ') }}, so {{ bidding.notOffered.length === 1 ? 'it is' : 'they are' }} not shown here.
          </p>
          <p v-if="bidding.archivedSelections.length" role="alert" class="text-[13px] text-destructive">Archived selections: {{ bidding.archivedSelections.join(', ') }}. Choose an active alternative or remove the module before saving. Your previous saved cart is retained.</p>
          <p v-if="bidding.clashes.size" class="text-[13px] text-destructive">
            Class or exam clash: {{ clashList }} overlap. Click one and pick an alternative section.
          </p>
          <ExamSchedule :sections="bidding.bookedSections" />
        </div>

        <BidSidebar :code="bidding.selectedModule" @close="bidding.selectedModule = null" />
      </div>
    </main>
  </div>
</template>
