<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomsStore } from '@/stores/rooms'
import PageHeader from '@/components/layout/PageHeader.vue'
import BackButton from '@/components/layout/BackButton.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import RoomInviteCard from '@/components/rooms/RoomInviteCard.vue'
import RoomMembersCard from '@/components/rooms/RoomMembersCard.vue'
import RoomSlotPicker from '@/components/rooms/RoomSlotPicker.vue'
import ImportPlansModal from '@/components/modals/ImportPlansModal.vue'
import iconDownload from '@/assets/figma/download-white.svg'

const route = useRoute()
const router = useRouter()
const rooms = useRoomsStore()

const room = computed(() => rooms.getRoom(route.params.id))
if (!room.value) router.replace('/rooms')

const picks = ref([...(rooms.myVotes[route.params.id] ?? [])])
const importing = ref(false)
const imported = computed(() => rooms.importedPlans[route.params.id] ?? [])

function choose() {
  rooms.setMyVotes(room.value.id, picks.value)
  router.push(`/rooms/${room.value.id}/votes`)
}

function leave() {
  if (!window.confirm(`Leave ${room.value.name}?`)) return
  rooms.leaveRoom(room.value.id)
  router.push('/rooms')
}

function applyImport(planIds) {
  rooms.importPlans(room.value.id, planIds)
  importing.value = false
}
</script>

<template>
  <div v-if="room">
    <PageHeader :overline="`COLLAB ROOMS / ROOM #${room.id}`" :title="room.name">
      <template #leading><BackButton to="/rooms" /></template>
      <template #actions>
        <BaseButton variant="ghost" @click="leave">Leave room</BaseButton>
        <BaseButton @click="importing = true">
          <img :src="iconDownload" alt="" class="size-4" /> Import my plan
        </BaseButton>
      </template>
    </PageHeader>

    <main class="flex flex-col gap-6 px-16 pt-8 pb-16">
      <div class="flex items-start gap-6">
        <RoomInviteCard :room="room" class="flex-1" />
        <RoomMembersCard
          :room="room"
          :footer="imported.length ? `You shared ${imported.length} plan${imported.length > 1 ? 's' : ''} with this room.` : ''"
        />
      </div>

      <section class="card flex flex-col gap-4 p-5">
        <div class="flex items-center gap-4">
          <div class="flex flex-1 flex-col gap-0.5">
            <h2 class="text-h4">Modules for bid</h2>
            <p class="text-small text-muted-foreground">
              Pick the session slots you’d like to take for this module. You can choose more than one option.
            </p>
          </div>
          <div class="flex items-center gap-3.5 text-[12px] text-muted-foreground">
            <span class="flex items-center gap-1.5"><span class="size-3.5 rounded-sm bg-primary" /> Selected slot</span>
            <span class="flex items-center gap-1.5"><span class="size-3.5 rounded-sm bg-muted" /> Available slot</span>
          </div>
        </div>
        <RoomSlotPicker v-model="picks" :module="room.module" />
        <div class="flex items-center gap-3">
          <BaseButton :disabled="!picks.length" class="h-auto! py-2.5 text-[13px] font-normal!" @click="choose">Choose</BaseButton>
          <p class="text-small text-muted-foreground">
            You can choose more than one slot. The results will be shown on the next page.
          </p>
        </div>
      </section>
    </main>

    <ImportPlansModal
      v-if="importing"
      :room-name="room.name"
      :initial="imported"
      @close="importing = false"
      @apply="applyImport"
    />
  </div>
</template>
