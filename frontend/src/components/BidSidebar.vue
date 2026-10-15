<script setup>
import { computed, ref } from 'vue'
import { useBiddingStore } from '@backend/stores/bidding'
import { moduleName } from '@backend/data/catalogue'
import { days, slots, sections, weightage, rateBid, MIN_BID } from '@backend/data/bidding'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import SelectField from '@/components/ui/SelectField.vue'
import iconX from '@/assets/figma/icon-x.svg'
import chevronDark from '@/assets/figma/chevron-down-dark.svg'

const props = defineProps({ code: { type: String, required: true } })
const emit = defineEmits(['close'])
const bidding = useBiddingStore()

const section = computed(() => sections.find((s) => s.id === bidding.booked[props.code]))
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
const rounds = computed(() => [...new Set(history.value.map((h) => h.round))])
const round = ref('1A')
const filtered = computed(() => history.value.filter((h) => round.value === 'all' || h.round === round.value))
const roundOptions = computed(() => [
  ...rounds.value.map((r) => ({ value: r, label: `Round ${r}` })),
  { value: 'all', label: 'All rounds' },
])

const verdict = computed(() => (bid.value === '' ? null : rateBid(bid.value, filtered.value)))

// Position of the marker on the At risk / Competitive / Safe meter (0–100%)
const markerPct = computed(() => {
  const v = verdict.value
  if (!v) return null
  const lo = v.mean - v.sd
  const hi = v.mean + v.sd
  const amount = bid.value
  if (amount < lo) return (amount / lo) * 30
  if (amount < hi) return 31 + ((amount - lo) / (hi - lo || 1)) * 30
  return Math.min(99, 62 + Math.min(1, (amount - hi) / (hi * 0.5)) * 38)
})

const verdictText = computed(() => {
  const v = verdict.value
  if (!v) return ''
  const median = `e$ ${+v.mean.toFixed(1)}`
  const label = round.value === 'all' ? '' : ` Round ${round.value}`
  if (v.rating === 'safe') return `Above the last ${filtered.value.length}${label} medians of ${median}.`
  if (v.rating === 'competitive') return `Within 1 SD of the ${median} median — you may still be outbid.`
  return `More than 1 SD below the ${median} median.`
})

const badge = { safe: ['success', 'Safe'], competitive: ['warning', 'Competitive'], 'at-risk': ['warning', 'At risk'] }
</script>

<template>
  <aside class="flex w-[380px] shrink-0 flex-col gap-5 self-start rounded-lg border border-border bg-card p-6 shadow-md">
    <div class="flex items-start gap-3">
      <div class="flex flex-1 flex-col gap-1">
        <p class="text-overline text-primary">{{ code }} · SECTION {{ section.section }} · 1 CU</p>
        <h2 class="text-h3">{{ moduleName(code) }}</h2>
      </div>
      <button type="button" aria-label="Close" class="rounded-md p-1.5 hover:bg-muted" @click="emit('close')">
        <img :src="iconX" alt="" class="size-4" />
      </button>
    </div>

    <dl class="flex flex-col gap-2.5 text-[13px]">
      <div v-for="[k, v] in details" :key="k" class="flex gap-3">
        <dt class="w-[84px] shrink-0 text-muted-foreground">{{ k }}</dt>
        <dd class="flex-1 font-medium">{{ v }}</dd>
      </div>
    </dl>

    <div class="h-px bg-border" />

    <section class="flex flex-col gap-3.5">
      <h3 class="text-h4">BOSS bidding simulator</h3>
      <label class="flex flex-col gap-1.5">
        <span class="text-[13px] font-medium">Bid amount</span>
        <span
          class="flex items-center gap-1.5 rounded-md border-2 px-3 py-[9px] font-mono text-[14px] font-medium"
          :class="bidTooLow ? 'border-destructive' : 'border-primary'"
        >
          <span class="text-muted-foreground">e$</span>
          <input v-model="bid" type="number" :min="MIN_BID" class="min-w-0 flex-1 bg-transparent outline-none" />
        </span>
        <span v-if="bidTooLow" class="text-[12px] text-destructive">Minimum bid is e$ {{ MIN_BID }}.</span>
      </label>

      <div class="flex flex-col gap-1.5">
        <div class="relative flex gap-0.5">
          <span class="h-2 w-[30%] rounded-[4px] bg-destructive/35" />
          <span class="h-2 w-[30%] rounded-[4px] bg-warning/35" />
          <span class="h-2 flex-1 rounded-[4px] bg-success/35" />
          <span
            v-if="markerPct !== null"
            class="absolute -top-1 h-4 w-[3px] rounded-[2px] bg-foreground transition-[left]"
            :style="{ left: `${markerPct}%` }"
          />
        </div>
        <div class="flex justify-between text-[11.5px] font-medium">
          <span class="text-destructive">At risk</span>
          <span class="text-warning">Competitive</span>
          <span class="text-success">Safe</span>
        </div>
      </div>

      <template v-if="verdict">
        <div class="flex items-center gap-2">
          <BaseBadge :variant="badge[verdict.rating][0]" dot>{{ badge[verdict.rating][1] }}</BaseBadge>
          <p class="flex-1 text-small text-muted-foreground">{{ verdictText }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex flex-col gap-1.5">
            <span class="text-overline text-muted-foreground">BOSS Round</span>
            <SelectField v-model="round" :options="roundOptions" :chevron="chevronDark" />
          </div>
          <div class="overflow-hidden rounded-md border border-border">
            <div class="flex bg-muted px-3 py-2 text-[11px] font-medium text-muted-foreground">
              <span class="flex-1">TERM</span><span class="flex-1">ROUND</span><span class="flex-1">MEDIAN</span><span class="flex-1">MIN</span>
            </div>
            <div v-for="h in filtered" :key="h.term + h.round" class="flex border-t border-border px-3 py-2">
              <span class="flex-1 text-[12.5px]">{{ h.term }}</span>
              <span class="flex-1 text-[12.5px]">{{ h.round }}</span>
              <span class="flex-1 font-mono text-[12px] font-medium">e$ {{ h.median }}</span>
              <span class="flex-1 font-mono text-[12px] font-medium">e$ {{ h.min }}</span>
            </div>
          </div>
          <p class="text-[11.5px] text-muted-foreground">
            Suggestion only — based on past bid results, not a guarantee of allocation.
          </p>
        </div>
      </template>
    </section>

    <template v-if="weightage[code]">
      <div class="h-px bg-border" />
      <section class="flex flex-col gap-2.5">
        <h3 class="text-h4">Weightage of components</h3>
        <div v-for="w in weightage[code]" :key="w.label" class="flex flex-col gap-1">
          <div class="flex justify-between">
            <span class="text-[13px]">{{ w.label }}</span>
            <span class="font-mono text-[12px] font-medium">{{ w.pct }}%</span>
          </div>
          <div class="relative h-1.5 overflow-hidden rounded-full bg-muted">
            <span class="absolute inset-y-0 left-0 rounded-[3px] bg-primary" :style="{ width: `${w.pct}%` }" />
          </div>
        </div>
      </section>
    </template>
  </aside>
</template>
