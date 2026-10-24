<script setup>
// One collab room: a sidebar (room, decision, members, invite code, leave) beside the weekly section calendar.
// Everything is live: votes, decisions and members come from the backend through the rooms store.
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomsStore } from '@core/stores/rooms'
import { moduleName } from '@core/data/catalogue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BackButton from '@/components/layout/BackButton.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import RoomVotingPanel from '@/components/rooms/RoomVotingPanel.vue'
import RoomResults from '@/components/rooms/RoomResults.vue'
import RoomMembers from '@/components/rooms/RoomMembers.vue'
import RoomBidHistory from '@/components/rooms/RoomBidHistory.vue'
import RoomBidSimulator from '@/components/rooms/RoomBidSimulator.vue'

const rooms = useRoomsStore()
const route = useRoute()
const router = useRouter()
const room = computed(() => rooms.getRoom(route.params.id))
// Unsaved picks on the calendar: the decision panel won't confirm a result until they are submitted
const dirty = ref(false)
const copied = ref(false), copyFailed = ref(false), error = ref(''), leaving = ref(false), confirmLeave = ref(false)

// The async clipboard API is refused in some contexts (embedded previews, no permission), so fall back to a
// temporary text box and the older copy command before giving up.
function copyWithFallback(text) {
  const box = document.createElement('textarea')
  box.value = text
  box.setAttribute('readonly', '')
  box.style.position = 'fixed'
  box.style.opacity = '0'
  document.body.appendChild(box)
  box.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(box)
  return ok
}

async function copy() {
  const text = room.value.inviteCode
  let ok = false
  try {
    await navigator.clipboard.writeText(text)
    ok = true
  } catch {
    ok = copyWithFallback(text)
  }
  copied.value = ok
  copyFailed.value = !ok
  setTimeout(() => (copied.value = copyFailed.value = false), 2000)
}

async function leave() {
  leaving.value = true
  error.value = ''
  try {
    await rooms.leaveRoom(room.value.id)
    confirmLeave.value = false
    router.push('/rooms')
  } catch (failure) {
    error.value = failure.message
  } finally {
    leaving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :overline="room ? `Collab rooms / room #${room.inviteCode}` : 'Collab rooms'" :title="room?.name || 'Room unavailable'">
      <template #leading><BackButton to="/rooms" /></template>
    </PageHeader>

    <main class="flex flex-col gap-4 px-16 pt-8 pb-12">
      <section v-if="!room" class="card flex flex-col items-start gap-3 p-5">
        <p class="text-[14px]">This room is unavailable, or you are no longer a member.</p>
        <BaseButton variant="outline" @click="rooms.load">Refresh rooms</BaseButton>
      </section>

      <template v-else>
        <div v-enter class="card flex items-stretch overflow-hidden"> <!-- motion: fade + slide up on mount -->
          <!-- Room sidebar -->
          <aside class="flex w-[300px] shrink-0 flex-col gap-4 border-r border-border p-5">
            <div class="flex flex-col gap-1.5 leading-normal">
              <h2 class="text-[18px] font-semibold">{{ room.name }}</h2>
              <p class="flex items-center gap-2 text-[13px] text-muted-foreground">
                <span class="rounded-sm bg-secondary px-1.5 py-px font-mono text-[11px] font-bold text-foreground">{{ room.module }}</span>
                {{ moduleName(room.module) }}
              </p>
              <p v-if="room.description" class="text-[13px] text-muted-foreground">{{ room.description }}</p>
            </div>

            <RoomResults :room-id="room.id" :dirty="dirty" />

            <RoomMembers :room-id="room.id" />

            <div class="flex flex-col gap-2">
              <p class="text-overline text-muted-foreground">Room code</p>
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-[6px] text-center font-mono text-[18px] font-bold tracking-[0.2em] select-all">{{ room.inviteCode }}</span>
                <BaseButton variant="outline" size="sm" @click="copy">{{ copied ? 'Copied' : copyFailed ? 'Copy failed' : 'Copy' }}</BaseButton>
              </div>
              <p class="text-[12px] leading-normal text-muted-foreground">
                Share this code so friends can join, until the room hits {{ room.maxMembers }} members.
              </p>
            </div>

            <p v-if="rooms.error" role="alert" class="text-[12px] text-destructive">{{ rooms.error }}</p>
            <BaseButton variant="ghost" class="self-start" @click="confirmLeave = true">Leave room</BaseButton>
          </aside>

          <!-- Weekly section calendar -->
          <RoomVotingPanel v-model:dirty="dirty" :room-id="room.id" :module="room.module" />
        </div>

        <!-- Try a bid against real BOSS results for the module -->
        <div class="grid items-start gap-4 lg:grid-cols-2">
          <RoomBidSimulator :module="room.module" :term="room.term" />
          <RoomBidHistory :module="room.module" />
        </div>
      </template>
    </main>

    <BaseModal v-if="confirmLeave && room" width="w-[440px]" @close="!leaving && (confirmLeave = false)">
      <h2 class="text-h4">Leave {{ room.name }}?</h2>
      <p class="text-[14px] leading-[22px] text-muted-foreground">
        {{
          room.members.length === 1
            ? 'You are the last member. Leaving deletes this room and its votes.'
            : room.ownerId === 'me'
              ? 'You are the party admin. Make another member party admin (in Members) before leaving.'
              : 'Your votes are removed and the room decision reopens. You can rejoin with the room code.'
        }}
      </p>
      <p v-if="error" role="alert" class="text-[13px] text-destructive">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <BaseButton variant="ghost" :disabled="leaving" @click="confirmLeave = false">Stay</BaseButton>
        <BaseButton variant="destructive-outline" :disabled="leaving || (room.ownerId === 'me' && room.members.length > 1)" @click="leave">
          {{ leaving ? 'Leaving…' : 'Leave room' }}
        </BaseButton>
      </div>
    </BaseModal>
  </div>
</template>
