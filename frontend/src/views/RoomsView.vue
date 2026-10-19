<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomsStore } from '@core/stores/rooms'
import { useUserStore } from '@core/stores/user'
import { moduleName } from '@core/data/catalogue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'

const router = useRouter()
const rooms = useRoomsStore()
const user = useUserStore()

const joining = ref(false)
const joinInput = ref('')
const joinError = ref('')

// Accepts a full invite link (…/room/A1F3-yappers) or just the room code
function join() {
  const code = joinInput.value.trim().split('/').pop().split('-')[0].replace('#', '').toUpperCase()
  if (rooms.getRoom(code)) {
    joining.value = false
    router.push(`/rooms/${code}`)
  } else {
    joinError.value = 'No room found for that link or code.'
  }
}

// TODO(backend): votes / status / round come from GET /api/rooms (the sample derives them from room.votes)
function summary(room) {
  const voted = new Set(Object.values(room.votes).flat())
  const count = room.finalised ? room.members.length : voted.size + (rooms.myVotes[room.id]?.length ? 1 : 0)
  const total = room.members.length
  const status = room.finalised ? 'finalised' : count === 0 ? 'not-started' : 'voting'
  return { count, total, status }
}
const statusTone = { voting: 'warning', finalised: 'success', 'not-started': 'neutral' }
const statusLabel = { voting: 'Voting', finalised: 'Finalised', 'not-started': 'Not started' }
const roundCloses = (i) => (i === 2 ? { text: '2 · 6 days' } : { text: '1A · 2h 15m', urgent: i === 0 })
</script>

<template>
  <div>
    <PageHeader overline="Collaborative plan rooms · AY24/25 Sem 2" title="Collab Rooms">
      <template #actions>
        <BaseButton variant="outline" @click="joining = true">Join with link</BaseButton>
        <BaseButton to="/rooms/new">Create room</BaseButton>
      </template>
    </PageHeader>

    <main class="flex flex-col gap-4 px-16 pt-8 pb-12">
      <div class="flex flex-col gap-0.5">
        <h2 class="text-h3">Welcome back, {{ user.profile.firstName }}. Here are your rooms.</h2>
        <p class="text-[14px] text-muted-foreground">
          Plan the incoming semester with friends: import your What-If plans, see who is taking the same modules, and line
          up bids together.
        </p>
      </div>

      <section v-enter class="card overflow-hidden"> <!-- motion: fade + slide up on mount -->
        <div class="grid grid-cols-[minmax(0,2.6fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_40px] bg-muted text-overline text-muted-foreground">
          <span class="px-5 py-3">Room</span>
          <span class="px-2 py-3">Members</span>
          <span class="px-2 py-3">Votes</span>
          <span class="px-2 py-3">Status</span>
          <span class="px-2 py-3">Round closes</span>
          <span />
        </div>
        <ul v-stagger="0.08"> <!-- motion: room rows stagger in 80ms apart -->
          <li v-for="(room, i) in rooms.rooms" :key="room.id" class="border-t border-border">
            <RouterLink
              :to="`/rooms/${room.id}`"
              class="grid grid-cols-[minmax(0,2.6fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_40px] items-center transition-colors hover:bg-muted/60"
            >
              <div class="flex flex-col gap-1.5 px-5 py-4 leading-normal">
                <span class="text-[15px] font-semibold">{{ room.name }}</span>
                <span class="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <span class="rounded-sm bg-secondary px-1.5 py-px font-mono text-[11px] font-bold text-foreground">{{ room.module }}</span>
                  {{ moduleName(room.module) }}
                </span>
              </div>
              <div class="flex px-2 py-4">
                <UserAvatar
                  v-for="(id, mi) in room.members.slice(0, 4)"
                  :key="id"
                  :initials="rooms.person(id).initials"
                  :you="rooms.person(id).you"
                  :class="mi > 0 && '-ml-1 ring-2 ring-card'"
                />
              </div>
              <div class="flex flex-col gap-1.5 px-2 py-4">
                <span class="text-[13px] text-muted-foreground">{{ summary(room).count }} of {{ summary(room).total }} voted</span>
                <ProgressBar
                  :value="summary(room).count / summary(room).total"
                  :color="summary(room).status === 'finalised' ? 'bg-success' : 'bg-primary'"
                  track="h-1.5 w-[180px]"
                />
              </div>
              <div class="px-2 py-4">
                <StatusPill :tone="statusTone[summary(room).status]">{{ statusLabel[summary(room).status] }}</StatusPill>
              </div>
              <span
                class="px-2 py-4 font-mono text-[12.5px] font-medium"
                :class="roundCloses(i).urgent ? 'text-destructive' : 'text-muted-foreground'"
              >{{ roundCloses(i).text }}</span>
              <span class="px-2 py-4 text-center text-muted-foreground">···</span>
            </RouterLink>
          </li>
        </ul>
        <p v-if="!rooms.rooms.length" class="border-t border-border px-5 py-6 text-[13px] text-muted-foreground">
          You're not in any rooms yet. Create one or join with an invite link.
        </p>
      </section>
    </main>

    <BaseModal v-if="joining" width="w-[440px]" @close="joining = false">
      <h2 class="text-h4">Join a room</h2>
      <label class="flex flex-col gap-1.5">
        <span class="text-[13px] font-medium">Invite link or room code</span>
        <input
          v-model="joinInput"
          placeholder="https://bidmaxxer.app/room/A1F3-yappers"
          class="rounded-md border border-border px-3 py-[9px] text-[14px] outline-none focus:border-ring"
          @input="joinError = ''"
          @keyup.enter="join"
        />
        <span v-if="joinError" class="text-[12px] text-destructive">{{ joinError }}</span>
      </label>
      <div class="flex justify-end gap-2">
        <BaseButton variant="ghost" @click="joining = false">Cancel</BaseButton>
        <BaseButton :disabled="!joinInput.trim()" @click="join">Join</BaseButton>
      </div>
    </BaseModal>
  </div>
</template>
