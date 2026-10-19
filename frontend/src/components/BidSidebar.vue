<script setup>
// Right-hand panel of the BOSS Bidding Planner: empty state, or Details / Simulate / History for the
// selected module, with the allocated-e$ footer and Save plan button always pinned to the bottom.
import { computed, ref, watch } from 'vue'
import { animate } from 'motion'
import { useBiddingStore } from '@backend/stores/bidding'
import { useUserStore } from '@backend/stores/user'
import { moduleName } from '@backend/data/catalogue'
import { days, slots, sections, weightage, rateBid, MIN_BID } from '@backend/data/bidding'
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

// TODO(backend): sections / bid history / weightage come from @backend/data/bidding — swap for /api/bidding/…
const section = computed(() => props.code && sections.find((s) => s.id === bidding.booked[props.code]))
const details = computed(() => [
  ['Professor', section.value.prof],
  ['Section', section.value.section],
  ['Class', `${days[section.value.day].slice(0, 3)} · ${slots[section.value.slot].start} – ${slots[section.value.slot].end}`],
  ['Location', section.value.venue],
  ['Exam', section.value.exam],
])

const bid = computed({
  get: () => bidding.bids[props.code] ?? '',
  set: (v) => bidding.setBid(props.code, v === '' ? '' : Number(v)),
})
const bidTooLow = computed(() => bid.value !== '' && bid.value < MIN_BID)

const history = computed(() => bidding.bidHistory[props.code] ?? [])
const round = ref('1A')
const roundOptions = computed(() => [
  ...[...new Set(history.value.map((h) => h.round))].map((r) => ({ value: r, label: `Round ${r}` })),
  { value: 'all', label: 'All rounds' },
])
const filtered = computed(() => history.value.filter((h) => round.value === 'all' || h.round === round.value))
const verdict = computed(() => (bid.value === '' || !filtered.value.length ? null : rateBid(bid.value, filtered.value)))

// Marker position on the At risk / Competitive / Safe meter (0–100%)
const markerPct = computed(() => {
  const v = verdict.value
  if (!v) return null
  const lo = v.mean - v.sd
  const hi = v.mean + v.sd
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
  if (v.rating === 'safe') return `Above the last ${filtered.value.length}${label} medians (${median}).`
  if (v.rating === 'competitive') return `Within 1 SD of the ${median} median. You may still be outbid.`
  return `More than 1 SD below the ${median} median.`
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
  <aside class="flex w-[360px] shrink-0 flex-col self-stretch rounded-lg border border-border bg-card shadow-sm">
    <div ref="body" class="flex flex-1 flex-col">
      <!-- Empty state -->
      <div v-if="!code" class="flex flex-1 flex-col items-center justify-center gap-2 px-10 text-center">
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
                <input v-model="bid" type="number" :min="MIN_BID" class="min-w-0 flex-1 bg-transparent font-medium outline-none" />
              </span>
              <span v-if="bidTooLow" class="text-[12px] text-destructive">Minimum bid is e$ {{ MIN_BID }}.</span>
            </label>

            <div class="flex flex-col gap-2">
              <div class="relative flex gap-1">
                <span class="h-1.5 flex-1 rounded-full bg-destructive/55" />
                <span class="h-1.5 flex-1 rounded-full bg-warning/55" />
                <span class="h-1.5 flex-1 rounded-full bg-success/55" />
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

            <SelectField v-model="round" label="BOSS round" :options="roundOptions" />
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
        <span class="font-mono text-[15px] font-bold">e$ {{ bidding.allocated }}</span>
        <span class="text-[12px] text-muted-foreground">of e$ {{ user.balance.toLocaleString() }} allocated</span>
      </p>
      <BaseButton size="sm" @click="bidding.save()">Save plan</BaseButton>
    </div>
  </aside>
</template>
