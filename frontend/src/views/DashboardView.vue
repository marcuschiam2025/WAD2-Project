<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@core/stores/user';
import { sectionCode, sectionMeetings } from '@core/utils/clash';
import { useBiddingStore } from '@core/stores/bidding';
import { usePlannerStore, effectiveCode } from '@core/stores/planner';
import { useRoomsStore } from '@core/stores/rooms';
import { useQuizStore, quizTrackNames, isOlderResult } from '@core/stores/quiz';
import { moduleName } from '@core/data/catalogue';
import { fmtE } from '@core/utils/money';
import { windowsFor, roundStatus } from '@core/utils/biddingWindows';
import { plannedMeetings, singaporeDay } from '@core/utils/dashboardSchedule';
import { bidHistory, rateBid, estimateHistory } from '@core/data/bidding';

import PageHeader from '@/components/layout/PageHeader.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import StatusPill from '@/components/ui/StatusPill.vue';
import TodoList from '@/components/TodoList.vue';
import TimetableGrid from '@/components/TimetableGrid.vue';
import TimetableModuleCard from '@/components/TimetableModuleCard.vue';
import TrackScoreChart from '@/components/TrackScoreChart.vue';

import person1 from '../assets/sitting/1.png';
import person2 from '../assets/sitting/2.png';
import person3 from '../assets/sitting/3.png';
import person4 from '../assets/sitting/4.png';
import person5 from '../assets/sitting/5.png';
const people = [person1, person2, person3, person4, person5];
const person = people[Math.floor(Math.random() * people.length)];
// One pointing-up picture for the bottom strip, picked at random on each load.
const pointers = Object.values(
  import.meta.glob('@/assets/pointingUp/*.png', { eager: true, import: 'default' }),
);
const pointer = pointers[Math.floor(Math.random() * pointers.length)];

const user = useUserStore();
const bidding = useBiddingStore();
const planner = usePlannerStore();
const rooms = useRoomsStore();
const quiz = useQuizStore();
const route = useRoute();
const router = useRouter();

// The current BOSS round (GET /api/bidding/round, via the bidding store)
const round = computed(() => bidding.roundInfo);

const now = ref(Date.now());
const today = computed(() => new Date(now.value));
const dateLabel = computed(() =>
  today.value.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Singapore',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }),
);
const hhmm = (d) =>
  d.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
  });
const dayName = (offset) =>
  new Date(singaporeDay(today.value).getTime() + offset * 86_400_000).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
  });
const closesOffset = computed(() =>
  round.value.closesAt
    ? Math.round((singaporeDay(round.value.closesAt) - singaporeDay(today.value)) / 86_400_000)
    : null,
);
const windowStatus = computed(() => roundStatus(round.value, now.value));
const windowTimeLabel = computed(() =>
  windowStatus.value.deadline
    ? `${windowStatus.value.deadline.toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore', weekday: 'short' })} ${hhmm(windowStatus.value.deadline)}`
    : '',
);

// Live countdown to the round closing
let timer;
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 30_000);
  quiz.initialize(); // the quiz tab shows the latest saved result
});
onBeforeUnmount(() => clearInterval(timer));
const countdown = computed(() => windowStatus.value.countdown);

// --- Top block: a tab list on the left and the open tab's details on the right ------------------
const left = computed(() => user.balance - bidding.allocated);
const over = computed(() => left.value < 0);
const degree = computed(() => planner.checklist.totals);
const latestQuiz = computed(() => quiz.latest);
const quizLegacy = computed(() => latestQuiz.value?.rubricVersion === 'legacy-v1');
const quizProvisional = computed(() => latestQuiz.value?.rankingBasis === 'scenario-provisional');
const quizTop = computed(() => latestQuiz.value?.results.slice(0, 2) ?? []);
const quizScore = (r) =>
  quizLegacy.value
    ? `${Math.round(r.pct)}%`
    : quizProvisional.value
      ? 'Provisional'
      : `${Math.round(r.alignmentIndex)} /100`;

// accent: the colour bar on the left of each tab. Written out in full so Tailwind can see the class names.
const accentClass = {
  warning: 'border-l-warning',
  primary: 'border-l-primary',
  success: 'border-l-success',
  destructive: 'border-l-destructive',
};
const sections = computed(() => [
  {
    key: 'window',
    label: `${round.value.name} ${windowStatus.value.state === 'upcoming' ? 'opens in' : windowStatus.value.state === 'open' ? 'closes in' : 'status'}`,
    value: countdown.value,
    sub: windowTimeLabel.value,
    accent: 'warning',
  },
  {
    key: 'wallet',
    label: 'Balance & cart',
    value: `e$ ${user.balance.toLocaleString()}`,
    unit: 'balance',
    sub: over.value
      ? `e$ ${fmtE(-left.value)} over balance`
      : `e$ ${fmtE(bidding.allocated)} in cart · e$ ${fmtE(left.value)} left`,
    subDanger: over.value,
    accent: over.value ? 'destructive' : 'success',
  },
  {
    key: 'calendar',
    label: 'Bidding calendar',
    value: bidding.bookedSections.length ? String(bidding.bookedSections.length) : '-',
    unit: bidding.bookedSections.length
      ? bidding.bookedSections.length === 1
        ? 'module planned'
        : 'modules planned'
      : 'nothing in your cart yet',
    sub: planner.checklist.unavailable
      ? 'Degree requirements unavailable'
      : `Degree: ${degree.value.cleared} / ${degree.value.required} courses cleared`,
    subDanger: degree.value.late > 0,
    accent: 'primary',
  },
  {
    key: 'quiz',
    label: 'Track quiz',
    value: quizTop.value[0]
      ? (quizTrackNames[quizTop.value[0].track] ?? quizTop.value[0].track)
      : 'Not taken yet',
    compact: true,
    sub: quizTop.value[0]
      ? `${quizScore(quizTop.value[0])} match · top track`
      : 'Find the track that suits you',
    accent: 'primary',
  },
  {
    key: 'rooms',
    label: 'Collab rooms',
    value: String(rooms.rooms.length),
    unit: rooms.rooms.length === 1 ? 'room' : 'rooms',
    sub: !rooms.rooms.length
      ? 'Vote on sections with friends'
      : roomsNeedingYou.value
        ? `${roomsNeedingYou.value} waiting for your vote`
        : 'You are all caught up',
    subDanger: roomsNeedingYou.value > 0,
    accent: 'primary',
  },
]);

// The open tab is kept in the address (?tab=cart) so a reload or the back button returns to it
const keys = computed(() => sections.value.map((s) => s.key));
const tabAlias = { balance: 'wallet', cart: 'wallet', degree: 'calendar' };
const active = computed(() => {
  const wanted = tabAlias[route.query.tab] ?? route.query.tab;
  return keys.value.includes(wanted) ? wanted : 'window';
});
function open(key) {
  router.replace({ query: { ...route.query, tab: key } });
}
const tabButtons = ref([]);
// Up and Down arrows move through the tabs, the way a vertical tab list normally behaves
async function onTabKey(event) {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const next = keys.value[(keys.value.indexOf(active.value) + step + keys.value.length) % keys.value.length];
  open(next);
  await nextTick();
  tabButtons.value[keys.value.indexOf(next)]?.focus();
}

// Window tab: where the round stands and what opens next (the full list of windows is further down the page)
const termWindows = computed(() => windowsFor(bidding.round.term, now.value, bidding.windows));
const openWindow = computed(() => termWindows.value.find((w) => w.state === 'open'));
const nextWindow = computed(() => termWindows.value.find((w) => w.state === 'upcoming'));

// Calendar tab: booked sections laid out on the weekly grid
function calendarCards(day, slot) {
  return bidding.bookedSections.flatMap((section) =>
    sectionMeetings(section)
      .filter((m) => m.day === day && m.slot === slot)
      .map((m) => ({ ...section, meeting: m })),
  );
}
const calendarVariant = (section) =>
  bidding.isLocked(section.module) ? 'room' : bidding.clashes.has(section.id) ? 'clash' : 'booked';

// Degree progress bar (along the bottom of the calendar tab)
const degreePct = (n) => `${degree.value.required ? (n / degree.value.required) * 100 : 0}%`;
const degreeParts = computed(() =>
  [
    {
      label: 'Cleared',
      n: degree.value.cleared,
      bar: 'bg-success',
      dot: 'bg-success',
    },
    {
      label: 'Exempted',
      n: degree.value.exempted,
      bar: 'bg-exempt',
      dot: 'bg-exempt',
    },
    {
      label: 'In progress',
      n: degree.value.inProgress,
      bar: 'bg-warning',
      dot: 'bg-warning',
    },
    {
      label: 'Planned',
      n: degree.value.planned,
      bar: 'bg-primary',
      dot: 'bg-primary',
    },
    {
      label: 'Not in your plan yet',
      n: degree.value.todo,
      bar: 'bg-border',
      dot: 'bg-border',
      bare: true,
    },
  ].filter((p) => p.n > 0),
);

// --- Schedule -----------------------------------------------------------------------------
// TODO(backend): replace with GET /api/users/me/feed: assignment deadlines and quizzes.
// The bidding cart is a planning source, not evidence of confirmed enrolment.
// Every bidding window of the term that opens or closes from now on, as schedule entries (the next-7-days tab keeps the
// ones within a week). A term with no listed windows falls back to the open round's closing time.
const SG_DAY = 86_400_000;
const offsetOf = (date) => Math.round((singaporeDay(date) - singaporeDay(today.value)) / SG_DAY);
const deadlines = computed(() => {
  const listed = bidding.windows.filter((w) => w.term === bidding.round.term);
  if (listed.length)
    return listed.flatMap((w) => {
      const name = `Round ${w.round} · Window ${w.window}`;
      return [
        ['opens', w.opensAt],
        ['closes', w.closesAt],
      ]
        .filter(([, at]) => Date.parse(at) > now.value)
        .map(([verb, at]) => ({
          id: `bid-${w.round}-${w.window}-${verb}`,
          kind: 'Bid',
          title: `${name} ${verb}`,
          meta: verb === 'closes' ? 'Submit your bid cart before then' : 'Bidding window',
          offset: offsetOf(new Date(at)),
          time: hhmm(new Date(at)),
        }));
    });
  return round.value.closesAt > now.value
    ? [
        {
          id: 'bid',
          kind: 'Bid',
          title: 'Submit bid cart',
          meta: `${round.value.name} closes`,
          offset: closesOffset.value,
          time: hhmm(round.value.closesAt),
        },
      ]
    : [];
});

const classes = computed(() =>
  plannedMeetings(bidding.bookedSections, today.value).map((m) => ({
    ...m,
    title: `${m.module} ${moduleName(m.module)}`,
  })),
);

const minutes = (t) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : 24 * 60);
const ordered = (list) =>
  [...list].sort((a, b) => (a.offset ?? 99) - (b.offset ?? 99) || minutes(a.time) - minutes(b.time));

const tab = ref('today');
const schedule = computed(() => {
  const all = ordered([...classes.value, ...deadlines.value]);
  const items =
    tab.value === 'today'
      ? all.filter((i) => i.offset === 0)
      : all.filter((i) => i.offset >= 0 && i.offset <= 6);
  return items.map((i) => ({
    ...i,
    when: tab.value === 'today' ? i.time : `${dayName(i.offset)} ${i.time ?? ''}`.trim(),
  }));
});
const kindStyle = {
  'Planned class': 'bg-primary-tint text-primary',
  Bid: 'bg-warning-tint text-foreground',
  Due: 'bg-secondary text-muted-foreground',
};

// --- Bid cart -----------------------------------------------------------------------------
const cart = computed(() =>
  Object.entries(bidding.bids)
    .map(([code, amount]) => {
      const n = Number(amount) || 0;
      return {
        code,
        name: moduleName(code),
        amount: n,
        rating:
          rateBid(n, estimateHistory(bidHistory[code] ?? [], bidding.round.round, bidding.round.term))
            ?.rating ?? null,
      };
    })
    .sort((a, b) => b.amount - a.amount),
);
const ratingPill = {
  safe: ['success', 'Safe'],
  competitive: ['warning', 'Competitive'],
  'at-risk': ['destructive', 'At risk'],
};
const ratingCounts = computed(() =>
  Object.entries(ratingPill)
    .map(([key, [tone, label]]) => ({
      key,
      tone,
      label,
      n: cart.value.filter((c) => c.rating === key).length,
    }))
    .filter((r) => r.n > 0),
);
const withinPct = computed(() => `${Math.min(1, user.balance / Math.max(bidding.allocated, 1)) * 100}%`);
const overPct = computed(() => `${over.value ? (1 - user.balance / bidding.allocated) * 100 : 0}%`);
const spentPct = computed(() => `${Math.min(1, bidding.allocated / Math.max(user.balance, 1)) * 100}%`);

// --- Bottom strip -------------------------------------------------------------------------
const roomRow = (room) => {
  const st = rooms.roomState(room);
  const mine = (rooms.myVotes[room.id] ?? []).length > 0;
  const note = st.lockedId
    ? `${sectionCode(st.lockedId, room.module)} is locked for the room`
    : st.allVoted
      ? room.ownerId === 'me'
        ? 'Everyone has voted · ready for you to lock'
        : 'Everyone has voted · waiting for the party admin'
      : `${st.voted} of ${st.total} voted${mine ? '' : ' · you have not voted yet'}`;
  // waiting on you: you have not voted and the room is not locked
  return {
    room,
    note,
    needsYou: !st.lockedId && !mine,
    voted: st.voted,
    total: st.total,
    locked: !!st.lockedId,
    ready: !!st.allVoted,
  };
};
const roomRows = computed(() => rooms.rooms.slice(0, 3).map(roomRow));
const roomCards = computed(() => rooms.rooms.map(roomRow));
const roomsNeedingYou = computed(() => roomCards.value.filter((r) => r.needsYou).length);

// Plan problems: prerequisites not met, and required courses past their recommended term
const alerts = computed(() => {
  const plan = planner.activePlan;
  const list = [];
  plan.semesters.forEach((sem) =>
    sem.modules.forEach((entry) => {
      if (!planner.hasWarning(plan, entry, sem.id)) return;
      planner
        .warningMessages(plan, entry, sem.id)
        .forEach((why) => list.push(`${effectiveCode(entry)} · ${why}`));
    }),
  );
  planner.checklist.groups
    .flatMap((g) => g.slots)
    .filter((s) => s.urgency === 'late')
    .forEach((s) => list.push(`${s.label} · behind (recommended ${s.rec.label})`));
  return [...new Set(list)];
});

// Every BOSS bidding window of the term, finished ones included. A term with no listed windows falls back to the open round.
const biddingWindows = computed(() => {
  if (termWindows.value.length) return termWindows.value;
  return [
    {
      id: 'current',
      name: round.value.name,
      state: windowStatus.value.state,
      when: windowTimeLabel.value
        ? `${windowStatus.value.state === 'upcoming' ? 'Opens' : 'Closes'} ${windowTimeLabel.value}`
        : windowStatus.value.label,
    },
  ];
});
</script>

<template>
  <div>
    <PageHeader
      :overline="dateLabel"
      title="Your week at a glance"
      :subtitle="`Welcome back, ${user.profile.firstName}. ${round.term}`"
    >
      <template #actions>
        <StatusPill tone="warning">{{ round.name }} · {{ windowStatus.label }}</StatusPill>
        <BaseButton variant="outline" to="/bidding/finalised">Calendar downloads</BaseButton>
      </template>
    </PageHeader>

    <main class="flex flex-col gap-4 px-5 md:px-8 lg:px-16 pt-8 pb-12">
      <!-- The semester ended, so the student was moved to the next one -->
      <section
        v-if="planner.semesterMoved"
        role="status"
        class="flex flex-col gap-3 rounded-lg border border-primary bg-primary-tint px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-[14px] leading-normal">
          <span class="font-semibold">You're now in {{ planner.semesterMoved.to }}.</span>
          Modules from {{ planner.semesterMoved.from }} count as completed, so remove any you dropped or
          failed.
        </p>
        <div class="flex shrink-0 gap-2">
          <BaseButton variant="outline" to="/profile">Check in Profile</BaseButton>
          <BaseButton variant="ghost" @click="planner.semesterMoved = null">Dismiss</BaseButton>
        </div>
      </section>

      <!-- Undecided about a track -->
      <section
        v-if="!user.profile.tracks.length"
        v-enter
        class="flex flex-col gap-3 rounded-lg border border-primary bg-primary-tint px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <!-- motion: fade + slide up on mount -->
        <div class="flex flex-col gap-0.5 leading-normal">
          <p class="text-[14px] font-semibold">You haven't picked a track yet</p>
          <p class="text-[13px] text-muted-foreground">
            A short quiz matches you to a track and suggests modules to add to your basket.
          </p>
        </div>
        <BaseButton to="/quiz">Take the track quiz</BaseButton>
      </section>

      <!-- Top block: pick one on the left, see its details on the right -->
      <div v-enter class="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
        <!-- motion: fades in on mount -->
        <!-- A vertical list on wide screens, a sideways strip on small ones -->
        <div
          role="tablist"
          aria-label="Dashboard summary"
          aria-orientation="vertical"
          class="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5 xl:flex xl:flex-col"
        >
          <button
            v-for="(s, i) in sections"
            :id="`tab-${s.key}`"
            :key="s.key"
            :ref="(el) => (tabButtons[i] = el)"
            type="button"
            role="tab"
            :aria-selected="active === s.key"
            :aria-controls="`panel-${s.key}`"
            :tabindex="active === s.key ? 0 : -1"
            class="flex min-w-0 flex-col justify-center gap-1 max-md:last:col-span-2 rounded-lg border border-l-[3px] border-border bg-card px-4 py-2 text-left leading-normal transition-[box-shadow,background-color,border-color] xl:flex-1"
            :class="[
              accentClass[s.accent],
              active === s.key
                ? 'bg-primary-tint shadow-md ring-1 ring-primary'
                : 'hover:border-primary/50 hover:shadow-sm',
            ]"
            @click="open(s.key)"
            @keydown="onTabKey"
          >
            <span class="text-overline text-muted-foreground">{{ s.label }}</span>
            <span class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span
                class="max-w-full break-words"
                :class="[
                  s.compact
                    ? 'text-[16px] leading-snug font-semibold'
                    : 'font-mono text-[20px] leading-none font-bold',
                  s.danger && 'text-destructive',
                ]"
                >{{ s.value }}</span
              >
              <span v-if="s.unit" class="text-[12px] text-muted-foreground">{{ s.unit }}</span>
            </span>
            <span
              class="text-[12px]"
              :class="s.danger || s.subDanger ? 'font-medium text-destructive' : 'text-muted-foreground'"
              >{{ s.sub }}</span
            >
          </button>
        </div>

        <!-- The open tab -->
        <section
          :id="`panel-${active}`"
          role="tabpanel"
          :aria-labelledby="`tab-${active}`"
          tabindex="0"
          class="card flex min-h-[460px] min-w-0 flex-col gap-4 p-5 xl:h-[460px] xl:overflow-y-auto [&>*]:shrink-0"
        >
          <!-- Window: the time left is the main thing on this tab -->
          <template v-if="active === 'window'">
            <!-- Top row: title and countdown on the left, people on the right -->
            <!-- Top row: title and countdown on the left, a person on the right -->
            <div class="flex items-end justify-between gap-6">
              <div class="flex min-w-0 flex-col gap-4">
                <header class="flex flex-col gap-1">
                  <p class="text-overline text-muted-foreground">Bidding window · {{ round.term }}</p>
                  <h2 class="text-h3">{{ round.name }}</h2>
                </header>
                <div class="flex flex-col gap-2" role="timer" :aria-label="windowStatus.label">
                  <span
                    class="font-mono text-[56px] leading-none font-bold tracking-tight sm:text-[80px] lg:text-[96px]"
                    :class="countdown === 'Closed' && 'text-muted-foreground'"
                    >{{ countdown }}</span
                  >
                  <span class="text-[15px] text-muted-foreground">{{
                    windowStatus.state === 'upcoming'
                      ? `until opening · opens ${windowTimeLabel} (Singapore time)`
                      : windowStatus.state === 'open'
                        ? `left to bid · closes ${windowTimeLabel} (Singapore time)`
                        : windowStatus.label
                  }}</span>
                </div>
              </div>

              <!-- Decorative: moved down so it sits on the "Up next" box -->
              <img
                :src="person"
                alt=""
                aria-hidden="true"
                class="pointer-events-none relative z-10 mr-16 hidden h-[190px] w-auto translate-y-[86px] select-none lg:block"
              />
            </div>

            <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-1 rounded-lg bg-muted p-4">
                <dt class="text-overline text-muted-foreground">Open now</dt>
                <dd class="text-[14px] font-semibold">
                  {{ openWindow ? openWindow.name : 'No window open' }}
                </dd>
                <dd v-if="openWindow" class="text-[13px] text-muted-foreground">
                  {{ openWindow.when }}
                </dd>
              </div>
              <div class="flex flex-col gap-1 rounded-lg bg-muted p-4">
                <dt class="text-overline text-muted-foreground">Up next</dt>
                <dd class="text-[14px] font-semibold">
                  {{ nextWindow ? nextWindow.name : 'Nothing scheduled' }}
                </dd>
                <dd v-if="nextWindow" class="text-[13px] text-muted-foreground">
                  {{ nextWindow.when }}
                </dd>
              </div>
            </dl>
            <div v-if="termWindows.length" class="flex flex-col gap-2.5 border-t border-border pt-5">
              <h3 class="text-overline text-muted-foreground">Term timeline</h3>
              <div
                class="flex gap-1.5"
                role="img"
                :aria-label="`${termWindows.filter((w) => w.state === 'closed').length} of ${termWindows.length} bidding windows have closed`"
              >
                <span
                  v-for="w in termWindows"
                  :key="w.id"
                  :title="`${w.name} · ${w.when}`"
                  class="h-3 flex-1 rounded-full"
                  :class="
                    {
                      closed: 'bg-muted-foreground/40',
                      open: 'bg-success',
                      upcoming: 'bg-border',
                    }[w.state]
                  "
                />
              </div>
              <p class="text-[12px] text-muted-foreground">
                {{ termWindows.filter((w) => w.state === 'closed').length }} of
                {{ termWindows.length }} windows closed. The full list is further down.
              </p>
            </div>
          </template>

          <!-- Balance and cart -->
          <template v-else-if="active === 'wallet'">
            <header class="flex flex-wrap items-start justify-between gap-4">
              <div class="flex flex-col gap-1">
                <p class="text-overline text-muted-foreground">{{ round.name }} · your e$</p>
                <h2 class="text-h3">Balance &amp; cart</h2>
              </div>
              <BaseButton to="/bidding">Review in Bidding Planner</BaseButton>
            </header>
            <dl class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div class="flex flex-col gap-1">
                <dt class="text-overline text-muted-foreground">Balance</dt>
                <dd class="font-mono text-[26px] leading-none font-bold">
                  e$ {{ user.balance.toLocaleString() }}
                </dd>
              </div>
              <div class="flex flex-col gap-1">
                <dt class="text-overline text-muted-foreground">In your cart</dt>
                <dd class="font-mono text-[26px] leading-none font-bold">e$ {{ fmtE(bidding.allocated) }}</dd>
              </div>
              <div class="flex flex-col gap-1">
                <dt class="text-overline text-muted-foreground">
                  {{ over ? 'Over balance' : 'Left after the round' }}
                </dt>
                <dd class="font-mono text-[26px] leading-none font-bold" :class="over && 'text-destructive'">
                  e$ {{ fmtE(over ? -left : left) }}
                </dd>
              </div>
            </dl>
            <div
              class="flex h-3 overflow-hidden rounded-full bg-border"
              role="img"
              :aria-label="`${fmtE(bidding.allocated)} of ${user.balance} e$ in your cart`"
            >
              <template v-if="over">
                <span class="bg-primary transition-[width] duration-500" :style="{ width: withinPct }" />
                <span class="bg-destructive transition-[width] duration-500" :style="{ width: overPct }" />
              </template>
              <span v-else class="bg-primary transition-[width] duration-500" :style="{ width: spentPct }" />
            </div>
            <div class="flex flex-col gap-3 border-t border-border pt-4">
              <div class="flex flex-wrap items-center gap-3">
                <h3 class="text-overline text-muted-foreground">
                  Your cart · {{ cart.length }} module{{ cart.length === 1 ? '' : 's' }}
                </h3>
                <span v-for="r in ratingCounts" :key="r.key" class="flex items-center gap-1.5 text-[13px]"
                  ><StatusPill :tone="r.tone">{{ r.label }}</StatusPill
                  ><span class="font-mono font-semibold">{{ r.n }}</span></span
                >
              </div>
              <ul v-if="cart.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <li v-for="c in cart" :key="c.code">
                  <RouterLink
                    to="/bidding"
                    class="flex h-full flex-col gap-1 rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/50"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <span class="font-mono text-[14px] font-bold">{{ c.code }}</span>
                      <StatusPill v-if="c.rating" :tone="ratingPill[c.rating][0]">{{
                        ratingPill[c.rating][1]
                      }}</StatusPill>
                    </div>
                    <span class="truncate text-[12px] text-muted-foreground">{{ c.name }}</span>
                    <span class="mt-auto font-mono text-[16px] font-bold whitespace-nowrap"
                      >e$ {{ fmtE(c.amount) }}</span
                    >
                  </RouterLink>
                </li>
              </ul>
              <p v-else class="rounded-lg bg-muted p-4 text-[13px] text-muted-foreground">
                Your cart is empty. Add modules in the Bidding Planner.
              </p>
            </div>
          </template>

          <!-- Bidding calendar, with the degree progress along the bottom -->
          <template v-else-if="active === 'calendar'">
            <header class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-h3">
                Bidding calendar
                <span class="text-[13px] font-normal text-muted-foreground"
                  >· {{ round.name }}, {{ round.term }}</span
                >
              </h2>
              <BaseButton variant="outline" to="/bidding">Open Bidding Planner</BaseButton>
            </header>
            <TimetableGrid short row-height="min-h-[42px]" class="[&_.overflow-x-auto]:scrollbar-none">
              <template #cell="{ day, slot }">
                <TimetableModuleCard
                  v-for="c in calendarCards(day, slot)"
                  :key="`${c.id}:${c.meeting.start}`"
                  :code="c.module"
                  :section="c.section"
                  :variant="calendarVariant(c)"
                />
              </template>
            </TimetableGrid>
            <div class="mt-auto flex flex-col gap-2 border-t border-border pt-2">
              <template v-if="!planner.checklist.unavailable">
                <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p class="text-[13px]">
                    <span class="mr-1 font-semibold">Degree progress</span>
                    <span class="text-muted-foreground"
                      >·
                      <span class="font-mono font-semibold text-foreground">{{ degree.cleared }}</span>
                      / {{ degree.required }} courses cleared<template
                        v-for="p in degreeParts.filter((x) => x.label !== 'Cleared' && !x.bare)"
                        :key="p.label"
                      >
                        · {{ p.n }} {{ p.label.toLowerCase() }}</template
                      ></span
                    >
                  </p>
                  <RouterLink to="/planner" class="text-[12px] font-medium text-primary hover:underline"
                    >Open What-If Planner</RouterLink
                  >
                </div>
                <div
                  class="flex h-2.5 overflow-hidden rounded-full bg-border"
                  role="img"
                  :aria-label="`${degree.cleared} of ${degree.required} courses cleared`"
                >
                  <span
                    v-for="p in degreeParts.filter((x) => !x.bare)"
                    :key="p.label"
                    :class="p.bar"
                    class="transition-[width] duration-500"
                    :style="{ width: degreePct(p.n) }"
                  />
                </div>
              </template>
              <p v-else class="text-[13px] text-muted-foreground">
                {{ planner.checklist.unavailableReason }}
              </p>
            </div>
          </template>

          <!-- Quiz: the latest result, its chart and the two leading tracks -->
          <template v-else-if="active === 'quiz'">
            <header class="flex flex-wrap items-start justify-between gap-4">
              <div class="flex flex-col gap-1">
                <p class="text-overline text-muted-foreground">Track Finder</p>
                <h2 class="text-h3">Your quiz results</h2>
                <p class="text-[14px] text-muted-foreground">
                  {{
                    latestQuiz
                      ? 'Your latest result. A guide to explore, not a prediction.'
                      : 'A short quiz suggests tracks to explore.'
                  }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <BaseButton v-if="latestQuiz" :to="`/quiz/results?attempt=${latestQuiz.id}`"
                  >View full results</BaseButton
                >
                <BaseButton :variant="latestQuiz ? 'outline' : 'primary'" to="/quiz">{{
                  latestQuiz ? 'Retake quiz' : 'Take the track quiz'
                }}</BaseButton>
              </div>
            </header>
            <p v-if="quiz.loading && !latestQuiz" role="status" class="text-[13px] text-muted-foreground">
              Loading your result…
            </p>
            <p v-else-if="!latestQuiz" class="rounded-lg bg-muted p-5 text-[14px] text-muted-foreground">
              {{
                quiz.error ||
                'You have not taken the quiz yet. It takes a few minutes and suggests tracks and modules for you.'
              }}
            </p>
            <template v-else>
              <p
                v-if="isOlderResult(latestQuiz)"
                role="status"
                class="rounded-md bg-primary-tint px-4 py-2.5 text-[13px]"
              >
                Saved under an earlier quiz version. Retake for an updated score.
              </p>
              <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
                <div class="flex flex-col gap-3">
                  <article
                    v-for="r in quizTop"
                    :key="r.track"
                    class="flex flex-col gap-1.5 rounded-xl border border-border p-4"
                    :class="r.rank === 1 && 'border-primary'"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-[12px] font-medium text-muted-foreground">Rank {{ r.rank }}</span>
                      <span class="font-mono text-[18px] font-semibold">{{ quizScore(r) }}</span>
                    </div>
                    <h3 class="text-[16px] leading-6 font-semibold">
                      {{ quizTrackNames[r.track] ?? r.track }}
                    </h3>
                    <span class="text-[12px] text-muted-foreground">{{
                      quizLegacy
                        ? 'Earlier match score'
                        : quizProvisional
                          ? 'Scenario preference ordering'
                          : 'Quiz match score'
                    }}</span>
                  </article>
                </div>
                <div v-if="!quizLegacy" class="flex flex-col gap-2">
                  <h3 class="text-overline text-muted-foreground">Score for every track</h3>
                  <TrackScoreChart :results="latestQuiz.results" :provisional="quizProvisional" />
                </div>
              </div>
            </template>
          </template>

          <!-- Collab rooms: every room you are in, as a card -->
          <template v-else>
            <header class="flex flex-wrap items-start justify-between gap-4">
              <div class="flex flex-col gap-1">
                <p class="text-overline text-muted-foreground">Vote on sections together</p>
                <h2 class="text-h3">Collab rooms</h2>
                <p
                  class="text-[14px]"
                  :class="roomsNeedingYou ? 'font-semibold text-destructive' : 'text-muted-foreground'"
                >
                  {{
                    !roomCards.length
                      ? 'You are not in any rooms yet.'
                      : roomsNeedingYou
                        ? `${roomsNeedingYou} room${roomsNeedingYou === 1 ? ' is' : 's are'} waiting for your vote`
                        : 'You have voted in every room.'
                  }}
                </p>
              </div>
              <BaseButton to="/rooms">Open Collab Rooms</BaseButton>
            </header>
            <ul v-if="roomCards.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <li v-for="r in roomCards" :key="r.room.id">
                <RouterLink
                  :to="`/rooms/${r.room.id}`"
                  class="flex h-full flex-col gap-2 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/50"
                >
                  <div class="flex items-start justify-between gap-2">
                    <span class="font-mono text-[15px] font-bold">{{ r.room.module }}</span>
                    <StatusPill :tone="r.locked ? 'success' : r.needsYou ? 'warning' : 'info'">{{
                      r.locked ? 'Locked' : r.needsYou ? 'Your vote' : r.ready ? 'Ready to lock' : 'Voting'
                    }}</StatusPill>
                  </div>
                  <span class="line-clamp-2 text-[14px] leading-snug font-semibold">{{ r.room.name }}</span>
                  <span class="text-[13px] text-muted-foreground">{{ r.note }}</span>
                  <div
                    class="mt-auto flex items-center gap-2 pt-1"
                    :aria-label="`${r.voted} of ${r.total} voted`"
                  >
                    <span class="flex h-1.5 flex-1 overflow-hidden rounded-full bg-border"
                      ><span
                        class="bg-primary transition-[width] duration-500"
                        :style="{
                          width: `${r.total ? (r.voted / r.total) * 100 : 0}%`,
                        }"
                    /></span>
                    <span class="font-mono text-[12px] text-muted-foreground"
                      >{{ r.voted }}/{{ r.total }}</span
                    >
                  </div>
                </RouterLink>
              </li>
            </ul>
            <p v-else class="rounded-lg bg-muted p-5 text-[14px] text-muted-foreground">
              Create a room or join one with an invite code to vote on sections with friends.
            </p>
          </template>
        </section>
      </div>

      <div class="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div class="flex flex-col gap-4">
          <!-- Schedule -->
          <section v-enter="0.1" class="card flex flex-col p-5">
            <!-- motion: schedule fades in, 100ms delay -->
            <div class="flex items-center justify-between pb-3">
              <h2 class="text-h4">Schedule</h2>
              <div
                class="flex rounded-md border border-border p-0.5"
                role="tablist"
                aria-label="Schedule range"
              >
                <button
                  v-for="t in [
                    ['today', 'Today'],
                    ['week', 'Next 7 days'],
                  ]"
                  :key="t[0]"
                  type="button"
                  role="tab"
                  :aria-selected="tab === t[0]"
                  class="rounded-sm px-3 py-1 text-[13px] font-medium transition-colors max-lg:min-h-11"
                  :class="
                    tab === t[0]
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="tab = t[0]"
                >
                  {{ t[1] }}
                </button>
              </div>
            </div>
            <p class="pb-3 text-xs text-muted-foreground">
              Singapore time. Planned classes use your bid cart and teaching dates; they do not confirm
              enrolment. Sections without teaching dates are omitted.
            </p>
            <ul>
              <li
                v-for="i in schedule"
                :key="i.id"
                class="flex items-start gap-3 border-t border-border py-3"
              >
                <span
                  class="w-[74px] shrink-0 pt-0.5 font-mono text-[12px] leading-normal font-medium text-muted-foreground"
                  >{{ i.when }}</span
                >
                <div class="flex min-w-0 flex-1 flex-col gap-0.5 leading-normal">
                  <p class="text-[14px] font-medium">{{ i.title }}</p>
                  <p class="text-[12px] text-muted-foreground">{{ i.meta }}</p>
                </div>
                <span
                  class="rounded-full px-2.5 py-[3px] text-[11px] leading-normal font-semibold"
                  :class="kindStyle[i.kind]"
                  >{{ i.kind }}</span
                >
              </li>
              <li
                v-if="!schedule.length"
                class="border-t border-border py-4 text-[13px] text-muted-foreground"
              >
                Nothing scheduled.
              </li>
            </ul>
          </section>

          <!-- To-do list (motion: fades in, 150ms delay) -->
          <TodoList v-enter="0.15" />
        </div>

        <!-- Bid cart -->
        <section v-enter="0.15" class="card flex flex-col gap-3 p-5">
          <!-- motion: bid cart fades in, 150ms delay -->
          <div class="flex items-center justify-between">
            <h2 class="text-h4">Bid cart</h2>
            <span
              class="text-[13px]"
              :class="over ? 'font-semibold text-destructive' : 'text-muted-foreground'"
            >
              {{ over ? `e$ ${fmtE(-left)} over` : `e$ ${fmtE(left)} left` }}
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
                <span class="font-mono font-bold">{{ c.code }}</span>
                <span> · </span>
                <span class="text-muted-foreground">{{ c.name }}</span>
              </RouterLink>
              <StatusPill v-if="c.rating" :tone="ratingPill[c.rating][0]">{{
                ratingPill[c.rating][1]
              }}</StatusPill>
              <span class="min-w-[58px] shrink-0 text-right font-mono text-[14px] font-bold whitespace-nowrap"
                >e$ {{ fmtE(c.amount) }}</span
              >
            </li>
            <li v-if="!cart.length" class="border-t border-border py-4 text-[13px] text-muted-foreground">
              Your cart is empty. Add modules in the Bidding Planner.
            </li>
          </ul>
          <div class="mt-auto flex gap-2 border-t border-border pt-3">
            <BaseButton to="/bidding" class="w-full sm:w-auto">Review in Bidding Planner</BaseButton>
          </div>
        </section>
      </div>

      <!-- Rooms, plan alerts, coming up -->
      <section
        v-enter="0.2"
        class="card grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0"
      >
        <!-- motion: bottom strip fades in, 200ms delay -->
        <div class="flex flex-col gap-2.5 p-5">
          <h2 class="text-overline text-muted-foreground">Collab rooms</h2>
          <ul class="flex flex-col gap-2.5">
            <li v-for="r in roomRows" :key="r.room.id">
              <RouterLink
                :to="`/rooms/${r.room.id}`"
                class="flex flex-col gap-0.5 text-[13px] leading-normal hover:underline"
              >
                <span class="font-semibold">{{ r.room.name }} · {{ r.room.module }}</span>
                <span class="text-muted-foreground">{{ r.note }}</span>
              </RouterLink>
            </li>
          </ul>
          <p v-if="!roomRows.length" class="text-[13px] text-muted-foreground">
            You're not in any rooms yet.
          </p>
        </div>

        <div class="relative flex flex-col gap-2.5 overflow-hidden p-5">
          <h2 class="text-overline text-muted-foreground">Planner alerts</h2>
          <!-- Decorative, md and up only: fills the empty space at the bottom of this column (absolute, so nothing
               moves), so it only shows when there is no longer text for it to cover. Half the column tall, cropped
               from the top of the picture's blank margin down to its waist. -->
          <div
            v-if="!alerts.length && !planner.checklist.unavailable"
            aria-hidden="true"
            class="pointer-events-none absolute bottom-0 right-4 top-1/2 hidden aspect-[525/570] max-w-full md:block"
          >
            <img :src="pointer" alt="" class="h-full w-full object-cover object-bottom" />
          </div>
          <RouterLink
            v-if="alerts.length"
            to="/planner"
            class="flex flex-col gap-2 text-[13px] leading-normal"
          >
            <span v-for="a in alerts.slice(0, 4)" :key="a" class="flex items-start gap-2">
              <span class="mt-[7px] size-1.5 shrink-0 rounded-full bg-destructive" />{{ a }}
            </span>
            <span v-if="alerts.length > 4" class="text-muted-foreground"
              >+ {{ alerts.length - 4 }} more in the Planner</span
            >
          </RouterLink>
          <p v-else-if="planner.checklist.unavailable" class="text-[13px] text-muted-foreground">
            {{ planner.checklist.unavailableReason }}
          </p>
          <p v-else class="flex items-center gap-2 text-[13px]">
            <span class="size-1.5 rounded-full bg-success" />No prerequisite or timing problems found.
          </p>
        </div>

        <div class="flex flex-col gap-2.5 p-5">
          <h2 class="text-overline text-muted-foreground">Bidding windows</h2>
          <ul class="flex max-h-[360px] flex-col gap-2 overflow-y-auto text-[13px] leading-normal">
            <li
              v-for="w in biddingWindows"
              :key="w.id"
              class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
              :class="w.state === 'closed' && 'text-muted-foreground'"
              :aria-current="w.state === 'open' ? 'true' : undefined"
            >
              <span
                class="flex items-center gap-1.5"
                :class="w.state === 'closed' ? 'font-medium' : 'font-semibold'"
              >
                <span
                  v-if="w.state === 'open'"
                  class="size-1.5 rounded-full bg-success"
                  aria-hidden="true"
                />{{ w.name }}
              </span>
              <span class="min-w-0" :class="w.state === 'open' && 'font-medium text-foreground'"
                >{{ w.when }}{{ w.inferred ? ' *' : '' }}</span
              >
            </li>
          </ul>
          <p v-if="biddingWindows.some((w) => w.inferred)" class="text-[11px] text-muted-foreground">
            * Times not listed in the school calendar, inferred from the other windows. Singapore time.
          </p>
        </div>
      </section>
    </main>
  </div>
</template>
