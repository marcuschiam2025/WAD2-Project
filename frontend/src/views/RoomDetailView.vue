<script setup>
// One collab room: a sidebar (room, decision, members, invite code, leave) beside the weekly section calendar.
// Everything is live: votes, decisions and members come from the backend through the rooms store.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomsStore } from '@core/stores/rooms'
import { moduleName } from '@core/data/catalogue'
import { inviteLink } from '@core/utils/roomInvite'
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
// Which invite was just copied, 'code' or 'link'
const copied = ref(''), copyFailed = ref(''), error = ref(''), leaving = ref(false), confirmLeave = ref(false)
const link = computed(() => (room.value ? inviteLink(room.value.inviteCode) : ''))

// Alone in the room there is nothing to vote on yet, so the page is just the invite. It checks for new members here
// because the voting panel, which normally refreshes the room, isn't on the page. A locked room keeps its normal page,
// so the party admin can still reach the unlock button.
const alone = computed(() => room.value?.members.length === 1 && !room.value.locked)
let aloneTimer
function checkForFriends(on) {
  clearInterval(aloneTimer)
  if (!on) return
  rooms.loadVotes(room.value.id, { quiet: true })
  aloneTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && room.value && !rooms.busy) rooms.loadVotes(room.value.id, { quiet: true })
  }, 5000)
}
watch(alone, checkForFriends)
onMounted(() => checkForFriends(alone.value))
onBeforeUnmount(() => clearInterval(aloneTimer))

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

async function copy(which) {
  const text = which === 'link' ? link.value : room.value.inviteCode
  let ok = false
  try {
    await navigator.clipboard.writeText(text)
    ok = true
  } catch {
    ok = copyWithFallback(text)
  }
  copied.value = ok ? which : ''
  copyFailed.value = ok ? '' : which
  setTimeout(() => (copied.value = copyFailed.value = ''), 2000)
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

    <main class="flex flex-col gap-4 px-5 md:px-8 lg:px-16 pt-8 pb-12">
      <section v-if="!room" class="card flex flex-col items-start gap-3 p-5">
        <p class="text-[14px]">This room is unavailable, or you are no longer a member.</p>
        <BaseButton variant="outline" @click="rooms.load">Refresh rooms</BaseButton>
      </section>

      <!-- Just you so far: all this page needs is the way to invite people -->
      <section v-else-if="alone" v-enter class="card mx-auto flex w-full max-w-[520px] flex-col gap-6 p-6 sm:p-8"> <!-- motion: fade + slide up on mount -->
        <div class="flex flex-col gap-1.5 text-center leading-normal">
          <h2 class="text-h3">Invite your friends</h2>
          <p class="text-[14px] text-muted-foreground">Voting on {{ room.module }} opens as soon as someone joins.</p>
        </div>
        <div class="flex flex-col gap-2">
          <p class="text-overline text-muted-foreground">Invite code</p>
          <div class="flex items-center gap-2">
            <span class="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-3 text-center font-mono text-[28px] font-bold tracking-[0.2em] select-all">{{ room.inviteCode }}</span>
            <BaseButton variant="outline" @click="copy('code')">{{ copied === 'code' ? 'Copied' : copyFailed === 'code' ? 'Copy failed' : 'Copy' }}</BaseButton>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <p class="text-overline text-muted-foreground">Invite link</p>
          <div class="flex items-center gap-2">
            <span class="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-3 py-[9px] text-[14px] select-all" :title="link">{{ link }}</span>
            <BaseButton variant="outline" @click="copy('link')">{{ copied === 'link' ? 'Copied' : copyFailed === 'link' ? 'Copy failed' : 'Copy' }}</BaseButton>
          </div>
        </div>
        <p v-if="rooms.error" role="alert" class="text-[12px] text-destructive">{{ rooms.error }}</p>
        <BaseButton variant="ghost" class="self-center" @click="confirmLeave = true">Leave room</BaseButton>
      </section>

      <template v-else>
        <div v-enter class="card flex flex-col items-stretch overflow-hidden lg:flex-row"> <!-- motion: fade + slide up on mount -->
          <!-- Room sidebar -->
          <aside class="flex w-full shrink-0 flex-col gap-4 border-b border-border p-5 lg:w-[300px] lg:border-r lg:border-b-0">
            <div class="flex flex-col gap-1.5 leading-normal">
              <h2 class="text-[18px] font-semibold">{{ room.name }}</h2>
              <p class="flex items-center gap-2 text-[13px] text-muted-foreground">
                <span class="shrink-0 rounded-sm bg-secondary px-1.5 py-px font-mono text-[11px] font-bold whitespace-nowrap text-foreground">{{ room.module }}</span>
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
                <BaseButton variant="outline" size="sm" @click="copy('code')">{{ copied === 'code' ? 'Copied' : copyFailed === 'code' ? 'Copy failed' : 'Copy' }}</BaseButton>
              </div>
              <BaseButton v-if="!room.locked" variant="outline" size="sm" @click="copy('link')">{{ copied === 'link' ? 'Copied' : copyFailed === 'link' ? 'Copy failed' : 'Copy invite link' }}</BaseButton>
              <p class="text-[12px] leading-normal text-muted-foreground">
                {{ room.locked ? 'This room is locked, so nobody can join until the party admin unlocks it.' : `Share this code so friends can join, until the room hits ${room.maxMembers} members.` }}
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
              ? 'Your votes are removed. The longest-standing remaining member automatically becomes party admin.'
              : room.locked
                ? 'Your votes are removed. This room is locked, so you can only rejoin after the party admin unlocks it.'
                : 'Your votes are removed. You can rejoin with the room code.'
        }}
      </p>
      <p v-if="room.ownerId === 'me' && room.members.length > 1 && room.locked" class="text-[14px] leading-[22px] text-muted-foreground">The room stays locked. The new party admin can unlock it.</p>
      <p v-if="error" role="alert" class="text-[13px] text-destructive">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <BaseButton variant="ghost" :disabled="leaving" @click="confirmLeave = false">Stay</BaseButton>
        <BaseButton variant="destructive-outline" :disabled="leaving" @click="leave">
          {{ leaving ? 'Leaving…' : 'Leave room' }}
        </BaseButton>
      </div>
    </BaseModal>
  </div>
</template>
