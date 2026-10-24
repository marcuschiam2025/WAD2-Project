<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomsStore } from '@core/stores/rooms'
import { moduleName } from '@core/data/catalogue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
const router = useRouter()
const rooms = useRoomsStore()
const joining = ref(false), joinInput = ref(''), joinError = ref('')
onMounted(() => rooms.load())
async function join() {
  if (!/^[A-Z0-9]{4,8}$/.test(joinInput.value.trim().toUpperCase()) || rooms.busy) return
  joinError.value = ''
  try {
    const id = await rooms.joinRoom(joinInput.value)
    joining.value = false
    router.push(`/rooms/${id}`)
  } catch (failure) { joinError.value = failure.message }
}
</script>
<template>
  <div>
    <PageHeader overline="Collaborative plan rooms" title="Collab Rooms">
      <template #actions><BaseButton variant="outline" @click="joining = true">Join with code</BaseButton><BaseButton to="/rooms/new">Create room</BaseButton></template>
    </PageHeader>
    <main class="flex flex-col gap-4 px-5 py-8 lg:px-16">
      <p class="text-sm text-muted-foreground">Plan a module with friends. Create a room and share its invite code.</p>
      <p v-if="rooms.loading" role="status">Loading your rooms…</p>
      <div v-if="rooms.error && !joining" role="alert" class="card p-4"><p>{{ rooms.error }}</p><BaseButton class="mt-2" variant="outline" @click="rooms.load">Retry</BaseButton></div>
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Your rooms">
        <RouterLink v-for="room in rooms.rooms" :key="room.id" :to="`/rooms/${room.id}`" class="card flex flex-col gap-3 p-5 hover:border-primary">
          <h2 class="text-lg font-semibold">{{ room.name }}</h2>
          <p class="text-sm"><span class="font-mono font-semibold">{{ room.module }}</span> · {{ moduleName(room.module) }}</p>
          <p v-if="room.description" class="text-sm text-muted-foreground">{{ room.description }}</p>
          <div class="flex items-center gap-2"><UserAvatar v-for="id in room.members.slice(0,4)" :key="id" :initials="rooms.person(id).initials" :you="id === 'me'" /><span class="text-xs text-muted-foreground">{{ room.members.length }} / {{ room.maxMembers }} members</span></div>
          <div v-if="room.summary" class="flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2 text-xs"><span class="font-medium">{{ room.summary.status === 'confirmed' ? 'Section confirmed' : room.summary.status === 'ready' ? 'Ready for decision' : 'Voting' }}</span><span>{{ room.summary.votedCount }} / {{ room.summary.memberCount }} voted</span></div>
            <progress class="h-1.5 w-full accent-primary" :value="room.summary.votedCount" :max="room.summary.memberCount || 1" :aria-label="`${room.summary.votedCount} members voted`" />
            <p v-if="room.summary.finalisedSection" class="text-xs text-primary">Chosen section: {{ room.summary.finalisedSection.split(':').at(-1) }}</p>
          </div>
          <p class="text-xs text-muted-foreground">Invite code <span class="font-mono font-semibold">{{ room.inviteCode }}</span></p>
        </RouterLink>
      </section>
      <p v-if="!rooms.loading && !rooms.error && !rooms.rooms.length" class="card p-6 text-sm text-muted-foreground">You're not in any rooms yet. Create one or join with a room code.</p>
    </main>
    <BaseModal v-if="joining" width="w-[440px]" @close="!rooms.busy && (joining = false)">
      <h2 class="text-lg font-semibold">Join a room</h2>
      <form class="flex flex-col gap-4" @submit.prevent="join">
        <label class="flex flex-col gap-2 text-sm">Room invite code<input v-model="joinInput" maxlength="8" placeholder="K7Q2MX" autocomplete="off" :disabled="rooms.busy" class="rounded-md border border-border p-3 uppercase" /></label>
        <p v-if="joinError" role="alert" class="text-sm text-destructive">{{ joinError }}</p>
        <div class="flex justify-end gap-2"><BaseButton variant="ghost" :disabled="rooms.busy" @click="joining = false">Cancel</BaseButton><button type="submit" :disabled="rooms.busy || !/^[A-Z0-9]{4,8}$/i.test(joinInput.trim())" class="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{{ rooms.busy ? 'Joining…' : 'Join' }}</button></div>
      </form>
    </BaseModal>
  </div>
</template>
