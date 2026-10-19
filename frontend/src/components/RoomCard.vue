<script setup>
import { computed } from 'vue'
import { useRoomsStore } from '@backend/stores/rooms'
import UserAvatar from './ui/UserAvatar.vue'

const props = defineProps({ room: { type: Object, required: true } })
const rooms = useRoomsStore()
const shown = computed(() => props.room.members.slice(0, 3).map(rooms.person))
</script>

<template>
  <RouterLink
    :to="`/rooms/${room.id}`"
    class="flex flex-col gap-3.5 rounded-lg border border-border bg-card p-5 drop-shadow-[0_1px_1px_rgba(20,20,24,0.05)] transition-colors hover:border-primary"
  >
    <p class="text-[11px] font-medium tracking-[0.44px] text-muted-foreground">ROOM #{{ room.id }}</p>
    <p class="text-[16px] font-semibold">{{ room.name }}</p>
    <p class="text-[13px] text-muted-foreground">{{ room.description }}</p>
    <div class="flex items-center justify-between">
      <div class="flex gap-1">
        <UserAvatar v-for="m in shown" :key="m.id" :initials="m.initials" />
      </div>
      <span class="font-mono text-[11px] font-medium text-muted-foreground">
        {{ room.members.length }} / {{ room.maxMembers }} members
      </span>
    </div>
  </RouterLink>
</template>
