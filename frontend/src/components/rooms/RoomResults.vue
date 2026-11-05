<script setup>
// Room sidebar: where the vote stands. Once everyone has voted, the party admin locks one of the sections with the
// most votes for the whole room. That section feeds every member's bidding until the party admin unlocks it.
import { computed, ref, watch } from 'vue'
import { useRoomsStore } from '@core/stores/rooms'
import { useUserStore } from '@core/stores/user'
import { termLabel } from '@core/data/bidding'
import { sectionCode } from '@core/utils/clash'
import { lockableSections } from '@core/utils/roomBoard'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
const props = defineProps({ roomId: { type: String, required: true }, dirty: Boolean })
const rooms = useRoomsStore(), user = useUserStore()
const board = computed(() => rooms.voteBoards[props.roomId])
const isAdmin = computed(() => !!board.value && board.value.ownerId === String(user.profile._id))
const ranking = computed(() => [...(board.value?.rows ?? [])].sort((a,b) => b.count - a.count || a.section.section.localeCompare(b.section.section)))
const lockedRow = computed(() => ranking.value.find(row => row.section.id === board.value?.lockedSection))
// The locked section may no longer be on offer, so fall back to reading its code from the id
const lockedCode = computed(() => lockedRow.value?.section.section ?? sectionCode(board.value?.lockedSection, rooms.getRoom(props.roomId)?.module))
const lockable = computed(() => lockableSections(board.value))
const waiting = computed(() => (board.value?.members ?? []).filter(member => board.value.waitingIds?.includes(member._id)).map(member => member.name).join(', '))
const working = computed(() => !!rooms.voteSaving[props.roomId] || rooms.busy)
// What the vote needs next, worded for whoever is reading it
const nextStep = computed(() => {
  if (!board.value || board.value.locked) return ''
  if (!board.value.allVoted) return isAdmin.value ? 'You can lock a section once everyone has voted.' : 'Once everyone has voted, the party admin locks the section with the most votes.'
  if (isAdmin.value) return board.value.tie ? 'Everyone has voted and there’s a tie at the top. Lock one of the tied sections.' : 'Everyone has voted. Lock the section with the most votes.'
  return board.value.tie ? 'Everyone has voted and there’s a tie at the top. The party admin will lock one of the tied sections.' : 'Everyone has voted. Waiting for the party admin to lock the section.'
})

const feedback = ref('')
// The lock or unlock waiting for the party admin to confirm: { type: 'lock', row } or { type: 'unlock' }
const asking = ref(null)
watch(() => props.roomId, () => { feedback.value = ''; asking.value = null })
function ask(next) { rooms.voteErrors[props.roomId] = ''; feedback.value = ''; asking.value = next }
async function confirmAsk() {
  const pending = asking.value
  const ok = pending.type === 'lock' ? await rooms.lockRoom(props.roomId, pending.row.section.id) : await rooms.unlockRoom(props.roomId)
  if (!ok) return // the dialog stays open and shows why
  feedback.value = pending.type === 'lock' ? `${pending.row.section.section} is locked for everyone.` : 'The room is unlocked. Votes can change again.'
  asking.value = null
}
</script>
<template>
  <aside
    v-if="board"
    class="flex flex-col gap-3 rounded-lg border p-4"
    :class="board.locked ? 'border-2 border-success bg-success-tint' : 'border-border bg-muted/30'"
    aria-labelledby="room-results-title"
  >
    <div class="flex items-center justify-between gap-2"><h3 id="room-results-title" class="text-overline text-muted-foreground">Room results</h3><span class="rounded-full bg-card px-2 py-1 text-xs font-medium">{{ board.locked ? 'Locked' : board.allVoted ? 'Ready to lock' : 'Voting' }}</span></div>
    <!-- The locked section is the headline -->
    <div v-if="board.locked" class="flex flex-col leading-tight">
      <span class="font-mono text-[30px] font-bold">{{ lockedCode }}</span>
      <span v-if="lockedRow" class="text-[12px] text-muted-foreground">{{ lockedRow.section.module }} · {{ lockedRow.count }} {{ lockedRow.count === 1 ? 'vote' : 'votes' }}</span>
      <span class="mt-1.5 text-[12px] leading-normal text-muted-foreground">{{ isAdmin ? 'You locked this section for everyone. Votes are closed until you unlock it.' : 'The party admin locked this section for everyone. Votes are closed until they unlock it.' }}</span>
    </div>
    <div>
      <p class="text-sm font-medium">{{ board.votedCount }} / {{ board.memberCount }} voted</p>
      <progress class="mt-2 h-1.5 w-full accent-primary" :value="board.votedCount" :max="board.memberCount || 1" :aria-label="`${board.votedCount} of ${board.memberCount} members voted`" />
      <p v-if="waiting" class="mt-2 text-xs text-muted-foreground">Waiting for {{ waiting }}</p>
    </div>
    <p v-if="nextStep" class="text-xs text-muted-foreground">{{ nextStep }}</p>
    <ol class="flex max-h-72 flex-col gap-2 overflow-y-auto" aria-label="Section ranking">
      <li v-for="row in ranking" :key="row.section.id" class="rounded-md border bg-card p-3" :class="row.section.id === board.lockedSection ? 'border-primary' : 'border-border'">
        <div class="flex justify-between gap-2 text-sm"><span class="font-semibold">{{ row.section.section }}</span><span>{{ row.count }} {{ row.count === 1 ? 'vote' : 'votes' }}</span></div>
        <p v-if="row.section.id === board.lockedSection" class="mt-1 text-xs font-medium text-primary">Locked section</p>
        <p v-else-if="!board.locked && board.leaders.includes(row.section.id)" class="mt-1 text-xs font-medium text-muted-foreground">{{ board.tie ? 'Tied for most votes' : 'Most votes' }}</p>
        <BaseButton v-if="isAdmin && lockable.includes(row.section.id)" class="mt-2" size="sm" :disabled="dirty || working" @click="ask({ type: 'lock', row })">Lock this section</BaseButton>
      </li>
    </ol>
    <p v-if="dirty && isAdmin && lockable.length" class="text-xs text-muted-foreground">Save your votes before locking a section.</p>
    <template v-if="board.locked">
      <BaseButton to="/bidding">Review bidding</BaseButton>
      <p class="text-xs text-muted-foreground">{{ lockedCode }} appears automatically in everyone’s bidding for {{ termLabel(board.term) }}. Review the amount and save your bids there. Your What-If plans stay unchanged.</p>
      <BaseButton v-if="isAdmin" variant="destructive-outline" :disabled="working" @click="ask({ type: 'unlock' })">Unlock room</BaseButton>
    </template>
    <p v-if="feedback" role="status" class="text-xs text-success">{{ feedback }}</p>
  </aside>
  <BaseModal v-if="asking" width="w-[440px]" @close="!working && (asking = null)">
    <template v-if="asking.type === 'lock'">
      <h2 class="text-h4">Lock {{ asking.row.section.section }} for everyone?</h2>
      <p class="text-[14px] leading-[22px] text-muted-foreground">Votes close for the whole room, and {{ asking.row.section.module }} {{ asking.row.section.section }} goes into every member’s bidding planner. You can unlock the room later.</p>
    </template>
    <template v-else>
      <h2 class="text-h4">Unlock this room?</h2>
      <p class="text-[14px] leading-[22px] text-muted-foreground">Votes reopen for everyone, and {{ lockedCode }} comes out of every member’s bidding planner until a section is locked again.</p>
    </template>
    <p v-if="rooms.voteErrors[roomId]" role="alert" class="text-[13px] text-destructive">{{ rooms.voteErrors[roomId] }}</p>
    <div class="flex justify-end gap-2">
      <BaseButton variant="ghost" :disabled="working" @click="asking = null">Cancel</BaseButton>
      <BaseButton :variant="asking.type === 'lock' ? 'primary' : 'destructive-outline'" :disabled="working" @click="confirmAsk">{{ working ? 'Saving…' : asking.type === 'lock' ? 'Lock section' : 'Unlock room' }}</BaseButton>
    </div>
  </BaseModal>
</template>
