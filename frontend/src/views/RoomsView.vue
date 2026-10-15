<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomsStore } from '@backend/stores/rooms'
import { useUserStore } from '@backend/stores/user'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import RoomCard from '@/components/RoomCard.vue'
import iconPlus from '@/assets/figma/plus-white.svg'

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
</script>

<template>
  <div>
    <PageHeader overline="COLLABORATIVE PLAN ROOMS · AY24/25 SEM 2" title="Collab Rooms">
      <template #actions>
        <BaseButton variant="outline" @click="joining = true">Join with link</BaseButton>
        <BaseButton to="/rooms/new"><img :src="iconPlus" alt="" class="size-4" /> Create room</BaseButton>
      </template>
    </PageHeader>

    <main class="flex flex-col gap-6 px-16 pt-8 pb-16">
      <div class="flex flex-col gap-1">
        <h2 class="text-h3">Welcome back, {{ user.profile.firstName }} — here are your rooms.</h2>
        <p class="text-small text-muted-foreground">
          Plan the incoming semester with friends: import your What-If plans, see who is taking the same modules, and
          line up bids together.
        </p>
      </div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(320px,410px))] gap-5">
        <RoomCard v-for="room in rooms.rooms" :key="room.id" :room="room" />
      </div>
      <p v-if="!rooms.rooms.length" class="text-small text-muted-foreground">
        You're not in any rooms yet. Create one or join with an invite link.
      </p>
    </main>

    <BaseModal v-if="joining" width="w-[440px]" @close="joining = false">
      <h2 class="text-h4">Join a room</h2>
      <label class="flex flex-col gap-1.5">
        <span class="text-[13px] font-medium">Invite link or room code</span>
        <input
          v-model="joinInput"
          placeholder="https://bidmaxxer.app/room/A1F3-yappers"
          class="rounded-md border border-border px-3 py-[9px] text-[14px] outline-none focus:border-primary"
          @input="joinError = ''"
          @keyup.enter="join"
        />
        <span v-if="joinError" class="text-[12px] text-destructive">{{ joinError }}</span>
      </label>
      <div class="flex justify-end gap-2.5">
        <BaseButton variant="ghost" @click="joining = false">Cancel</BaseButton>
        <BaseButton :disabled="!joinInput.trim()" @click="join">Join</BaseButton>
      </div>
    </BaseModal>
  </div>
</template>
