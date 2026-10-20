<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomsStore, roleOf, canKick, canSetAdmin } from '@core/stores/rooms'
import { moduleName } from '@core/data/catalogue'
import { sections } from '@core/data/bidding'
import { popEnter, popLeave } from '@/motion'
import PageHeader from '@/components/layout/PageHeader.vue'
import BackButton from '@/components/layout/BackButton.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import RoomDecision from '@/components/rooms/RoomDecision.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import RoomSlotPicker from '@/components/rooms/RoomSlotPicker.vue'

const route = useRoute()
const router = useRouter()
const rooms = useRoomsStore()

const room = computed(() => rooms.getRoom(route.params.id))
if (!room.value) router.replace('/rooms')

const picks = ref([...(rooms.myVotes[route.params.id] ?? [])])
// Once submitted, the picks stay selected and locked until you unselect them
const submitted = computed(() => (rooms.myVotes[route.params.id] ?? []).length > 0)

// Once you have voted you can see who voted for each section
const voterMap = computed(() =>
  Object.fromEntries(
    sections.filter((s) => s.module === room.value.module).map((s) => [s.id, rooms.votersOf(room.value, s.id).map(rooms.person)]),
  ),
)
const copied = ref(false)

// TODO(backend): members, roles and vote status come from GET /api/rooms/:id/members
const ORDER = { owner: 0, admin: 1, member: 2 }
const roleLabel = { owner: 'Owner', admin: 'Admin' }
const members = computed(() =>
  room.value.members
    .map((id) => {
      const person = rooms.person(id)
      const voted = id === 'me' ? false : Object.values(room.value.votes).some((v) => v.includes(id))
      const status = id === 'me' ? (submitted.value ? 'Voted' : 'Picking…') : voted ? 'Voted' : 'Not yet'
      return {
        ...person,
        status,
        role: roleOf(room.value, id),
        canKick: canKick(room.value, 'me', id),
        canAdmin: canSetAdmin(room.value, 'me', id),
      }
    })
    .sort((a, b) => ORDER[a.role] - ORDER[b.role]),
)
const myRole = computed(() => roleOf(room.value, 'me'))

// The ⋯ menu on a member row, and the confirmation before removing someone
const menuFor = ref(null)
const kicking = ref(null)
const closeMenu = () => (menuFor.value = null)
onMounted(() => document.addEventListener('click', closeMenu))
onBeforeUnmount(() => document.removeEventListener('click', closeMenu))

function toggleAdmin(m) {
  rooms.setAdmin(room.value.id, m.id, m.role !== 'admin')
  menuFor.value = null
}

function askKick(m) {
  kicking.value = m
  menuFor.value = null
}

function confirmKick() {
  rooms.kickMember(room.value.id, kicking.value.id)
  kicking.value = null
}

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
  rooms.setMyVotes(room.value.id, [...picks.value])
  router.push(`/rooms/${room.value.id}/votes`)
}

function unselect() {
  rooms.clearMyVotes(room.value.id)
  picks.value = []
}

function leave() {
  if (!window.confirm(`Leave ${room.value.name}?`)) return
  rooms.leaveRoom(room.value.id)
  router.push('/rooms')
}
</script>

<template>
  <div v-if="room">
    <PageHeader :overline="`Collab rooms / room #${room.id}`" :title="room.name">
      <template #leading><BackButton to="/rooms" /></template>
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

          <RoomDecision :room-id="room.id" />

          <div class="flex flex-col gap-2.5">
            <p class="text-overline text-muted-foreground">Members · {{ room.members.length }} of {{ room.maxMembers }}</p>
            <ul class="flex flex-col gap-2.5">
              <li v-for="m in members" :key="m.id" class="relative flex items-center gap-2.5 text-[14px]">
                <UserAvatar :initials="m.initials" :size="24" :you="m.you" />
                <div class="flex min-w-0 flex-1 flex-col leading-normal">
                  <span class="flex items-center gap-1.5">
                    <span class="truncate">{{ m.short }}</span>
                    <span
                      v-if="m.role !== 'member'"
                      class="shrink-0 rounded-sm border px-1.5 text-[10.5px] font-semibold"
                      :class="m.role === 'owner' ? 'border-primary bg-primary-tint text-primary' : 'border-border bg-secondary text-muted-foreground'"
                    >{{ roleLabel[m.role] }}</span>
                  </span>
                  <span
                    class="text-[12px]"
                    :class="m.status === 'Voted' ? 'font-medium text-success' : 'text-muted-foreground'"
                  >{{ m.status === 'Voted' ? '✓ Voted' : m.status }}</span>
                </div>
                <button
                  v-if="m.canKick || m.canAdmin"
                  type="button"
                  :aria-label="`Manage ${m.short}`"
                  :aria-expanded="menuFor === m.id"
                  class="rounded-sm px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  @click.stop="menuFor = menuFor === m.id ? null : m.id"
                >···</button>
                <Transition :css="false" @enter="popEnter" @leave="popLeave">
                  <div
                    v-if="menuFor === m.id"
                    class="absolute top-full right-0 z-20 mt-1 flex w-44 flex-col rounded-lg border border-border bg-card p-1.5 shadow-md"
                    @click.stop
                  >
                    <button
                      v-if="m.canAdmin"
                      type="button"
                      class="rounded-sm px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-muted"
                      @click="toggleAdmin(m)"
                    >{{ m.role === 'admin' ? 'Remove as admin' : 'Make admin' }}</button>
                    <button
                      v-if="m.canKick"
                      type="button"
                      class="rounded-sm px-2.5 py-2 text-left text-[13px] text-destructive transition-colors hover:bg-destructive-tint"
                      @click="askKick(m)"
                    >Remove from room</button>
                  </div>
                </Transition>
              </li>
            </ul>
            <p v-if="myRole !== 'member'" class="text-[12px] leading-normal text-muted-foreground">
              {{ myRole === 'owner' ? "You're the owner: you can make admins and remove anyone." : "You're an admin: you can remove members." }}
            </p>
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
              <p class="text-[13px] text-muted-foreground">
                {{ submitted ? "You've submitted these picks. Unselect them if you want to change your votes." : "Pick every section you'd take. You can choose more than one." }}
              </p>
            </div>
            <BaseButton v-if="submitted" variant="outline" @click="unselect">Unselect my picks</BaseButton>
            <BaseButton v-else :disabled="!picks.length" @click="submit">Submit my picks</BaseButton>
          </div>
          <RoomSlotPicker v-model="picks" :module="room.module" :readonly="submitted" :voters="submitted ? voterMap : null" />
          <div class="flex items-center gap-5 text-[12px] text-muted-foreground">
            <span class="flex items-center gap-1.5"><span class="h-3 w-[18px] rounded-sm bg-primary" /> Selected slot</span>
            <span class="flex items-center gap-1.5"><span class="h-3 w-[18px] rounded-sm border border-dashed border-border" /> Available slot</span>
          </div>
        </section>
      </div>
    </main>

    <BaseModal v-if="kicking" width="w-[400px]" @close="kicking = null">
      <h2 class="text-h4">Remove {{ kicking.name }} from {{ room.name }}?</h2>
      <p class="text-[14px] leading-[22px] text-muted-foreground">
        They lose access to this room, and their votes and suggested bids are removed. They can rejoin with the invite link.
      </p>
      <div class="flex justify-end gap-2">
        <BaseButton variant="ghost" @click="kicking = null">Cancel</BaseButton>
        <BaseButton variant="destructive-outline" @click="confirmKick">Remove</BaseButton>
      </div>
    </BaseModal>
  </div>
</template>
