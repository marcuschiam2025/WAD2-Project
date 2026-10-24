<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomsStore, roleOf } from '@core/stores/rooms'
import { moduleName } from '@core/data/catalogue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import RoomVotingPanel from '@/components/rooms/RoomVotingPanel.vue'
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
    <main class="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-8">
      <section v-if="!room" class="card p-5"><p>This room is unavailable, or you are no longer a member.</p><BaseButton class="mt-3" variant="outline" @click="rooms.load">Refresh rooms</BaseButton></section>
      <template v-else>
        <section class="card flex flex-col gap-4 p-5">
          <h2 class="text-lg font-semibold">{{ room.module }} · {{ moduleName(room.module) }}</h2><p v-if="room.description" class="text-sm text-muted-foreground">{{ room.description }}</p>
          <div class="flex flex-wrap items-center gap-3"><span class="text-sm">Invite code</span><strong class="select-all rounded-md bg-muted px-4 py-2 font-mono text-lg tracking-widest">{{ room.inviteCode }}</strong><BaseButton variant="outline" @click="copy">{{ copied ? 'Copied' : 'Copy code' }}</BaseButton></div>
          <p class="text-xs text-muted-foreground">Share this code with friends who want to join. Room capacity and prerequisite checks are applied by the server.</p>
        </section>
        <section class="card flex flex-col gap-4 p-5"><h2 class="font-semibold">Members · {{ room.members.length }} / {{ room.maxMembers }}</h2><ul class="flex flex-col gap-3"><li v-for="id in room.members" :key="id" class="flex items-center gap-3"><UserAvatar :initials="rooms.person(id).initials" :you="id === 'me'" /><span>{{ rooms.person(id).name }}</span><span v-if="roleOf(room,id) === 'owner'" class="text-xs text-primary">Party admin</span></li></ul><BaseButton variant="outline" :disabled="rooms.loading" @click="rooms.load">Refresh members</BaseButton></section>
        <RoomVotingPanel :room-id="room.id" />
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <p v-if="rooms.error" role="alert" class="text-sm text-destructive">{{ rooms.error }}</p>
        <BaseButton variant="outline" :disabled="leaving" @click="confirmLeave = true">{{ leaving ? 'Leaving…' : 'Leave room' }}</BaseButton>
      </template>
    </main>
    <BaseModal v-if="confirmLeave && room" width="w-[440px]" @close="!leaving && (confirmLeave = false)">
      <h2 class="text-lg font-semibold">Leave {{ room.name }}?</h2>
      <p class="text-sm">{{ room.members.length === 1 ? 'You are the last member. Leaving will delete this room and its votes.' : 'You can rejoin later using the invite code, subject to room capacity and prerequisites.' }}</p>
      <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
      <div class="flex justify-end gap-2"><BaseButton variant="ghost" :disabled="leaving" @click="confirmLeave = false">Cancel</BaseButton><BaseButton :disabled="leaving" @click="leave">{{ leaving ? 'Leaving…' : 'Leave room' }}</BaseButton></div>
    </BaseModal>
  </div>
</template>
