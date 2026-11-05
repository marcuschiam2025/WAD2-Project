<script setup>
// Collab room: try a bid for the room's module against real BOSS results (GET /api/bidding/history, loaded into
// the database from the BOSS result files). The backend's reference bid (GET /api/bidding/reference) rates the
// amount against the module's medians in the chosen round over the last terms before the room's term, and
// suggests a bid. If that call fails, the same formula runs in the browser on the loaded history.
// Results are per module, not per section.
import { computed, ref, watch } from 'vue';
import { api } from '@core/services/api';
import { rateBid, MIN_BID, estimateHistory, canEstimateBid } from '@core/data/bidding';
import { useBiddingStore } from '@core/stores/bidding';
import BaseButton from '@/components/ui/BaseButton.vue';
import StatusPill from '@/components/ui/StatusPill.vue';
import SelectField from '@/components/ui/SelectField.vue';

const props = defineProps({
  module: { type: String, required: true },
  term: { type: String, default: null }, // the term being bid for: only earlier terms count
});

const bidding = useBiddingStore();

// --- Past results ---------------------------------------------------------------------------
const history = ref([]);
const loading = ref(false);
const error = ref('');
let historyRequest = 0;
async function loadHistory() {
  const request = ++historyRequest;
  loading.value = true;
  error.value = '';
  try {
    const rows = await api.bidHistory(props.module);
    if (request === historyRequest) history.value = rows;
  } catch (failure) {
    if (request === historyRequest) {
      history.value = [];
      error.value = failure.message;
    }
  } finally {
    if (request === historyRequest) loading.value = false;
  }
}
watch(() => props.module, loadHistory, { immediate: true });

// BOSS rounds in the history; the current round first, then Round 1A
const rounds = computed(() => [...new Set(history.value.map((h) => h.round))].sort());
const round = ref('');
watch(rounds, (list) => {
  if (!list.includes(round.value))
    round.value = [bidding.round.round, '1A', list[0]].find((r) => list.includes(r)) ?? '';
});
const roundOptions = computed(() => rounds.value.map((r) => ({ value: r, label: `Round ${r}` })));
// Newest term first
const roundHistory = computed(() =>
  history.value.filter((h) => h.round === round.value).sort((a, b) => b.term.localeCompare(a.term)),
);

// --- Simulate a bid -------------------------------------------------------------------------
const bid = ref('');
// e$ amounts go up to 2 decimal places: anything typed or pasted beyond that is cut off
function onBidInput(event) {
  const trimmed = event.target.value.replace(/(\.\d{2})\d+/, '$1');
  if (trimmed !== event.target.value) event.target.value = trimmed;
  bid.value = trimmed;
}
const amount = computed(() => (bid.value === '' ? null : Number(bid.value)));
const tooLow = computed(() => amount.value !== null && amount.value < MIN_BID);

// The backend's reference bid, asked for a moment after the amount or round changes
const reference = ref(null);
let referenceTimer;
let referenceRequest = 0;
watch(
  [() => props.module, round, amount, () => props.term],
  ([code, r, value, term]) => {
    clearTimeout(referenceTimer);
    reference.value = null;
    const request = ++referenceRequest;
    if (!canEstimateBid(r, term)) return;
    referenceTimer = setTimeout(async () => {
      try {
        // Without an amount the backend still returns the suggestion, mean and SD
        const result = await api.referenceBid(
          code,
          value === null || value < MIN_BID ? undefined : value,
          r,
          term ?? undefined,
        );
        if (request === referenceRequest) reference.value = result;
      } catch {
        // keep the in-browser estimate
      }
    }, 300);
  },
  { immediate: true },
);

// The rating: the backend's when it has answered, else the same formula on the last 3 terms loaded here
const verdict = computed(() => {
  if (!canEstimateBid(round.value, props.term)) return null;
  if (amount.value === null || tooLow.value) return null;
  if (reference.value?.rating) return reference.value;
  const recent = estimateHistory(history.value, round.value, props.term);
  return recent.length ? { ...rateBid(amount.value, recent), basedOn: recent.length } : null;
});
const suggested = computed(() =>
  canEstimateBid(round.value, props.term) && reference.value?.basedOn ? reference.value.suggested : null,
);
const pill = {
  safe: ['success', 'Safe'],
  competitive: ['warning', 'Competitive'],
  'at-risk': ['destructive', 'At risk'],
};

// Marker on the At risk / Competitive / Safe meter (0-100%)
const markerPct = computed(() => {
  const v = verdict.value;
  if (!v) return null;
  // With 1 term the band is that term's min to median, not mean ± SD
  const lo = v.low ?? v.mean - v.sd;
  const hi = v.high ?? v.mean + v.sd;
  const a = amount.value;
  if (a < lo) return (a / lo) * 33;
  if (a < hi) return 34 + ((a - lo) / (hi - lo || 1)) * 32;
  return Math.min(98, 67 + Math.min(1, (a - hi) / (hi * 0.5)) * 31);
});

const verdictText = computed(() => {
  const v = verdict.value;
  if (!v) return '';
  const mean = `e$ ${+Number(v.mean).toFixed(1)}`;
  const terms = `${v.basedOn} past ${v.basedOn === 1 ? 'term' : 'terms'}`;
  if (v.basedOn === 1 && v.low != null) {
    if (v.rating === 'safe')
      return `At or above last term's Round ${round.value} median (${mean}). Only 1 term of data.`;
    if (v.rating === 'competitive')
      return `Between last term's lowest successful bid (e$ ${+Number(v.low).toFixed(1)}) and median (${mean}). You may still be outbid.`;
    return `Below last term's lowest successful bid (e$ ${+Number(v.low).toFixed(1)}).`;
  }
  if (v.rating === 'safe')
    return `At or above the Round ${round.value} median plus 1 SD (${mean} average over ${terms}).`;
  if (v.rating === 'competitive')
    return `Within 1 SD of the ${mean} average median over ${terms}. You may still be outbid.`;
  return `More than 1 SD below the ${mean} average median over ${terms}.`;
});
</script>

<template>
  <section class="card flex flex-col gap-4 p-5" aria-labelledby="room-bid-sim-heading">
    <div class="flex flex-col gap-0.5 leading-normal">
      <h2 id="room-bid-sim-heading" class="text-h4">Bid simulator · {{ module }}</h2>
      <p class="text-[13px] text-muted-foreground">
        Try an amount against real BOSS results for {{ module }} from past terms.
      </p>
    </div>

    <p v-if="loading" role="status" class="text-[13px] text-muted-foreground">Loading bid history…</p>
    <div v-else-if="error" class="flex items-center gap-3">
      <p role="alert" class="text-[13px] text-destructive">{{ error }}</p>
      <BaseButton size="sm" variant="outline" @click="loadHistory">Try again</BaseButton>
    </div>
    <p v-else-if="!history.length" class="rounded-md bg-muted p-4 text-[13px]">
      No BOSS results are recorded for {{ module }} yet.
    </p>

    <template v-else>
      <div class="grid grid-cols-2 items-start gap-3">
        <label class="flex flex-col gap-1.5">
          <span class="text-[13px] font-medium">Bid amount</span>
          <span
            class="flex items-center gap-2 rounded-md border-2 px-3 py-[9px] text-[14px] leading-normal transition-colors"
            :class="tooLow ? 'border-destructive' : 'border-primary'"
          >
            <span class="text-muted-foreground">e$</span>
            <input
              :value="bid"
              type="number"
              :min="MIN_BID"
              step="0.01"
              inputmode="decimal"
              placeholder="e.g. 30"
              @input="onBidInput"
              aria-label="Bid amount in e$"
              class="min-w-0 flex-1 bg-transparent font-medium outline-none"
            />
          </span>
          <span v-if="tooLow" class="text-[12px] text-destructive">Minimum bid is e$ {{ MIN_BID }}.</span>
        </label>
        <SelectField v-model="round" label="BOSS round" :options="roundOptions" />
      </div>

      <div class="flex flex-col gap-2">
        <div class="relative flex gap-1">
          <span class="h-1.5 flex-1 rounded-full bg-destructive" />
          <span class="h-1.5 flex-1 rounded-full bg-warning" />
          <span class="h-1.5 flex-1 rounded-full bg-success" />
          <span
            v-if="markerPct !== null"
            class="absolute -top-0.5 h-2.5 w-[3px] rounded-[2px] bg-foreground transition-[left] duration-300"
            :style="{ left: `${markerPct}%` }"
          />
        </div>
        <div class="flex justify-between text-[11px] text-muted-foreground">
          <span>At risk</span><span>Competitive</span><span>Safe</span>
        </div>
      </div>

      <div v-if="verdict" class="flex items-start gap-2">
        <StatusPill :tone="pill[verdict.rating][0]">{{ pill[verdict.rating][1] }}</StatusPill>
        <p class="flex-1 text-[13px] leading-[18px] text-muted-foreground">{{ verdictText }}</p>
      </div>
      <p v-else-if="amount === null" class="text-[13px] text-muted-foreground">
        Type an amount to see how it compares.
      </p>

      <!-- The backend's suggestion: the average median plus 1 SD -->
      <div v-if="suggested" class="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
        <p class="text-[12.5px] leading-normal">
          Suggested <span class="font-mono font-bold">e$ {{ suggested }}</span>
          <span class="text-muted-foreground">
            · Round {{ round }}, from {{ reference.basedOn }} past
            {{ reference.basedOn === 1 ? 'term' : 'terms' }}</span
          >
        </p>
        <BaseButton v-if="amount !== suggested" size="sm" variant="outline" @click="bid = suggested"
          >Use</BaseButton
        >
      </div>

      <div class="overflow-hidden rounded-md border border-border">
        <div class="grid grid-cols-4 bg-muted px-3 py-2 text-overline text-muted-foreground">
          <span>Term</span><span>Median</span><span>Min</span><span>Bids / seats</span>
        </div>
        <div
          v-for="h in roundHistory"
          :key="h.term"
          class="grid grid-cols-4 border-t border-border px-3 py-2 text-[12.5px]"
        >
          <span>{{ h.term }}</span>
          <span class="font-mono font-medium">e$ {{ h.median }}</span>
          <span class="font-mono font-medium">e$ {{ h.min }}</span>
          <span class="font-mono">{{ h.demand ?? '-' }} / {{ h.vacancies ?? '-' }}</span>
        </div>
      </div>
      <p class="text-[11.5px] text-muted-foreground">
        Results are for the whole module, not one section. A suggestion only, not a guarantee of allocation.
      </p>
    </template>
  </section>
</template>
