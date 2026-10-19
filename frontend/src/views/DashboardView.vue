<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useUserStore } from '@backend/stores/user'
import { useBiddingStore } from '@backend/stores/bidding'
import { trackName } from '@backend/data/catalogue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'

const user = useUserStore()
const bidding = useBiddingStore()

// TODO(backend): replace with the current BOSS round from GET /api/bidding/round
const round = {
  term: 'AY24/25 · Sem 2 · Round 1A',
  label: 'Round 1A · closes Fri 17:00',
  closesAt: new Date(Date.now() + (2 * 60 + 15) * 60 * 1000),
}

// TODO(backend): replace with GET /api/users/me/progress (requirement checker)
const cuDone = 104
const cuTotal = 152

// TODO(backend): replace with GET /api/users/me/feed — deadlines, parsed emails and to-dos, sorted by due time.
// kind: Bid | Email | Due | To-do. urgent=true shows the time in red.
const feed = [
  { id: 1, kind: 'Bid', title: 'Submit Round 1A bid cart', meta: '6 modules · e$ 168', when: '17:00', urgent: true },
  { id: 2, kind: 'Email', title: 'BOSS: Round 1A closes in 2h 15m', meta: 'boss-notify@smu.edu.sg', when: '08:00' },
  { id: 3, kind: 'Email', title: 'IS442 midterm venue changed', meta: 'prof.tan@smu.edu.sg', when: '09:12' },
  { id: 4, kind: 'Due', title: 'IS111 Quiz 3', meta: 'Mon, Week 8', when: 'in 5d' },
  { id: 5, kind: 'Due', title: 'IS216 Assignment 2', meta: 'Wed, Week 9', when: 'in 12d' },
  { id: 6, kind: 'To-do', title: 'Confirm KAIST exchange mapping', meta: 'Optional', when: '—' },
]

// Live countdown to the round closing
const now = ref(Date.now())
let timer
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 30_000)))
onBeforeUnmount(() => clearInterval(timer))
const countdown = computed(() => {
  const mins = Math.max(0, Math.floor((round.closesAt - now.value) / 60_000))
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
})

const cartCount = computed(() => Object.keys(bidding.bids).length)
const allocatedRatio = computed(() => bidding.allocated / user.balance)
const figures = computed(() => [
  { value: `e$ ${bidding.allocated.toLocaleString()}`, label: 'allocated this round' },
  { value: cartCount.value, label: 'modules in cart' },
  { value: `e$ ${(user.balance - bidding.allocated).toLocaleString()}`, label: 'left after round' },
])
const stats = computed(() => [
  { label: 'Graduation', value: `${cuDone} / ${cuTotal} CU` },
  { label: 'Balance', value: `e$ ${user.balance.toLocaleString()}` },
  { label: 'Track', value: user.profile.tracks.map(trackName).join(', ') || 'Undecided' },
])
</script>

<template>
  <div>
    <PageHeader :overline="round.term" :title="`Welcome back, ${user.profile.firstName}`">
      <template #actions>
        <BaseButton variant="outline" to="/bidding/finalised">Sync to Calendar</BaseButton>
      </template>
    </PageHeader>

    <main class="flex items-start gap-4 px-16 pt-8 pb-12">
      <!-- Round card -->
      <section v-enter class="card flex min-w-0 flex-1 flex-col gap-4 p-6"> <!-- motion: fade + slide up on mount -->
        <p class="text-overline text-muted-foreground">{{ round.label }}</p>
        <div class="flex items-baseline gap-2.5 whitespace-nowrap">
          <span class="font-mono text-[40px] leading-normal font-bold tracking-[-0.8px]">{{ countdown }}</span>
          <span class="text-[14px] text-muted-foreground">left to submit your bids</span>
        </div>
        <div class="flex gap-3">
          <div v-for="f in figures" :key="f.label" class="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md bg-muted px-3 py-2.5">
            <span class="font-mono text-[18px] leading-normal font-bold">{{ f.value }}</span>
            <span class="text-[12px] text-muted-foreground">{{ f.label }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <ProgressBar :value="allocatedRatio" />
          <p class="text-[12px] text-muted-foreground">
            e$ {{ bidding.allocated.toLocaleString() }} of e$ {{ user.balance.toLocaleString() }} allocated
            ({{ Math.round(allocatedRatio * 100) }}%)
          </p>
        </div>
        <div class="flex gap-2">
          <BaseButton to="/bidding">Review bid cart</BaseButton>
          <BaseButton variant="ghost" to="/bidding">Open simulator</BaseButton>
        </div>
        <div class="flex items-center gap-7 border-t border-border pt-3 text-[13px] whitespace-nowrap">
          <p v-for="s in stats" :key="s.label" class="flex items-center gap-1.5">
            <span class="text-muted-foreground">{{ s.label }}</span>
            <span class="font-mono font-bold">{{ s.value }}</span>
          </p>
        </div>
      </section>

      <!-- For you today -->
      <section v-enter="0.08" class="card flex w-[520px] shrink-0 flex-col p-5"> <!-- motion: fade + slide up, 80ms delay -->
        <div class="flex items-center justify-between pb-3">
          <h2 class="text-h4">For you today</h2>
          <span class="text-[12px] text-muted-foreground">Sorted by due time</span>
        </div>
        <ul v-stagger="0.12"> <!-- motion: each feed item staggers in 120ms apart -->
          <li v-for="item in feed" :key="item.id" class="flex items-start gap-3 border-t border-border py-3">
            <span
              class="flex w-[58px] shrink-0 justify-center rounded-sm bg-muted px-1.5 py-[3px] text-[10px] leading-normal font-semibold tracking-[0.4px] text-muted-foreground uppercase"
            >{{ item.kind }}</span>
            <div class="flex min-w-0 flex-1 flex-col gap-0.5 leading-normal">
              <p class="text-[14px] font-medium">{{ item.title }}</p>
              <p class="text-[12px] text-muted-foreground">{{ item.meta }}</p>
            </div>
            <span
              class="font-mono text-[12px] leading-normal whitespace-nowrap"
              :class="item.urgent ? 'font-bold text-destructive' : 'font-medium text-muted-foreground'"
            >{{ item.when }}</span>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
