<script setup>
import { computed, ref, watch } from 'vue'
import { useRoomsStore } from '@core/stores/rooms'
import { useUserStore } from '@core/stores/user'
import { usePlannerStore } from '@core/stores/planner'
import { useBiddingStore } from '@core/stores/bidding'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
const props = defineProps({ roomId: { type: String, required: true }, dirty: Boolean })
const rooms = useRoomsStore(), user = useUserStore(), planner = usePlannerStore(), bidding = useBiddingStore()
const board = computed(() => rooms.voteBoards[props.roomId])
const owner = computed(() => board.value?.ownerId === String(user.profile._id))
const ranking = computed(() => [...(board.value?.rows ?? [])].sort((a,b) => b.count - a.count || a.section.section.localeCompare(b.section.section)))
const confirmed = computed(() => ranking.value.find(row => row.section.id === board.value?.finalisedSection))
const waiting = computed(() => (board.value?.members ?? []).filter(member => board.value.waitingIds?.includes(member._id)).map(member => member.name).join(', '))
const importing = ref(false), targetPlan = ref(''), adding = ref(false), error = ref(''), prepared = ref(null), feedback = ref('')
watch(() => props.roomId, () => { importing.value = false; prepared.value = null; feedback.value = ''; error.value = '' })
function openImport() { targetPlan.value = planner.activePlanId; error.value = ''; prepared.value = null; importing.value = true }
async function confirm(id) { feedback.value = ''; if (await rooms.confirmSection(props.roomId, id)) feedback.value = id ? 'Section confirmed for the room.' : 'Confirmation cleared. Voting remains open.' }
async function add() {
  adding.value = true; error.value = ''
  try { prepared.value = await bidding.addRoomSection(props.roomId, confirmed.value.section.id, targetPlan.value) }
  catch (failure) { error.value = failure.message }
  finally { adding.value = false }
}
</script>
<template>
  <aside
    v-if="board"
    class="flex flex-col gap-3 rounded-lg border p-4"
    :class="confirmed ? 'border-2 border-success bg-success-tint' : 'border-border bg-muted/30'"
    aria-labelledby="room-results-title"
  >
    <div class="flex items-center justify-between gap-2"><h3 id="room-results-title" class="text-overline text-muted-foreground">Room decision</h3><span class="rounded-full bg-card px-2 py-1 text-xs font-medium">{{ confirmed ? 'Confirmed' : board.allVoted ? 'Ready' : 'Voting' }}</span></div>
    <!-- Confirmed: the section code is the headline -->
    <div v-if="confirmed" class="flex flex-col leading-tight">
      <span class="font-mono text-[30px] font-bold">{{ confirmed.section.section }}</span>
      <span class="text-[12px] text-muted-foreground">{{ confirmed.section.module }} · {{ confirmed.count }} {{ confirmed.count === 1 ? 'vote' : 'votes' }}</span>
    </div>
    <div>
      <p class="text-sm font-medium">{{ board.votedCount }} / {{ board.memberCount }} voted</p>
      <progress class="mt-2 h-1.5 w-full accent-primary" :value="board.votedCount" :max="board.memberCount || 1" :aria-label="`${board.votedCount} of ${board.memberCount} members voted`" />
      <p v-if="waiting" class="mt-2 text-xs text-muted-foreground">Waiting for {{ waiting }}</p>
    </div>
    <p v-if="!board.allVoted" class="text-xs text-muted-foreground">Everyone must save at least one available section before the party admin can confirm.</p>
    <p v-else-if="board.tie && !confirmed" class="text-xs text-muted-foreground">There’s a tie. The party admin can choose any section sharing the lead.</p>
    <ol class="flex max-h-72 flex-col gap-2 overflow-y-auto" aria-label="Section ranking">
      <li v-for="row in ranking" :key="row.section.id" class="rounded-md border bg-card p-3" :class="row.section.id === board.finalisedSection ? 'border-primary' : 'border-border'">
        <div class="flex justify-between gap-2 text-sm"><span class="font-semibold">{{ row.section.section }}</span><span>{{ row.count }} {{ row.count === 1 ? 'vote' : 'votes' }}</span></div>
        <p v-if="row.section.id === board.finalisedSection" class="mt-1 text-xs font-medium text-primary">Confirmed section</p>
        <BaseButton v-else-if="owner && board.allVoted && board.leaders?.includes(row.section.id)" class="mt-2" size="sm" variant="outline" :disabled="dirty || rooms.voteSaving[roomId] || rooms.busy" @click="confirm(row.section.id)">{{ confirmed ? 'Choose this instead' : 'Confirm section' }}</BaseButton>
      </li>
    </ol>
    <p v-if="dirty && owner" class="text-xs text-muted-foreground">Save your choices before confirming a result.</p>
    <p v-if="!owner && !confirmed" class="text-xs text-muted-foreground">Your party admin confirms the result.</p>
    <template v-if="confirmed">
      <BaseButton :disabled="dirty || rooms.voteSaving[roomId] || !planner.online" @click="openImport">Add to my bidding</BaseButton>
      <p class="text-xs text-muted-foreground">Bring {{ confirmed.section.section }} into one of your own bid carts. No one else’s plan changes.</p>
      <BaseButton v-if="owner" variant="ghost" size="sm" :disabled="rooms.voteSaving[roomId] || rooms.busy" @click="confirm(null)">Reopen decision</BaseButton>
    </template>
    <p v-if="feedback" role="status" class="text-xs text-success">{{ feedback }}</p>
  </aside>
  <BaseModal v-if="importing" width="w-[480px]" @close="!adding && (importing = false)">
    <h2 class="text-lg font-semibold">Add confirmed section to bidding</h2>
    <template v-if="!prepared">
      <p class="text-sm text-muted-foreground">This replaces the section for this module in your chosen bid cart. Other modules stay as they are. Review and save your bids afterwards.</p>
      <label class="flex flex-col gap-2 text-sm">Your degree plan<select v-model="targetPlan" :disabled="adding" class="rounded-md border border-border bg-card p-3"><option v-for="plan in planner.plans" :key="plan.id" :value="plan.id">{{ plan.name }}</option></select></label>
      <p v-if="!planner.plans.length" class="text-sm">Create a degree plan before adding a section.</p>
      <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
      <div class="flex justify-end gap-2"><BaseButton variant="ghost" :disabled="adding" @click="importing = false">Cancel</BaseButton><BaseButton :disabled="adding || !targetPlan" @click="add">{{ adding ? 'Checking…' : 'Add section' }}</BaseButton></div>
    </template>
    <template v-else>
      <p class="text-sm">{{ prepared.section.module }} {{ prepared.section.section }} is selected in your bidding planner. Review the amount and click <strong>Save bids</strong> there to keep it.</p>
      <ul v-if="prepared.notes.length" class="list-disc pl-5 text-sm text-muted-foreground"><li v-for="note in prepared.notes" :key="note">{{ note }}</li></ul>
      <BaseButton :to="`/bidding?plan=${targetPlan}`">Review bidding planner</BaseButton>
    </template>
  </BaseModal>
</template>
