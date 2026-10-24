<script setup>
// Suggested bids for one section of a room: everyone's e$ suggestions plus the average, and your own box.
// You can only suggest a bid for a section you picked.
import { computed, ref, watch } from 'vue'
import { useRoomsStore } from '@core/stores/rooms'
import { MIN_BID } from '@core/data/bidding'
import BaseButton from '@/components/ui/BaseButton.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'

const props = defineProps({
  roomId: { type: String, required: true },
  sectionId: { type: String, required: true },
  label: { type: String, required: true }, // e.g. "G1"
  compact: Boolean, // fewer words, for narrow cards
})

const rooms = useRoomsStore()
const room = computed(() => rooms.getRoom(props.roomId))
const bids = computed(() => room.value.suggestedBids[props.sectionId] ?? {})
const canBid = computed(() => (rooms.myVotes[props.roomId] ?? []).includes(props.sectionId))

const input = ref('')
watch(() => props.sectionId, () => (input.value = bids.value.me ?? ''), { immediate: true })
const amount = computed(() => Number(input.value))
const valid = computed(() => input.value !== '' && Number.isInteger(amount.value) && amount.value >= MIN_BID)
const saved = computed(() => bids.value.me ?? null)
const save = () => valid.value && rooms.setMyBid(props.roomId, props.sectionId, amount.value)

const suggestions = computed(() =>
  Object.entries(bids.value)
    .map(([id, value]) => ({ person: rooms.person(id), amount: value }))
    .sort((a, b) => b.amount - a.amount),
)
const average = computed(() =>
  suggestions.value.length ? Math.round(suggestions.value.reduce((a, s) => a + s.amount, 0) / suggestions.value.length) : null,
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <p class="text-overline text-muted-foreground">{{ compact ? 'Suggested bids' : `Suggested bid for ${label}` }}</p>
    <template v-if="canBid">
      <div class="flex max-w-[320px] gap-2">
        <label class="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border px-3 py-[7px] focus-within:border-ring">
          <span class="text-[13px] text-muted-foreground">e$</span>
          <input
            v-model="input"
            type="number"
            :min="MIN_BID"
            step="1"
            placeholder="e.g. 35"
            :aria-label="`Suggested bid in e$ for ${label}`"
            class="min-w-0 flex-1 bg-transparent font-mono text-[14px] font-medium outline-none"
            @keydown.enter.prevent="save"
          />
        </label>
        <BaseButton size="sm" :disabled="!valid || amount === saved" @click="save">Save</BaseButton>
      </div>
      <span v-if="input !== '' && !valid" class="text-[12px] text-destructive">Minimum bid is e$ {{ MIN_BID }}.</span>
      <span v-else-if="saved !== null && !compact" class="text-[12px] text-muted-foreground">Your suggestion for {{ label }}: e$ {{ saved }}</span>
    </template>
    <p v-else-if="compact" class="text-[12px] leading-normal text-muted-foreground">You didn't pick this section.</p>
    <p v-else class="text-[12px] leading-normal text-muted-foreground">
      You haven't picked this section. Pick it to suggest a bid for it.
      <RouterLink :to="`/rooms/${roomId}`" class="font-medium text-primary hover:underline">Change my picks</RouterLink>
    </p>

    <ul v-if="suggestions.length" class="flex flex-col gap-1.5 pt-1">
      <li v-for="s in suggestions" :key="s.person.id" class="flex max-w-[320px] items-center gap-2 text-[13px]">
        <UserAvatar :initials="s.person.initials" :size="24" :you="s.person.you" />
        <span class="flex-1">{{ s.person.short }}</span>
        <span class="font-mono font-medium">e$ {{ s.amount }}</span>
      </li>
    </ul>
    <p v-if="average !== null && compact" class="text-[12px] font-medium text-muted-foreground">Average e$ {{ average }}</p>
    <p v-else-if="average !== null" class="text-[12px] text-muted-foreground">
      Average of {{ suggestions.length }} suggestion{{ suggestions.length === 1 ? '' : 's' }} for {{ label }}: e$ {{ average }}
    </p>
    <p v-else-if="canBid && !compact" class="text-[12px] text-muted-foreground">No suggestions for {{ label }} yet.</p>
  </div>
</template>
