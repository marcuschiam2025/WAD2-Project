<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomsStore } from '@/stores/rooms'
import { useBiddingStore } from '@/stores/bidding'
import { moduleName } from '@/data/catalogue'
import { sections } from '@/data/bidding'
import BaseButton from '@/components/ui/BaseButton.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import ModuleChip from '@/components/ModuleChip.vue'
import RoomInviteCard from '@/components/rooms/RoomInviteCard.vue'
import RoomMembersCard from '@/components/rooms/RoomMembersCard.vue'
import RoomSlotPicker from '@/components/rooms/RoomSlotPicker.vue'
import backToRoom from '@/assets/figma/back-to-room.svg'
import iconPencil from '@/assets/figma/icon-pencil.svg'
import iconInfo from '@/assets/figma/info-muted-16.svg'

const route = useRoute()
const router = useRouter()
const rooms = useRoomsStore()
const bidding = useBiddingStore()

const room = computed(() => rooms.getRoom(route.params.id))
if (!room.value) router.replace('/rooms')

const mine = computed(() => rooms.myVotes[route.params.id] ?? [])
const moduleSections = computed(() => sections.filter((s) => s.module === room.value.module))

// TODO(Backend 2): poll GET /api/rooms/:id/votes for near-real-time updates
const rows = computed(() =>
  moduleSections.value.map((s) => {
    const others = room.value.votes[s.id] ?? []
    const voters = [...(mine.value.includes(s.id) ? ['me'] : []), ...others].map(rooms.person)
    return { section: s, mine: mine.value.includes(s.id), voters }
  }),
)
const totalVotes = computed(() => rows.value.reduce((a, r) => a + r.voters.length, 0))

const selectionSummary = computed(() => {
  const picked = moduleSections.value.filter((s) => mine.value.includes(s.id)).map((s) => s.section)
  const notPicked = moduleSections.value.filter((s) => !mine.value.includes(s.id)).map((s) => s.section)
  return `Your selections: ${picked.join(' and ') || 'none'}${notPicked.length ? ` · ${notPicked.join(', ')} not selected` : ''}`
})
</script>

<template>
  <div v-if="room">
    <section class="flex flex-col gap-3 border-b border-border bg-card px-7 py-6">
      <p class="text-overline text-muted-foreground">COLLAB ROOMS / ROOM #{{ room.id }} / SLOT VOTES</p>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <RouterLink :to="`/rooms/${room.id}`" aria-label="Back to room"><img :src="backToRoom" alt="" class="size-7" /></RouterLink>
          <h1 class="text-[26px] font-bold">{{ room.name }}</h1>
        </div>
        <RouterLink :to="`/rooms/${room.id}`" class="text-body font-medium text-primary hover:underline">Back to room</RouterLink>
      </div>
    </section>

    <main class="flex flex-col gap-6 px-16 pt-8 pb-16">
      <div class="flex gap-6">
        <section class="card flex flex-1 flex-col gap-2.5 p-5">
          <p class="text-small text-muted-foreground">Modules for bid</p>
          <div class="flex items-center gap-3">
            <ModuleChip :code="room.module" />
            <h2 class="text-h3">{{ moduleName(room.module) }}</h2>
          </div>
          <p class="text-small text-muted-foreground">{{ selectionSummary }}</p>
        </section>
        <RoomMembersCard :room="room" :footer="`Room #${room.id} · Up to ${room.maxMembers} members`" />
      </div>

      <RoomInviteCard :room="room" />

      <section class="card flex flex-col gap-4 p-5">
        <div class="flex items-center gap-4">
          <div class="flex flex-1 flex-col gap-0.5">
            <h2 class="text-h4">Modules for bid</h2>
            <p class="text-small text-muted-foreground">
              Pick the session slots you’d like to take for this module. You can choose more than one option.
            </p>
          </div>
          <div class="flex items-center gap-3.5 text-[12px] text-muted-foreground">
            <span class="flex items-center gap-1.5"><span class="size-3.5 rounded-sm bg-success" /> Selected slot</span>
            <span class="flex items-center gap-1.5"><span class="size-3.5 rounded-sm bg-muted" /> Available slot</span>
          </div>
        </div>
        <RoomSlotPicker :model-value="mine" :module="room.module" readonly chosen-variant="chosen-success" />
        <div class="flex items-center gap-3">
          <BaseButton :to="`/rooms/${room.id}`"><img :src="iconPencil" alt="" class="size-4" /> Amend slots</BaseButton>
          <p class="text-small text-muted-foreground">You can choose more than one slot.</p>
        </div>
      </section>

      <section class="card flex flex-col gap-5 p-5">
        <div class="flex flex-col gap-1">
          <h2 class="text-h3">Slot votes</h2>
          <p class="text-small text-muted-foreground">
            See how many people chose each section and who shares your preferred slots.
          </p>
        </div>

        <div class="overflow-hidden rounded-lg border border-border">
          <div class="flex h-11 bg-muted text-overline text-muted-foreground">
            <span class="flex w-[168px] items-center px-5">SECTION</span>
            <span class="flex w-[300px] items-center px-5">DAY / TIME</span>
            <span class="flex w-[156px] items-center px-5">PEOPLE</span>
            <span class="flex flex-1 items-center px-5">VOTERS</span>
            <span class="flex w-[140px] items-center px-5">ACTION</span>
          </div>
          <div v-for="r in rows" :key="r.section.id" class="flex min-h-[104px] border-t border-border">
            <div class="flex w-[168px] flex-col justify-center gap-2 p-5">
              <span
                class="w-fit rounded-sm px-2.5 py-1 text-[14px] font-semibold"
                :class="r.mine ? 'bg-primary-soft text-primary' : 'bg-muted'"
              >{{ r.section.section }}</span>
              <span class="text-small" :class="r.mine ? 'text-primary' : 'text-muted-foreground'">
                {{ r.mine ? 'Selected by you' : 'Not selected' }}
              </span>
            </div>
            <div class="flex w-[300px] flex-col justify-center gap-1 border-l border-border p-5">
              <span class="text-body">{{ bidding.slotLabel(r.section) }}</span>
              <span class="text-small text-muted-foreground">{{ r.section.profShort }} · {{ r.section.venueShort }}</span>
            </div>
            <div
              class="flex w-[156px] flex-col justify-center gap-0.5 border-l border-border p-5"
              :class="!r.voters.length && 'text-muted-foreground'"
            >
              <span class="text-h3">{{ r.voters.length }}</span>
              <span class="text-small text-muted-foreground">{{ r.voters.length === 1 ? 'person' : 'people' }}</span>
            </div>
            <div class="flex flex-1 flex-wrap items-center gap-[18px] border-l border-border p-5">
              <span v-for="v in r.voters" :key="v.id" class="flex items-center gap-2">
                <UserAvatar :initials="v.initials" :you="v.you" />
                <span class="text-body">{{ v.name }}</span>
              </span>
              <span v-if="!r.voters.length" class="text-body text-muted-foreground">No votes yet</span>
            </div>
            <div class="flex w-[140px] items-center border-l border-border p-5">
              <span
                v-if="room.finalised === r.section.id"
                class="flex flex-1 justify-center rounded-sm bg-success-soft px-3 py-2 text-small font-medium text-success"
              >Finalised</span>
              <button
                v-else
                type="button"
                class="flex-1 rounded-sm bg-primary px-3 py-2 text-small text-primary-foreground hover:bg-primary/90"
                @click="rooms.finalise(room.id, r.section.id)"
              >
                Finalise
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-start gap-2 border-t border-border pt-4">
          <img :src="iconInfo" alt="" class="size-4" />
          <p class="flex-1 text-small text-muted-foreground">
            {{ totalVotes }} section votes from {{ room.members.length }} people. Members may choose multiple sections.
            Finalising a section marks it as the room’s agreed slot for bidding.
          </p>
        </div>
      </section>
    </main>
  </div>
</template>
