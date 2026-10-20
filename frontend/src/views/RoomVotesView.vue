<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomsStore } from '@core/stores/rooms'
import { days, slots, sections, MIN_BID, sectionBidHistory, bidStats } from '@core/data/bidding'
import { popEnter, popLeave } from '@/motion'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import TimetableGrid from '@/components/TimetableGrid.vue'
import BackButton from '@/components/layout/BackButton.vue'
import iconX from '@/assets/figma/icon-x.svg'

const route = useRoute()
const router = useRouter()
const rooms = useRoomsStore()

const room = computed(() => rooms.getRoom(route.params.id))
if (!room.value) router.replace('/rooms')

const mine = computed(() => rooms.myVotes[route.params.id] ?? [])

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

// Click a section (card or ranking row) to see how it cleared in past terms
const selectedId = ref(null)
const selectedRow = computed(() => rows.value.find((r) => r.section.id === selectedId.value) ?? null)
const history = computed(() => (selectedRow.value ? sectionBidHistory(selectedRow.value.section) : []))
const stats = computed(() => bidStats(history.value))
const select = (r) => (selectedId.value = selectedId.value === r.section.id ? null : r.section.id)

// Suggested bid for the clicked section. You can only suggest one for a section you picked.
const sectionBids = computed(() => room.value.suggestedBids[selectedId.value] ?? {})
const canBid = computed(() => mine.value.includes(selectedId.value))
const bidInput = ref('')
watch(selectedId, () => (bidInput.value = sectionBids.value.me ?? ''), { immediate: true })
const bidAmount = computed(() => Number(bidInput.value))
const bidValid = computed(() => bidInput.value !== '' && Number.isInteger(bidAmount.value) && bidAmount.value >= MIN_BID)
const savedBid = computed(() => sectionBids.value.me ?? null)
const saveBid = () => bidValid.value && rooms.setMyBid(room.value.id, selectedId.value, bidAmount.value)

const suggestions = computed(() =>
  Object.entries(sectionBids.value)
    .map(([id, amount]) => ({ person: rooms.person(id), amount }))
    .sort((a, b) => b.amount - a.amount),
)
const avgBid = computed(() =>
  suggestions.value.length ? Math.round(suggestions.value.reduce((a, s) => a + s.amount, 0) / suggestions.value.length) : null,
)
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
      <div v-enter class="card flex items-stretch overflow-hidden">
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
              <li v-for="r in ranking" :key="r.section.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors"
                  :class="
                    selectedId === r.section.id
                      ? 'border-primary bg-primary-tint'
                      : isLeader(r)
                        ? 'border-success bg-success-tint hover:bg-success-tint'
                        : 'border-border hover:bg-muted'
                  "
                  @click="select(r)"
                >
                  <span class="font-mono font-bold">{{ r.section.section }}</span>
                  <span class="flex-1">{{ when(r.section) }}</span>
                  <span class="font-mono font-bold">{{ r.count }}</span>
                </button>
              </li>
            </ul>
          </div>

          <BaseButton variant="ghost" class="self-start" :to="`/rooms/${room.id}`">Change my picks</BaseButton>
        </aside>

        <section class="flex min-w-0 flex-1 flex-col gap-4 p-5">
          <div class="flex items-center justify-between">
            <p class="text-[13px] text-muted-foreground">Click a section to see how it cleared in past terms and to suggest a bid for it.</p>
            <StatusPill v-if="leader" tone="success">{{ leader.section.section }} is leading</StatusPill>
          </div>

          <!-- Past bid data for the clicked section (motion: pops in under the header) -->
          <Transition :css="false" @enter="popEnter" @leave="popLeave">
            <div v-if="selectedRow" class="flex flex-col gap-3 rounded-lg border border-border px-4 py-3.5">
              <div class="flex items-start justify-between gap-3 leading-normal">
                <div class="flex flex-col gap-0.5">
                  <p class="text-[14px] font-semibold">
                    <span class="font-mono">{{ room.module }}</span> {{ selectedRow.section.section }} · {{ when(selectedRow.section) }}
                  </p>
                  <p class="text-[12px] text-muted-foreground">{{ selectedRow.section.prof }} · {{ selectedRow.section.venue }}</p>
                </div>
                <button type="button" aria-label="Close past bid data" class="rounded-sm p-0.5 hover:bg-muted" @click="selectedId = null">
                  <img :src="iconX" alt="" class="size-4" />
                </button>
              </div>

              <template v-if="stats">
                <!-- TODO(backend): past results for this section come from GET /api/bidding/history?section=… -->
                <div class="flex gap-10">
                  <div class="flex flex-col gap-0.5 leading-normal">
                    <span class="text-[12px] text-muted-foreground">Median</span>
                    <span class="font-mono text-[20px] font-bold">e$ {{ stats.median }}</span>
                  </div>
                  <div class="flex flex-col gap-0.5 leading-normal">
                    <span class="text-[12px] text-muted-foreground">Mean</span>
                    <span class="font-mono text-[20px] font-bold">e$ {{ stats.mean }}</span>
                  </div>
                </div>
                <div class="flex flex-col text-[12px]">
                  <div class="grid grid-cols-[1.4fr_0.6fr_1fr_1fr] gap-2 border-b border-border pb-1.5 text-overline text-muted-foreground">
                    <span>Term</span><span>Round</span><span>Median bid</span><span>Lowest bid</span>
                  </div>
                  <div
                    v-for="h in history"
                    :key="h.term"
                    class="grid grid-cols-[1.4fr_0.6fr_1fr_1fr] gap-2 border-b border-border py-1.5 last:border-b-0"
                  >
                    <span>{{ h.term }}</span>
                    <span class="font-mono">{{ h.round }}</span>
                    <span class="font-mono">e$ {{ h.median }}</span>
                    <span class="font-mono">e$ {{ h.min }}</span>
                  </div>
                </div>
                <p class="text-[12px] text-muted-foreground">Median and mean are taken over the {{ history.length }} past terms above.</p>
              </template>
              <p v-else class="text-[13px] text-muted-foreground">No past bid data for this section yet.</p>

              <!-- Suggested bid for this section -->
              <div class="flex flex-col gap-2 border-t border-border pt-3">
                <p class="text-overline text-muted-foreground">Suggested bid for {{ selectedRow.section.section }}</p>
                <template v-if="canBid">
                  <div class="flex max-w-[320px] gap-2">
                    <label class="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border px-3 py-[7px] focus-within:border-ring">
                      <span class="text-[13px] text-muted-foreground">e$</span>
                      <input
                        v-model="bidInput"
                        type="number"
                        :min="MIN_BID"
                        step="1"
                        placeholder="e.g. 35"
                        :aria-label="`Suggested bid in e$ for ${selectedRow.section.section}`"
                        class="min-w-0 flex-1 bg-transparent font-mono text-[14px] font-medium outline-none"
                        @keydown.enter.prevent="saveBid"
                      />
                    </label>
                    <BaseButton size="sm" :disabled="!bidValid || bidAmount === savedBid" @click="saveBid">Save</BaseButton>
                  </div>
                  <span v-if="bidInput !== '' && !bidValid" class="text-[12px] text-destructive">Minimum bid is e$ {{ MIN_BID }}.</span>
                  <span v-else-if="savedBid !== null" class="text-[12px] text-muted-foreground">Your suggestion for {{ selectedRow.section.section }}: e$ {{ savedBid }}</span>
                </template>
                <p v-else class="text-[12px] leading-normal text-muted-foreground">
                  You haven't picked this section. Pick it to suggest a bid for it.
                  <RouterLink :to="`/rooms/${room.id}`" class="font-medium text-primary hover:underline">Change my picks</RouterLink>
                </p>

                <ul v-if="suggestions.length" class="flex flex-col gap-1.5 pt-1">
                  <li v-for="s in suggestions" :key="s.person.id" class="flex max-w-[320px] items-center gap-2 text-[13px]">
                    <UserAvatar :initials="s.person.initials" :size="24" :you="s.person.you" />
                    <span class="flex-1">{{ s.person.short }}</span>
                    <span class="font-mono font-medium">e$ {{ s.amount }}</span>
                  </li>
                </ul>
                <p v-if="avgBid !== null" class="text-[12px] text-muted-foreground">
                  Average of {{ suggestions.length }} suggestion{{ suggestions.length === 1 ? '' : 's' }} for {{ selectedRow.section.section }}: e$ {{ avgBid }}
                </p>
                <p v-else-if="canBid" class="text-[12px] text-muted-foreground">No suggestions for {{ selectedRow.section.section }} yet.</p>
              </div>
            </div>
          </Transition>

          <TimetableGrid short row-height="h-[104px]">
            <template #cell="{ day, slot }">
              <button
                v-for="r in cardsAt(day, slot)"
                :key="r.section.id"
                type="button"
                class="flex w-full flex-col gap-0.5 rounded-sm px-2.5 py-2 text-left leading-normal transition-shadow"
                :class="[
                  isLeader(r)
                    ? 'border-2 border-success bg-success-tint'
                    : r.count
                      ? 'bg-secondary'
                      : 'border-[1.5px] border-dashed border-border text-muted-foreground',
                  selectedId === r.section.id && 'ring-2 ring-primary ring-offset-1',
                ]"
                @click="select(r)"
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
              </button>
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
