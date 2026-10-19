<script setup>
import { computed } from 'vue'
import { useRoomsStore } from '@backend/stores/rooms'
import UserAvatar from '@/components/ui/UserAvatar.vue'

const props = defineProps({
  room: { type: Object, required: true },
  footer: { type: String, default: '' },
})
const rooms = useRoomsStore()
const members = computed(() => props.room.members.map(rooms.person))
</script>

<template>
  <section class="card flex w-[420px] shrink-0 flex-col gap-2.5 self-stretch p-5">
    <div class="flex items-center justify-between">
      <h2 class="text-h4">Members</h2>
      <span class="font-mono text-[13px] text-muted-foreground">{{ room.members.length }} / {{ room.maxMembers }}</span>
    </div>
    <div class="flex flex-wrap gap-x-3.5 gap-y-2">
      <div v-for="m in members" :key="m.id" class="flex items-center gap-1.5">
        <UserAvatar :initials="m.initials" :you="m.you" />
        <span class="text-[13px] font-medium">{{ m.short }}</span>
      </div>
    </div>
    <p v-if="footer" class="text-small text-muted-foreground">{{ footer }}</p>
  </section>
</template>
