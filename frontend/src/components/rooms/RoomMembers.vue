<script setup>
import { computed, ref } from 'vue'
import { useRoomsStore, roleOf } from '@core/stores/rooms'
import { useUserStore } from '@core/stores/user'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
const props = defineProps({ roomId: { type: String, required: true } })
const rooms = useRoomsStore(), user = useUserStore()
const room = computed(() => rooms.getRoom(props.roomId))
const board = computed(() => rooms.voteBoards[props.roomId])
const owner = computed(() => room.value?.ownerId === 'me')
const action = ref(null), feedback = ref('')
const voted = id => board.value && !board.value.waitingIds?.includes(id === 'me' ? String(user.profile._id) : id)
async function execute() {
  const pending = action.value
  const ok = pending.type === 'remove' ? await rooms.removeMember(props.roomId, pending.id) : await rooms.transferOwner(props.roomId, pending.id)
  if (ok) { feedback.value = pending.type === 'remove' ? 'Member removed. The room decision has reopened.' : 'Party admin transferred.'; action.value = null }
}
</script>
<template>
  <details v-if="room" class="card p-5">
    <summary class="cursor-pointer font-semibold">Members <span class="ml-2 text-sm font-normal text-muted-foreground">{{ room.members.length }} / {{ room.maxMembers }}</span></summary>
    <ul class="mt-4 divide-y divide-border">
      <li v-for="id in room.members" :key="id" class="flex flex-wrap items-center justify-between gap-3 py-3">
        <div class="flex items-center gap-3"><UserAvatar :initials="rooms.person(id).initials" :you="id === 'me'" /><div><p class="text-sm font-medium">{{ id === 'me' ? 'You' : rooms.person(id).name }}</p><p class="mt-1 text-xs text-muted-foreground">{{ roleOf(room, id) === 'owner' ? 'Party admin · ' : '' }}{{ !board ? 'Checking votes…' : voted(id) ? 'Voted' : 'Not voted yet' }}</p></div></div>
        <div v-if="owner && id !== 'me'" class="flex flex-wrap gap-2">
          <BaseButton size="sm" variant="outline" :disabled="rooms.busy || rooms.voteSaving[roomId] || !board" @click="action = { type: 'transfer', id }">Make party admin</BaseButton>
          <BaseButton size="sm" variant="ghost" :disabled="rooms.busy || rooms.voteSaving[roomId] || !board" @click="action = { type: 'remove', id }">Remove</BaseButton>
        </div>
      </li>
    </ul>
    <p v-if="feedback" role="status" class="mt-3 text-sm text-success">{{ feedback }}</p>
    <p class="mt-3 text-xs text-muted-foreground">One party admin manages this room. Transfer ownership before leaving if other members remain.</p>
  </details>
  <BaseModal v-if="action" width="w-[440px]" @close="!rooms.busy && (action = null)">
    <h2 class="text-lg font-semibold">{{ action.type === 'remove' ? `Remove ${rooms.person(action.id).name}?` : `Make ${rooms.person(action.id).name} party admin?` }}</h2>
    <p class="text-sm text-muted-foreground">{{ action.type === 'remove' ? 'Their votes will be removed and any confirmed section will reopen for review. They can rejoin using the invite code.' : 'You will become a regular member. This person will confirm decisions and manage members.' }}</p>
    <p v-if="rooms.voteErrors[roomId]" role="alert" class="text-sm text-destructive">{{ rooms.voteErrors[roomId] }}</p>
    <div class="flex justify-end gap-2"><BaseButton variant="ghost" :disabled="rooms.busy" @click="action = null">Cancel</BaseButton><BaseButton :disabled="rooms.busy" @click="execute">{{ rooms.busy ? 'Saving…' : action.type === 'remove' ? 'Remove member' : 'Transfer party admin' }}</BaseButton></div>
  </BaseModal>
</template>
