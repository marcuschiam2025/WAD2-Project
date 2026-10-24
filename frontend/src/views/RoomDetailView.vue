<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomsStore } from '@core/stores/rooms'
import { moduleName } from '@core/data/catalogue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import RoomVotingPanel from '@/components/rooms/RoomVotingPanel.vue'
import RoomMembers from '@/components/rooms/RoomMembers.vue'
import RoomBidHistory from '@/components/rooms/RoomBidHistory.vue'
const rooms = useRoomsStore(), route = useRoute(), router = useRouter()
const room = computed(() => rooms.getRoom(route.params.id))
const copied = ref(false), error = ref(''), leaving = ref(false), confirmLeave = ref(false)
async function copy() {
  error.value = ''
  try { await navigator.clipboard.writeText(room.value.inviteCode); copied.value = true }
  catch { error.value = 'Could not copy automatically. Select the invite code and copy it.' }
}
async function leave() {
  leaving.value = true; error.value = ''
  try { await rooms.leaveRoom(room.value.id); confirmLeave.value = false; router.push('/rooms') }
  catch (failure) { error.value = failure.message }
  finally { leaving.value = false }
}
</script>
<template>
  <div>
    <PageHeader overline="Collab Rooms" :title="room?.name || 'Room unavailable'"><template #actions><BaseButton variant="outline" to="/rooms">All rooms</BaseButton></template></PageHeader>
    <main class="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8">
      <section v-if="!room" class="card p-5"><p>This room is unavailable, or you are no longer a member.</p><BaseButton class="mt-3" variant="outline" @click="rooms.load">Refresh rooms</BaseButton></section>
      <template v-else>
        <section class="card flex flex-col gap-4 p-5">
          <h2 class="text-lg font-semibold">{{ room.module }} · {{ moduleName(room.module) }}</h2><p v-if="room.description" class="text-sm text-muted-foreground">{{ room.description }}</p>
          <div class="flex flex-wrap items-center gap-3"><span class="text-sm">Invite code</span><strong class="select-all rounded-md bg-muted px-4 py-2 font-mono text-lg tracking-widest">{{ room.inviteCode }}</strong><BaseButton variant="outline" @click="copy">{{ copied ? 'Copied' : 'Copy code' }}</BaseButton></div>
          <p class="text-xs text-muted-foreground">Share this code so friends can join.</p>
        </section>
        <RoomVotingPanel :room-id="room.id" />
        <div class="grid items-start gap-5 lg:grid-cols-2"><RoomMembers :room-id="room.id" /><RoomBidHistory :module="room.module" /></div>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <p v-if="rooms.error" role="alert" class="text-sm text-destructive">{{ rooms.error }}</p>
        <BaseButton variant="outline" :disabled="leaving" @click="confirmLeave = true">{{ leaving ? 'Leaving…' : 'Leave room' }}</BaseButton>
      </template>
    </main>
    <BaseModal v-if="confirmLeave && room" width="w-[440px]" @close="!leaving && (confirmLeave = false)">
      <h2 class="text-lg font-semibold">Leave {{ room.name }}?</h2>
      <p class="text-sm">{{ room.members.length === 1 ? 'You are the last member. Leaving will delete this room and its votes.' : room.ownerId === 'me' ? 'Transfer party admin to another member in the Members section before leaving.' : 'Your votes will be removed and the room decision will reopen. You can rejoin using the invite code.' }}</p>
      <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
      <div class="flex justify-end gap-2"><BaseButton variant="ghost" :disabled="leaving" @click="confirmLeave = false">Cancel</BaseButton><BaseButton :disabled="leaving || (room.ownerId === 'me' && room.members.length > 1)" @click="leave">{{ leaving ? 'Leaving…' : 'Leave room' }}</BaseButton></div>
    </BaseModal>
  </div>
</template>
