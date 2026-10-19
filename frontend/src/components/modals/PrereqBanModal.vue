<script setup>
// Overlay / Prerequisite Ban
import { moduleName } from '@backend/data/catalogue'
import AlertModal from './AlertModal.vue'
import NoticeRow from './NoticeRow.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import iconAlert from '@/assets/figma/alert-12.svg'

defineProps({
  person: { type: Object, required: true },
  module: { type: String, required: true },
  prereq: { type: Object, required: true }, // { code, name }
})
const emit = defineEmits(['close', 'ban'])
</script>

<template>
  <AlertModal :title="`${person.name} cannot join this room`" @close="emit('close')">
    <div class="flex items-center gap-3">
      <UserAvatar :initials="person.initials" :size="32" />
      <div class="flex flex-col gap-0.5 leading-normal">
        <p class="text-[14px] font-medium">{{ person.name }}</p>
        <p class="text-[13px] text-muted-foreground">Missing a required prerequisite for this room</p>
      </div>
    </div>
    <NoticeRow label="Prerequisite warning">
      {{ person.name }} has not completed {{ prereq.code }} {{ prereq.name }}, a prerequisite for
      {{ module }} {{ moduleName(module) }}.
    </NoticeRow>
    <div class="flex flex-col items-start gap-2">
      <p class="text-overline text-muted-foreground">Affected module</p>
      <span class="flex items-center gap-2 rounded-sm border border-warning bg-warning/14 px-2.5 py-1.5 text-[13px] text-warning">
        <img :src="iconAlert" alt="" class="size-3" />
        <span><span class="font-mono font-bold">{{ module }}</span> {{ moduleName(module) }}</span>
      </span>
    </div>
    <template #actions>
      <BaseButton variant="ghost" @click="emit('close')">Cancel</BaseButton>
      <BaseButton @click="emit('ban')">Ban from room</BaseButton>
    </template>
  </AlertModal>
</template>
