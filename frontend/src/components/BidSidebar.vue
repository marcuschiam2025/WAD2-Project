<script setup>
// Right-hand panel of the BOSS Bidding Planner: empty state, or Details / Simulate / History for the
// selected module, with the allocated-e$ footer and Save plan button always pinned to the bottom.
import { computed, ref, watch } from 'vue'
import { animate } from 'motion'
import { useBiddingStore } from '@core/stores/bidding'
import { useUserStore } from '@core/stores/user'
import { api } from '@core/services/api'
import { moduleName } from '@core/data/catalogue'
import { fmtE } from '@core/utils/money'
import { sections, weightage, rateBid, MIN_BID, estimateHistory, canEstimateBid } from '@core/data/bidding'
import { ease } from '@/motion'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import SelectField from '@/components/ui/SelectField.vue'
import iconX from '@/assets/figma/icon-x.svg'
import iconPointer from '@/assets/figma/icon-pointer.svg'

const props = defineProps({ code: { type: String, default: null } })
const emit = defineEmits(['close'])
const bidding = useBiddingStore()
const user = useUserStore()

const tabs = ['Details', 'Simulate', 'History']
const tab = ref('Simulate')

// Sections, bid history and weightage: the backend's for each module
const section = computed(() => props.code && sections.find((s) => s.id === bidding.booked[props.code]))
const details = computed(() => section.value ? [
  ['Professor', section.value.prof],
  ['Section', section.value.section],
  ['Class', bidding.slotLabel(section.value)],
  ['Location', section.value.venue],
  ['Exam', section.value.exam],
] : [])

const bid = computed({
  get: () => bidding.bids[props.code] ?? '',
  set: (v) => bidding.setBid(props.code, v === '' ? '' : Number(v)),
})
function onBidInput(event) {
  const trimmed = event.target.value.replace(/(\.\d{2})\d+/, '$1')
  if (trimmed !== event.target.value) event.target.value = trimmed
  bid.value = trimmed
}
const bidTooLow = computed(() => bid.value !== '' && bid.value < MIN_BID)

const history = computed(() => bidding.bidHistory[props.code] ?? [])
// The current BOSS round when this module has results for it, until the student picks another
const pickedRound = ref(null)
watch(() => props.code, () => (pickedRound.value = null))
const round = computed({
  get() {
    if (pickedRound.value) return pickedRound.value
    const rounds = history.value.map((h) => h.round)
    return [bidding.round.round, '1A', rounds[0]].find((r) => rounds.includes(r)) ?? 'all'
  },
  set: (value) => (pickedRound.value = value),
})
const roundOptions = computed(() => [
  ...[...new Set(history.value.map((h) => h.round))].map((r) => ({ value: r, label: `Round ${r}` })),
  { value: 'all', label: 'All rounds' },
])
const filtered = computed(() => estimateHistory(history.value, round.value, bidding.round.term))
// The backend's reference bid for the booked section (GET /api/bidding/reference-bid): past results with the
// same instructors, class times and round, falling back to the same instructors at any time, then to the whole
// module (matchLevel says which). If the section isn't on the server, the module's (GET /api/bidding/reference).
// It is asked for a moment after the bid, round or section changes. The browser fallback uses the same round
// and past-term window.
const reference = ref(null)
let referenceTimer
let referenceRequest = 0
watch(
  [() => props.code, () => section.value?.id, bid, round, () => bidding.online, () => bidding.round.term],
  ([code, sectionId, amount, r, online, term]) => {
    clearTimeout(referenceTimer)
    reference.value = null
    const request = ++referenceRequest
    if (!code || !online || !canEstimateBid(r, term) || amount === '' || amount < MIN_BID) return
    referenceTimer = setTimeout(async () => {
      let result = null
      try {
        if (sectionId) result = await api.sectionReferenceBid(sectionId, amount, r, term)
      } catch {
        // not on the server: try the module's reference bid
      }
      try {
        if (!result) result = await api.referenceBid(code, amount, r, term)
      } catch {
        // keep the in-browser estimate
      }
      if (result && request === referenceRequest) reference.value = result
    }, 300)
  },
  { immediate: true },
)

// "1-15:30|3-12:00" → "Tue 3:30pm, Thu 12pm"
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
function slotText(key) {
  if (!key) return 'no fixed class time'
  return key
    .split('|')
    .map((slot) => {
      const [day, time] = slot.split('-')
      const [hour, minute] = time.split(':').map(Number)
      const clock = `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, '0')}` : ''}${hour < 12 ? 'am' : 'pm'}`
      return `${DAY_NAMES[day]} ${clock}`
    })
    .join(', ')
}

// What the reference bid was matched on, so a loose match doesn't read as a confident one
const matchNote = computed(() => {
  const r = reference.value
  if (!r?.matchLevel || !r.history?.length) return ''
  const names = (r.section?.instructors ?? []).join(' & ') || 'this instructor'
  const terms = r.history.map((h) => `${h.term} ${h.sections.join('/')}`).join(', ')
  let note = ''
  if (r.matchLevel === 'prof-slot') note = `Based on ${names}'s ${slotText(r.section.slotKey)} class (${terms}).`
  else if (r.matchLevel === 'prof') note = `Based on ${names}'s past classes (${terms}). Class time not matched: it may have been a different time or section.`
  else note = `Based on all ${props.code} sections (${r.history.map((h) => h.term).join(', ')}). No past results for ${names}.`
  if (r.history.length === 1) note += ' Only 1 term of data.'
  return note
})
const verdict = computed(() => {
  if (!canEstimateBid(round.value, bidding.round.term)) return null
  if (reference.value?.rating) return { ...reference.value, live: true }
  if (bid.value === '' || bidTooLow.value || !filtered.value.length) return null
  return { ...rateBid(bid.value, filtered.value), basedOn: filtered.value.length }
})
function useSuggested() {
  bid.value = reference.value.suggested
}

// Marker position on the At risk / Competitive / Safe meter (0-100%)
const markerPct = computed(() => {
  const v = verdict.value
  if (!v) return null
  // The backend sends the band (with 1 term it is that term's min to median); the browser estimate is mean ± SD
  const lo = v.low ?? v.mean - v.sd
  const hi = v.high ?? v.mean + v.sd
  const amount = bid.value
  if (amount < lo) return (amount / lo) * 33
  if (amount < hi) return 34 + ((amount - lo) / (hi - lo || 1)) * 32
  return Math.min(98, 67 + Math.min(1, (amount - hi) / (hi * 0.5)) * 31)
})

const verdictText = computed(() => {
  const v = verdict.value
  if (!v) return ''
  const median = `e$ ${+v.mean.toFixed(1)}`
  const label = round.value === 'all' ? '' : ` Round ${round.value}`
  // One term: the band is that term's min to median
  if (v.basedOn === 1 && v.low !== undefined) {
    if (v.rating === 'safe') return `At or above last term's${label} median (${median}).`
    if (v.rating === 'competitive') return `Between last term's min (e$ ${+v.low.toFixed(1)}) and median (${median}). You may still be outbid.`
    return `Below last term's lowest successful bid (e$ ${+v.low.toFixed(1)}).`
  }
  if (v.rating === 'safe') return `Above the average of the last ${v.basedOn}${label} medians (${median}).`
  if (v.rating === 'competitive') return `Within 1 SD of the ${median} average median. You may still be outbid.`
  return `More than 1 SD below the ${median} average median.`
})
const pill = { safe: ['success', 'Safe'], competitive: ['warning', 'Competitive'], 'at-risk': ['destructive', 'At risk'] }

// Slide the panel content in whenever a different card is opened
const body = ref(null)
watch(
  () => props.code,
  () => body.value && animate(body.value, { opacity: [0, 1], x: [12, 0] }, { duration: 0.22, ease }),
  { flush: 'post' },
)
</script>

<template>
  <aside class="flex w-full xl:w-[360px] shrink-0 flex-col self-stretch rounded-lg border border-border bg-card shadow-sm">
    <div ref="body" class="flex flex-1 flex-col">
      <!-- Empty state -->
      <div v-if="!code || !section" class="flex flex-1 flex-col items-center justify-center gap-2 px-10 text-center">
        <span class="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
          <img :src="iconPointer" alt="" class="size-5" />
        </span>
        <p class="text-[17px] font-semibold">Select a module card</p>
        <p class="text-[13px] leading-5 text-muted-foreground">
          Click any card in the timetable to see section details and simulate your bid.
        </p>
      </div>

      <template v-else>
        <div class="flex flex-col gap-1 border-b border-border px-5 pt-5">
          <div class="flex items-start gap-3">
            <div class="flex flex-1 flex-col gap-1">
              <p class="font-mono text-[11px] font-bold tracking-[0.44px] text-primary uppercase">
                {{ code }} · Section {{ section.section }} · 1 CU
              </p>
              <h2 class="text-[18px] leading-normal font-semibold">{{ moduleName(code) }}</h2>
            </div>
            <button type="button" aria-label="Close" class="rounded-sm p-1 hover:bg-muted" @click="emit('close')">
              <img :src="iconX" alt="" class="size-4" />
            </button>
          </div>
          <div class="mt-1 flex gap-5" role="tablist">
            <button
              v-for="t in tabs"
              :key="t"
              type="button"
              role="tab"
              :aria-selected="tab === t"
              class="-mb-px border-b-2 py-2 text-[14px] transition-colors"
              :class="tab === t ? 'border-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'"
              @click="tab = t"
            >
              {{ t }}
            </button>
          </div>
        </div>

        <div class="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <!-- Details -->
          <template v-if="tab === 'Details'">
            <dl class="flex flex-col gap-2.5 text-[13px]">
              <div v-for="[k, v] in details" :key="k" class="flex gap-3">
                <dt class="w-[84px] shrink-0 text-muted-foreground">{{ k }}</dt>
                <dd class="flex-1 font-medium">{{ v }}</dd>
              </div>
            </dl>
            <section v-if="weightage[code]" class="flex flex-col gap-2.5 border-t border-border pt-4">
              <h3 class="text-[14px] font-semibold">Weightage of components</h3>
              <div v-for="w in weightage[code]" :key="w.label" class="flex flex-col gap-1">
                <div class="flex justify-between text-[13px]">
                  <span>{{ w.label }}</span>
                  <span class="font-mono text-[12px] font-medium">{{ w.pct }}%</span>
                </div>
                <div class="relative h-1.5 overflow-hidden rounded-full bg-muted">
                  <span class="absolute inset-y-0 left-0 rounded-full bg-primary" :style="{ width: `${w.pct}%` }" />
                </div>
              </div>
            </section>
          </template>

          <!-- Simulate -->
          <template v-else-if="tab === 'Simulate'">
            <label class="flex flex-col gap-2">
              <span class="text-[13px] text-muted-foreground">Bid amount</span>
              <span
                class="flex items-center gap-2 rounded-md border-2 px-3 py-2.5 text-[16px] transition-colors"
                :class="bidTooLow ? 'border-destructive' : 'border-primary'"
              >
                <span class="text-muted-foreground">e$</span>
                <input :value="bid" type="number" :min="MIN_BID" step="0.01" inputmode="decimal" aria-label="Bid amount in e$" @input="onBidInput" class="min-w-0 flex-1 bg-transparent font-medium outline-none" />
              </span>
              <span v-if="bidTooLow" class="text-[12px] text-destructive">Minimum bid is e$ {{ MIN_BID }}.</span>
            </label>

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
            <!-- The backend's suggested bid: the mean of past medians plus 1 SD -->
            <div v-if="canEstimateBid(round, bidding.round.term) && reference?.suggested && reference.basedOn" class="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
              <p class="text-[12.5px] leading-normal">
                Suggested <span class="font-mono font-bold">e$ {{ reference.suggested }}</span>
                <span class="text-muted-foreground"> · from {{ reference.basedOn }} past {{ reference.basedOn === 1 ? 'term' : 'terms' }}</span>
              </p>
              <BaseButton v-if="Number(bid) !== reference.suggested" size="sm" variant="outline" @click="useSuggested">Use</BaseButton>
            </div>

            <p v-if="canEstimateBid(round, bidding.round.term) && matchNote" class="text-[12px] leading-[17px] text-muted-foreground">{{ matchNote }}</p>

            <SelectField v-model="round" label="BOSS round" :options="roundOptions" />
            <p v-if="round === 'all'" class="text-[12px] text-muted-foreground">Choose a single round for a bid estimate. All rounds remain available in History.</p>
            <p class="text-[11.5px] text-muted-foreground">Suggestion only, based on past bid results. Not a guarantee of allocation.</p>
          </template>

          <!-- History -->
          <template v-else>
            <div class="overflow-hidden rounded-md border border-border">
              <div class="grid grid-cols-4 bg-muted px-3 py-2 text-overline text-muted-foreground">
                <span>Term</span><span>Round</span><span>Median</span><span>Min</span>
              </div>
              <div v-for="h in history" :key="h.term + h.round" class="grid grid-cols-4 border-t border-border px-3 py-2 text-[12.5px]">
                <span>{{ h.term }}</span>
                <span>{{ h.round }}</span>
                <span class="font-mono font-medium">e$ {{ h.median }}</span>
                <span class="font-mono font-medium">e$ {{ h.min }}</span>
              </div>
            </div>
            <p v-if="!history.length" class="text-[13px] text-muted-foreground">No bid history for this module yet.</p>
          </template>
        </div>
      </template>
    </div>

    <div class="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5">
      <p class="flex items-baseline gap-1.5 leading-normal">
        <span class="font-mono text-[15px] font-bold">e$ {{ fmtE(bidding.allocated) }}</span>
        <span class="text-[12px] text-muted-foreground">of e$ {{ user.balance.toLocaleString() }} allocated</span>
      </p>
      <BaseButton size="sm" :disabled="bidding.saving || !bidding.cartReady" @click="bidding.save()">{{ bidding.saving ? 'Saving…' : 'Save plan' }}</BaseButton>
    </div>
    <!-- Save result: the backend's error, or modules whose sections the server does not list so they can't be saved yet -->
    <p v-if="bidding.saveError" class="-mt-1.5 px-5 pb-3 text-[12px] text-destructive">{{ bidding.saveError }}</p>
    <p v-else-if="bidding.online && !bidding.cartReady" role="status" class="-mt-1.5 px-5 pb-3 text-[12px] text-muted-foreground">
      {{ bidding.loadError ? 'Load your saved bids using Retry before saving changes.' : 'Loading your saved bids before changes can be saved…' }}
    </p>
    <p v-else-if="bidding.online && bidding.unsaved.length" class="-mt-1.5 px-5 pb-3 text-[12px] text-muted-foreground">
      No BOSS sections on the server for {{ bidding.unsaved.join(', ') }} yet, so {{ bidding.unsaved.length === 1 ? 'it is' : 'they are' }} not saved.
    </p>
    <p v-else-if="bidding.savedAt" class="-mt-1.5 px-5 pb-3 text-[12px] text-muted-foreground">
      Saved at {{ bidding.savedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }}
    </p>
  </aside>
</template>
