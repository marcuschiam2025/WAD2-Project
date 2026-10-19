<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomsStore } from '@backend/stores/rooms'
import { moduleName } from '@backend/data/catalogue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BackButton from '@/components/layout/BackButton.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import RoomSlotPicker from '@/components/rooms/RoomSlotPicker.vue'
import ImportPlansModal from '@/components/modals/ImportPlansModal.vue'

const route = useRoute()
const router = useRouter()
const rooms = useRoomsStore()

const room = computed(() => rooms.getRoom(route.params.id))
if (!room.value) router.replace('/rooms')

const picks = ref([...(rooms.myVotes[route.params.id] ?? [])])
const importing = ref(false)
const copied = ref(false)

// TODO(backend): member status comes from GET /api/rooms/:id/members
const members = computed(() =>
  room.value.members.map((id) => {
    const person = rooms.person(id)
    const voted = id === 'me' ? false : Object.values(room.value.votes).some((v) => v.includes(id))
    const status = id === 'me' ? 'Picking…' : voted ? 'Voted' : 'Not yet'
    return { ...person, status }
  }),
)

const link = computed(() => `bidmaxxer.app/room/${room.value.id}`)

async function copy() {
  try {
    await navigator.clipboard.writeText(`https://${link.value}`)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    copied.value = false
  }
}

function submit() {
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
    <PageHeader :overline="`Collab rooms / room #${room.id}`" :title="room.name">
      <template #leading><BackButton to="/rooms" /></template>
      <template #actions>
        <BaseButton variant="outline" @click="importing = true">Import my plan</BaseButton>
      </template>
    </PageHeader>

    <main class="px-16 pt-8 pb-12">
      <div v-enter class="card flex items-stretch overflow-hidden"> <!-- motion: fade + slide up on mount -->
        <!-- Room sidebar -->
        <aside class="flex w-[280px] shrink-0 flex-col gap-4 border-r border-border p-5">
          <div class="flex flex-col gap-1.5 leading-normal">
            <h2 class="text-[18px] font-semibold">{{ room.name }}</h2>
            <p class="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span class="rounded-sm bg-secondary px-1.5 py-px font-mono text-[11px] font-bold text-foreground">{{ room.module }}</span>
              {{ moduleName(room.module) }}
            </p>
          </div>

          <div class="flex flex-col gap-2.5">
            <p class="text-overline text-muted-foreground">Members · {{ room.members.length }} of {{ room.maxMembers }}</p>
            <ul class="flex flex-col gap-2.5">
              <li v-for="m in members" :key="m.id" class="flex items-center gap-2.5 text-[14px]">
                <UserAvatar :initials="m.initials" :size="24" :you="m.you" />
                <span class="flex-1">{{ m.short }}</span>
                <span
                  class="text-[12px]"
                  :class="m.status === 'Voted' ? 'font-medium text-success' : 'text-muted-foreground'"
                >{{ m.status === 'Voted' ? '✓ Voted' : m.status }}</span>
              </li>
            </ul>
          </div>

          <div class="flex flex-col gap-2">
            <p class="text-overline text-muted-foreground">Invite link</p>
            <div class="flex items-center gap-2">
              <span class="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-[7px] font-mono text-[11px] font-medium">{{ link }}</span>
              <BaseButton variant="outline" size="sm" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</BaseButton>
            </div>
            <p class="text-[12px] leading-normal text-muted-foreground">
              Anyone with this link can join until the room hits {{ room.maxMembers }} members.
            </p>
          </div>

          <BaseButton variant="ghost" class="self-start" @click="leave">Leave room</BaseButton>
        </aside>

        <!-- Slot picker -->
        <section class="flex min-w-0 flex-1 flex-col gap-4 p-5">
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-0.5 leading-normal">
              <h2 class="text-h4">Modules for bid · {{ room.module }}</h2>
              <p class="text-[13px] text-muted-foreground">Pick every section you'd take. You can choose more than one.</p>
            </div>
            <BaseButton :disabled="!picks.length" @click="submit">Submit my picks</BaseButton>
          </div>
          <RoomSlotPicker v-model="picks" :module="room.module" />
          <div class="flex items-center gap-5 text-[12px] text-muted-foreground">
            <span class="flex items-center gap-1.5"><span class="h-3 w-[18px] rounded-sm bg-primary" /> Selected slot</span>
            <span class="flex items-center gap-1.5"><span class="h-3 w-[18px] rounded-sm border border-dashed border-border" /> Available slot</span>
          </div>
        </section>
      </div>
    </main>

    <ImportPlansModal
      v-if="importing"
      :room-name="room.name"
      :initial="rooms.importedPlans[room.id] ?? []"
      @close="importing = false"
      @apply="applyImport"
    />
  </div>
</template>
