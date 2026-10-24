<script setup>
// Accept card for a room: once everyone has voted, the section with the most votes can be accepted.
// A tie means accepting exactly one of the tied sections. Everything can be undone or switched.
import { meetingLabel } from '@core/utils/clash'
import { computed } from 'vue'
import { useRoomsStore } from '@core/stores/rooms'
import { days, slots, sections } from '@core/data/bidding'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import SectionBids from '@/components/rooms/SectionBids.vue'

const props = defineProps({
  roomId: { type: String, required: true },
})

const rooms = useRoomsStore()
const room = computed(() => rooms.getRoom(props.roomId))
const state = computed(() => rooms.roomState(room.value))

const when = meetingLabel
const leaders = computed(() =>
  state.value.leaders.map((id) => {
    const voters = rooms.votersOf(room.value, id).map(rooms.person)
    return { section: sections.find((s) => s.id === id), count: voters.length, names: voters.map((v) => v.short).join(', ') }
  }),
)
const accepted = computed(() => leaders.value.find((l) => l.section.id === state.value.acceptedId) ?? null)
const waitingNames = computed(() => state.value.waiting.map((id) => rooms.person(id).short).join(', '))

const pill = computed(() => {
  if (!state.value.allVoted) return ['warning', 'Voting']
  if (accepted.value) return ['success', 'Accepted']
  return state.value.tie ? ['info', 'Tie'] : ['info', 'Ready to accept']
})
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-lg border p-3.5"
    :class="accepted ? 'border-success bg-success-tint' : state.allVoted ? 'border-primary bg-primary-tint' : 'border-border'"
  >
    <StatusPill class="self-start" :tone="pill[0]">{{ pill[1] }}</StatusPill>

    <div v-if="!state.allVoted" class="flex flex-col gap-0.5 leading-normal">
      <p class="text-[15px] font-semibold">{{ state.voted }} of {{ state.total }} voted</p>
      <p class="text-[12px] text-muted-foreground">Waiting for {{ waitingNames }}</p>
    </div>

    <ul v-else class="flex flex-col gap-2">
      <li v-for="l in leaders" :key="l.section.id" class="flex flex-col gap-2 rounded-md border border-border bg-card p-2.5">
        <div class="flex items-end justify-between gap-2">
          <span class="font-mono text-[32px] leading-none font-bold">{{ l.section.section }}</span>
          <span class="text-right text-[12px] leading-normal text-muted-foreground">
            {{ when(l.section) }}<br />{{ l.count }} {{ l.count === 1 ? 'vote' : 'votes' }}
          </span>
        </div>
        <p class="text-[12px] leading-normal text-muted-foreground">{{ l.names }}</p>
        <BaseButton v-if="l.section.id === state.acceptedId" variant="outline" size="sm" block @click="rooms.undoAccept(roomId)">Undo</BaseButton>
        <BaseButton
          v-else
          :variant="state.acceptedId ? 'outline' : 'primary'"
          size="sm"
          block
          @click="rooms.acceptSection(roomId, l.section.id)"
        >{{ state.acceptedId ? 'Switch to this' : 'Accept' }}</BaseButton>
      </li>
    </ul>

    <!-- Accepted: everyone's suggested bids for that section -->
    <template v-if="accepted">
      <div class="border-t border-success pt-3">
        <SectionBids compact :room-id="roomId" :section-id="accepted.section.id" :label="accepted.section.section" />
      </div>
      <BaseButton variant="outline" size="sm" block to="/bidding">Open Bidding</BaseButton>
    </template>
  </div>
</template>
