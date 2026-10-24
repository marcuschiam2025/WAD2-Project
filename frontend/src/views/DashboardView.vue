<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useUserStore } from '@core/stores/user'
import { useBiddingStore } from '@core/stores/bidding'
import { usePlannerStore, effectiveCode } from '@core/stores/planner'
import { useRoomsStore } from '@core/stores/rooms'
import { moduleName } from '@core/data/catalogue'
import { sectionMeetings } from '@core/utils/clash'
import { slots, bidHistory, rateBid } from '@core/data/bidding'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import TodoList from '@/components/TodoList.vue'

const user = useUserStore()
const bidding = useBiddingStore()
const planner = usePlannerStore()
const rooms = useRoomsStore()

// The current BOSS round (GET /api/bidding/round, via the bidding store)
const round = computed(() => bidding.roundInfo)

const today = new Date()
const dateLabel = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const todayIdx = (today.getDay() + 6) % 7 // Monday = 0, same as the bidding timetable
const hhmm = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dayName = (offset) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString('en-GB', { weekday: 'short' })
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const closesOffset = computed(() => round.value.closesAt ? Math.round((midnight(round.value.closesAt) - midnight(today)) / 86_400_000) : null) // days until the round closes
const closesLabel = computed(() => round.value.closesAt ? `${round.value.closesAt.toLocaleDateString('en-GB', { weekday: 'short' })} ${hhmm(round.value.closesAt)}` : 'Deadline not configured')

// Live countdown to the round closing
const now = ref(Date.now())
let timer
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 30_000)))
onBeforeUnmount(() => clearInterval(timer))
const countdown = computed(() => {
  if (!round.value.closesAt) return 'Not configured'
  if (round.value.closesAt <= now.value) return 'Closed'
  const mins = Math.max(0, Math.floor((round.value.closesAt - now.value) / 60_000))
  if (mins >= 24 * 60) return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
})

// --- Stat cards ---------------------------------------------------------------------------
const left = computed(() => user.balance - bidding.allocated)
const over = computed(() => left.value < 0)
const degree = computed(() => planner.checklist.totals)
const stats = computed(() => [
  { label: `${round.value.name} closes in`, value: countdown.value, sub: closesLabel.value, accent: 'border-t-warning!' },
  { label: 'Balance', value: `e$ ${user.balance.toLocaleString()}`, sub: 'Available to bid', accent: 'border-t-primary!' },
  {
    label: 'Cart total',
    value: `e$ ${bidding.allocated.toLocaleString()}`,
    sub: over.value ? `e$ ${(-left.value).toLocaleString()} over balance` : `e$ ${left.value.toLocaleString()} left after the round`,
    danger: over.value,
    accent: over.value ? 'border-t-destructive!' : 'border-t-success!',
  },
  {
    label: 'Degree',
    value: String(degree.value.cleared),
    unit: `/ ${degree.value.required} courses cleared`,
    sub: `${degree.value.inProgress} in progress · ${degree.value.planned} planned${degree.value.late ? ` · ${degree.value.late} behind` : ''}`,
    subDanger: degree.value.late > 0,
    accent: 'border-t-primary!',
    to: '/planner',
  },
])

// --- Schedule -----------------------------------------------------------------------------
// TODO(backend): replace with GET /api/users/me/feed — assignment deadlines and quizzes.
// offset = days from today. Classes below come from the booked sections in the bidding store.
const deadlines = computed(() => round.value.closesAt ? [
  { id: 'bid', kind: 'Bid', title: 'Submit bid cart', meta: `${round.value.name} closes`, offset: closesOffset.value, time: hhmm(round.value.closesAt) },
] : [])

const classes = computed(() => bidding.bookedSections.flatMap(s => sectionMeetings(s).map(m => ({
  id: `class-${s.id}-${m.day}-${m.start}`,
  kind: 'Class',
  title: `${s.module} ${moduleName(s.module)}`,
  meta: `${s.section} · ${m.venue || s.venueShort}, to ${m.end}`,
  offset: (m.day - todayIdx + 7) % 7,
  time: m.start,
}))))

const minutes = (t) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : 24 * 60)
const ordered = (list) => [...list].sort((a, b) => (a.offset ?? 99) - (b.offset ?? 99) || minutes(a.time) - minutes(b.time))

const tab = ref('today')
const schedule = computed(() => {
  const all = ordered([...classes.value, ...deadlines.value])
  const items = tab.value === 'today' ? all.filter((i) => i.offset === 0) : all.filter((i) => i.offset <= 6)
  return items.map((i) => ({
    ...i,
    when: tab.value === 'today' ? i.time : `${dayName(i.offset)} ${i.time ?? ''}`.trim(),
  }))
})
const kindStyle = {
  Class: 'bg-primary-tint text-primary',
  Bid: 'bg-warning-tint text-foreground',
  Due: 'bg-secondary text-muted-foreground',
}

// --- Bid cart -----------------------------------------------------------------------------
const cart = computed(() =>
  Object.entries(bidding.bids)
    .map(([code, amount]) => {
      const n = Number(amount) || 0
      return { code, name: moduleName(code), amount: n, rating: rateBid(n, bidHistory[code] ?? [])?.rating ?? null }
    })
    .sort((a, b) => b.amount - a.amount),
)
const ratingPill = { safe: ['success', 'Safe'], competitive: ['warning', 'Competitive'], 'at-risk': ['destructive', 'At risk'] }
const withinPct = computed(() => `${Math.min(1, user.balance / Math.max(bidding.allocated, 1)) * 100}%`)
const overPct = computed(() => `${over.value ? (1 - user.balance / bidding.allocated) * 100 : 0}%`)
const spentPct = computed(() => `${Math.min(1, bidding.allocated / Math.max(user.balance, 1)) * 100}%`)

// --- Bottom strip -------------------------------------------------------------------------
const roomRows = computed(() =>
  rooms.rooms.slice(0, 3).map((room) => {
    const st = rooms.roomState(room)
    const mine = (rooms.myVotes[room.id] ?? []).length > 0
    const note = st.acceptedId
      ? `You accepted ${st.acceptedId.split('-')[1]}`
      : st.allVoted
        ? 'Everyone has voted · ready to accept'
        : `${st.voted} of ${st.total} voted${mine ? '' : ' · you have not picked yet'}`
    return { room, note }
  }),
)

// Plan problems: prerequisites not met, and required courses past their recommended term
const alerts = computed(() => {
  const plan = planner.activePlan
  const list = []
  plan.semesters.forEach((sem) =>
    sem.modules.forEach((entry) => {
      if (!planner.hasWarning(plan, entry, sem.id)) return
      const { prereqs, coreqs } = planner.checkModule(plan, entry, sem.id)
      const why = prereqs.length ? `prereq ${prereqs.join(', ')} not met` : `needs ${coreqs.join(', ')} in ${sem.label}`
      list.push(`${effectiveCode(entry)} · ${why}`)
    }),
  )
  planner.checklist.groups
    .flatMap((g) => g.slots)
    .filter((s) => s.urgency === 'late')
    .forEach((s) => list.push(`${s.label} · behind (recommended ${s.rec.label})`))
  return [...new Set(list)]
})

// BOSS bidding windows: the open round first, then the ones still to come.
// TODO(backend): replace with GET /api/bidding/rounds (every round with its open and close time)
const biddingWindows = computed(() => [
  { id: 'current', name: round.value.name, open: !!round.value.closesAt && round.value.closesAt > now.value, when: round.value.closesAt ? `Closes ${closesLabel.value}` : 'No official schedule configured' },
])

</script>

<template>
  <div>
    <PageHeader :overline="dateLabel" title="Your week at a glance" :subtitle="`Welcome back, ${user.profile.firstName}. ${round.term}`">
      <template #actions>
        <StatusPill tone="warning">{{ round.name }} closes {{ closesLabel }}</StatusPill>
        <BaseButton variant="outline" to="/bidding/finalised">Sync to Calendar</BaseButton>
      </template>
    </PageHeader>

    <main class="flex flex-col gap-4 px-16 pt-8 pb-12">
      <!-- Undecided about a track -->
      <section
        v-if="!user.profile.tracks.length"
        v-enter
        class="flex items-center justify-between gap-4 rounded-lg border border-primary bg-primary-tint px-4 py-3"
      >
        <!-- motion: fade + slide up on mount -->
        <div class="flex flex-col gap-0.5 leading-normal">
          <p class="text-[14px] font-semibold">You haven't picked a track yet</p>
          <p class="text-[13px] text-muted-foreground">A short quiz matches you to a track and suggests modules to add to your basket.</p>
        </div>
        <BaseButton to="/quiz">Take the track quiz</BaseButton>
      </section>

      <!-- Stat cards -->
      <div v-stagger="0.05" class="grid grid-cols-4 gap-4"> <!-- motion: stat cards stagger in -->
        <component
          :is="s.to ? 'RouterLink' : 'div'"
          v-for="s in stats"
          :key="s.label"
          :to="s.to"
          class="card flex flex-col gap-1.5 border-t-[3px]! p-5 leading-normal"
          :class="[s.accent, s.to && 'transition-shadow hover:shadow-md']"
        >
          <span class="text-overline text-muted-foreground">{{ s.label }}</span>
          <span class="flex items-baseline gap-2">
            <span class="font-mono text-[28px] leading-none font-bold" :class="s.danger && 'text-destructive'">{{ s.value }}</span>
            <span v-if="s.unit" class="text-[13px] text-muted-foreground">{{ s.unit }}</span>
          </span>
          <span class="text-[13px]" :class="s.danger || s.subDanger ? 'font-medium text-destructive' : 'text-muted-foreground'">{{ s.sub }}</span>
        </component>
      </div>

      <div class="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-4">
        <div class="flex flex-col gap-4">
        <!-- Schedule -->
        <section v-enter="0.1" class="card flex flex-col p-5"> <!-- motion: schedule fades in, 100ms delay -->
          <div class="flex items-center justify-between pb-3">
            <h2 class="text-h4">Schedule</h2>
            <div class="flex rounded-md border border-border p-0.5" role="tablist" aria-label="Schedule range">
              <button
                v-for="t in [['today', 'Today'], ['week', 'This week']]"
                :key="t[0]"
                type="button"
                role="tab"
                :aria-selected="tab === t[0]"
                class="rounded-sm px-3 py-1 text-[13px] font-medium transition-colors"
                :class="tab === t[0] ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
                @click="tab = t[0]"
              >{{ t[1] }}</button>
            </div>
          </div>
          <ul>
            <li v-for="i in schedule" :key="i.id" class="flex items-start gap-3 border-t border-border py-3">
              <span class="w-[74px] shrink-0 pt-0.5 font-mono text-[12px] leading-normal font-medium text-muted-foreground">{{ i.when }}</span>
              <div class="flex min-w-0 flex-1 flex-col gap-0.5 leading-normal">
                <p class="text-[14px] font-medium">{{ i.title }}</p>
                <p class="text-[12px] text-muted-foreground">{{ i.meta }}</p>
              </div>
              <span class="rounded-full px-2.5 py-[3px] text-[11px] leading-normal font-semibold" :class="kindStyle[i.kind]">{{ i.kind }}</span>
            </li>
            <li v-if="!schedule.length" class="border-t border-border py-4 text-[13px] text-muted-foreground">Nothing scheduled.</li>
          </ul>
        </section>

        <!-- To-do list (motion: fades in, 150ms delay) -->
        <TodoList v-enter="0.15" />
        </div>

        <!-- Bid cart -->
        <section v-enter="0.15" class="card flex flex-col gap-3 p-5"> <!-- motion: bid cart fades in, 150ms delay -->
          <div class="flex items-center justify-between">
            <h2 class="text-h4">Bid cart</h2>
            <span class="text-[13px]" :class="over ? 'font-semibold text-destructive' : 'text-muted-foreground'">
              {{ over ? `e$ ${(-left).toLocaleString()} over` : `e$ ${left.toLocaleString()} left` }}
            </span>
          </div>
          <div class="flex h-2 overflow-hidden rounded-full bg-border">
            <template v-if="over">
              <span class="bg-primary transition-[width] duration-500" :style="{ width: withinPct }" />
              <span class="bg-destructive transition-[width] duration-500" :style="{ width: overPct }" />
            </template>
            <span v-else class="bg-primary transition-[width] duration-500" :style="{ width: spentPct }" />
          </div>
          <ul>
            <li v-for="c in cart" :key="c.code" class="flex items-center gap-3 border-t border-border py-2.5">
              <RouterLink to="/bidding" class="min-w-0 flex-1 truncate text-[14px] hover:underline">
                <span class="font-mono font-bold">{{ c.code }}</span> <span class="text-muted-foreground">{{ c.name }}</span>
              </RouterLink>
              <StatusPill v-if="c.rating" :tone="ratingPill[c.rating][0]">{{ ratingPill[c.rating][1] }}</StatusPill>
              <span class="w-[58px] text-right font-mono text-[14px] font-bold">e$ {{ c.amount }}</span>
              <BaseButton variant="secondary" size="sm" :aria-label="`Drop ${c.code} from the cart`" @click="bidding.dropModule(c.code)">Drop</BaseButton>
            </li>
            <li v-if="!cart.length" class="border-t border-border py-4 text-[13px] text-muted-foreground">
              Your cart is empty. Add modules in the Bidding Planner.
            </li>
          </ul>
          <div class="flex gap-2 border-t border-border pt-3">
            <BaseButton to="/bidding">Review in Bidding Planner</BaseButton>
          </div>
        </section>
      </div>

      <!-- Rooms, plan alerts, coming up -->
      <section v-enter="0.2" class="card grid grid-cols-3 divide-x divide-border"> <!-- motion: bottom strip fades in, 200ms delay -->
        <div class="flex flex-col gap-2.5 p-5">
          <h2 class="text-overline text-muted-foreground">Collab rooms</h2>
          <ul class="flex flex-col gap-2.5">
            <li v-for="r in roomRows" :key="r.room.id">
              <RouterLink :to="`/rooms/${r.room.id}`" class="flex flex-col gap-0.5 text-[13px] leading-normal hover:underline">
                <span class="font-semibold">{{ r.room.name }} · {{ r.room.module }}</span>
                <span class="text-muted-foreground">{{ r.note }}</span>
              </RouterLink>
            </li>
          </ul>
          <p v-if="!roomRows.length" class="text-[13px] text-muted-foreground">You're not in any rooms yet.</p>
        </div>

        <div class="flex flex-col gap-2.5 p-5">
          <h2 class="text-overline text-muted-foreground">Planner alerts</h2>
          <RouterLink v-if="alerts.length" to="/planner" class="flex flex-col gap-2 text-[13px] leading-normal">
            <span v-for="a in alerts.slice(0, 4)" :key="a" class="flex items-start gap-2">
              <span class="mt-[7px] size-1.5 shrink-0 rounded-full bg-destructive" />{{ a }}
            </span>
            <span v-if="alerts.length > 4" class="text-muted-foreground">+ {{ alerts.length - 4 }} more in the Planner</span>
          </RouterLink>
          <p v-else class="flex items-center gap-2 text-[13px]">
            <span class="size-1.5 rounded-full bg-success" />No alerts. Your plan looks on track.
          </p>
        </div>

        <div class="flex flex-col gap-2.5 p-5">
          <h2 class="text-overline text-muted-foreground">Bidding windows</h2>
          <ul class="flex flex-col gap-2 text-[13px] leading-normal">
            <li v-for="w in biddingWindows" :key="w.id" class="flex items-baseline justify-between gap-3">
              <span class="font-semibold">{{ w.name }}</span>
              <span class="shrink-0" :class="w.open ? 'font-medium text-foreground' : 'text-muted-foreground'">{{ w.when }}</span>
            </li>
          </ul>
        </div>
      </section>
    </main>
  </div>
</template>
