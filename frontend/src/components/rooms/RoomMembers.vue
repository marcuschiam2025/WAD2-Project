<script setup>
// Room sidebar: members with their role and vote status. The party admin (room owner) can remove a member
// from the ··· menu (after confirming); that also stops them rejoining with the room code.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoomsStore, roleOf } from '@core/stores/rooms'
import { useUserStore } from '@core/stores/user'
import { popEnter, popLeave } from '@/motion'
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
// Party admin first, then everyone else
const members = computed(() =>
  [...(room.value?.members ?? [])].sort((a, b) => (roleOf(room.value, b) === 'owner') - (roleOf(room.value, a) === 'owner')),
)
const statusOf = id => (!board.value ? 'Checking votes…' : voted(id) ? 'Voted' : 'Not yet')

// The ··· menu on a member row
const menuFor = ref(null)
const closeMenu = () => (menuFor.value = null)
onMounted(() => document.addEventListener('click', closeMenu))
onBeforeUnmount(() => document.removeEventListener('click', closeMenu))
function ask(type, id) {
  action.value = { type, id }
  menuFor.value = null
}

async function execute() {
  const pending = action.value
  const ok = await rooms.removeMember(props.roomId, pending.id)
  if (ok) { feedback.value = 'Member removed. They can no longer rejoin with the room code.'; action.value = null }
}
</script>

<template>
  <div v-if="room" class="flex flex-col gap-2.5">
    <p class="text-overline text-muted-foreground">Members · {{ room.members.length }} of {{ room.maxMembers }}</p>
    <ul class="flex flex-col gap-2.5">
      <li v-for="id in members" :key="id" class="relative flex items-center gap-2.5 text-[14px]">
        <UserAvatar :initials="rooms.person(id).initials" :size="24" :you="id === 'me'" />
        <div class="flex min-w-0 flex-1 flex-col leading-normal">
          <span class="flex items-center gap-1.5">
            <span class="truncate">{{ id === 'me' ? 'You' : rooms.person(id).name }}</span>
            <span
              v-if="roleOf(room, id) === 'owner'"
              class="shrink-0 rounded-sm border border-primary bg-primary-tint px-1.5 text-[10.5px] font-semibold text-primary"
            >Party admin</span>
          </span>
          <span class="text-[12px]" :class="statusOf(id) === 'Voted' ? 'font-medium text-success' : 'text-muted-foreground'">
            {{ statusOf(id) === 'Voted' ? '✓ Voted' : statusOf(id) }}
          </span>
        </div>
        <button
          v-if="owner && id !== 'me'"
          type="button"
          :aria-label="`Manage ${rooms.person(id).name}`"
          :aria-expanded="menuFor === id"
          :disabled="rooms.busy || rooms.voteSaving[roomId] || !board"
          class="rounded-sm px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          @click.stop="menuFor = menuFor === id ? null : id"
        >···</button>
        <Transition :css="false" @enter="popEnter" @leave="popLeave">
          <div
            v-if="menuFor === id"
            class="absolute top-full right-0 z-20 mt-1 flex w-48 flex-col rounded-lg border border-border bg-card p-1.5 shadow-md"
            @click.stop
          >
            <button type="button" class="rounded-sm px-2.5 py-2 text-left text-[13px] text-destructive transition-colors hover:bg-destructive-tint" @click="ask('remove', id)">
              Remove from room
            </button>
          </div>
        </Transition>
      </li>
    </ul>
    <p v-if="feedback" role="status" class="text-[12px] text-success">{{ feedback }}</p>
    <p class="text-[12px] leading-normal text-muted-foreground">
      {{ owner ? "You're the party admin: you can remove members." : 'Each member picks their own section; the party admin manages members.' }}
    </p>
  </div>

  <BaseModal v-if="action" width="w-[440px]" @close="!rooms.busy && (action = null)">
    <h2 class="text-h4">Remove {{ rooms.person(action.id).name }} from {{ room?.name }}?</h2>
    <p class="text-[14px] leading-[22px] text-muted-foreground">
      They lose access to this room and their votes and section are removed. They can't rejoin with the room code.
    </p>
    <p v-if="rooms.voteErrors[roomId]" role="alert" class="text-[13px] text-destructive">{{ rooms.voteErrors[roomId] }}</p>
    <div class="flex justify-end gap-2">
      <BaseButton variant="ghost" :disabled="rooms.busy" @click="action = null">Cancel</BaseButton>
      <BaseButton variant="destructive-outline" :disabled="rooms.busy" @click="execute">
        {{ rooms.busy ? 'Saving…' : 'Remove' }}
      </BaseButton>
    </div>
  </BaseModal>
</template>
