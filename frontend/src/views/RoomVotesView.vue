<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomsStore } from '@core/stores/rooms'
import { days, slots, sections } from '@core/data/bidding'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import TimetableGrid from '@/components/TimetableGrid.vue'
import BackButton from '@/components/layout/BackButton.vue'

const route = useRoute()
const router = useRouter()
const rooms = useRoomsStore()

const room = computed(() => rooms.getRoom(route.params.id))
if (!room.value) router.replace('/rooms')

const mine = computed(() => rooms.myVotes[route.params.id] ?? [])
const isCreator = true // TODO(backend): room.creatorId === signed-in user; only the creator can finalise

// TODO(backend): poll GET /api/rooms/:id/votes for near-real-time updates
const rows = computed(() =>
  sections
    .filter((s) => s.module === room.value.module)
    .map((section) => {
      const others = room.value.votes[section.id] ?? []
      const voters = [...(mine.value.includes(section.id) ? ['me'] : []), ...others].map(rooms.person)
      return { section, voters, count: voters.length }
    }),
)
const ranking = computed(() => [...rows.value].sort((a, b) => b.count - a.count || a.section.section.localeCompare(b.section.section)))
const leader = computed(() => (ranking.value[0]?.count ? ranking.value[0] : null))
const votedCount = computed(() => new Set(rows.value.flatMap((r) => r.voters.map((v) => v.id))).size)
const totalVotes = computed(() => rows.value.reduce((a, r) => a + r.count, 0))

const when = (s) => `${days[s.day].slice(0, 3)} ${slots[s.slot].start}–${slots[s.slot].end}`
const cardsAt = (day, slot) => rows.value.filter((r) => r.section.day === day && r.section.slot === slot)
const isLeader = (r) => leader.value?.section.id === r.section.id
const isFinalised = computed(() => room.value.finalised)
</script>

<template>
  <div v-if="room">
    <section class="flex flex-col gap-2 border-b border-border bg-card px-16 py-6">
      <p class="text-overline text-muted-foreground">Collab rooms / room #{{ room.id }} / slot votes</p>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <BackButton :to="`/rooms/${room.id}`" />
          <h1 class="text-page-title leading-normal">{{ room.name }}</h1>
        </div>
        <BaseButton variant="link" :to="`/rooms/${room.id}`">Back to room</BaseButton>
      </div>
    </section>

    <main class="px-16 pt-8 pb-12">
      <div v-enter class="card flex items-stretch overflow-hidden"> <!-- motion: fade + slide up on mount -->
        <aside class="flex w-[280px] shrink-0 flex-col gap-4 border-r border-border p-5">
          <div class="flex flex-col gap-1.5 leading-normal">
            <h2 class="text-[18px] font-semibold">{{ room.name }}</h2>
            <p class="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span class="rounded-sm bg-secondary px-1.5 py-px font-mono text-[11px] font-bold text-foreground">{{ room.module }}</span>
              {{ votedCount }} of {{ room.members.length }} voted
            </p>
          </div>

          <div class="flex flex-col gap-2">
            <p class="text-overline text-muted-foreground">Ranking</p>
            <ul v-stagger class="flex flex-col gap-2"> <!-- motion: ranking rows stagger in -->
              <li
                v-for="r in ranking"
                :key="r.section.id"
                class="flex items-center gap-3 rounded-md border px-3 py-2.5 text-[13px]"
                :class="isLeader(r) ? 'border-success bg-success-tint' : 'border-border'"
              >
                <span class="font-mono font-bold">{{ r.section.section }}</span>
                <span class="flex-1">{{ when(r.section) }}</span>
                <span class="font-mono font-bold">{{ r.count }}</span>
              </li>
            </ul>
          </div>

          <template v-if="isCreator">
            <BaseButton
              v-if="!isFinalised"
              block
              :disabled="!leader"
              @click="rooms.finalise(room.id, leader.section.id)"
            >
              Finalise {{ leader?.section.section ?? '' }} for everyone
            </BaseButton>
            <p v-else class="rounded-md bg-success-tint px-3 py-2.5 text-center text-[13px] font-semibold text-success">
              Finalised · {{ rows.find((r) => r.section.id === isFinalised).section.section }}
            </p>
          </template>
          <BaseButton variant="ghost" class="self-start" :to="`/rooms/${room.id}`">Change my picks</BaseButton>
          <p class="text-[12px] leading-normal text-muted-foreground">
            Only the room creator can finalise. Others see "Waiting for {{ rooms.person(room.members[0]).short === 'You' ? 'Vignesh' : rooms.person(room.members[0]).short }} to finalise".
          </p>
        </aside>

        <section class="flex min-w-0 flex-1 flex-col gap-4 p-5">
          <div class="flex items-center justify-between">
            <p class="text-[13px] text-muted-foreground">Members could pick more than one section.</p>
            <StatusPill v-if="leader" tone="success">{{ leader.section.section }} is leading</StatusPill>
          </div>

          <TimetableGrid short row-height="h-[104px]">
            <template #cell="{ day, slot }">
              <div
                v-for="r in cardsAt(day, slot)"
                :key="r.section.id"
                class="flex flex-col gap-0.5 rounded-sm px-2.5 py-2 leading-normal"
                :class="
                  isLeader(r)
                    ? 'border-2 border-success bg-success-tint'
                    : r.count
                      ? 'bg-secondary'
                      : 'border-[1.5px] border-dashed border-border text-muted-foreground'
                "
              >
                <span class="font-mono text-[12px] font-bold" :class="isLeader(r) && 'text-success'">
                  {{ r.section.section }}<template v-if="isLeader(r)"> · Leading</template>
                </span>
                <span v-if="r.count" class="text-[12px] text-muted-foreground">
                  <span class="text-[16px] font-bold text-foreground">{{ r.count }}</span> {{ r.count === 1 ? 'vote' : 'votes' }}
                </span>
                <span v-else class="text-[12px]">No votes</span>
                <span v-if="r.count" class="mt-0.5 flex">
                  <UserAvatar
                    v-for="(v, i) in r.voters"
                    :key="v.id"
                    :initials="v.initials"
                    :you="v.you"
                    :class="i > 0 && '-ml-1 ring-2 ring-card'"
                  />
                </span>
              </div>
            </template>
          </TimetableGrid>

          <p class="text-[12px] text-muted-foreground">
            Sample results: {{ totalVotes }} section votes from {{ room.members.length }} people. Names and counts are illustrative.
          </p>
        </section>
      </div>
    </main>
  </div>
</template>
