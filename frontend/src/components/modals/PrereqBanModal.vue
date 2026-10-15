<script setup>
import { moduleName } from '@backend/data/catalogue'
import AlertModal from './AlertModal.vue'
import NoticeRow from './NoticeRow.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import ModuleChip from '@/components/ModuleChip.vue'

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
      <div class="flex flex-col gap-0.5">
        <p class="text-body">{{ person.name }}</p>
        <p class="text-small text-muted-foreground">Missing required prerequisite for this room</p>
      </div>
    </div>
    <NoticeRow label="PREREQUISITE WARNING">
      {{ person.name }} has not completed {{ prereq.code }} {{ prereq.name }}, a required prerequisite for
      {{ module }} {{ moduleName(module) }}.
    </NoticeRow>
    <div class="flex flex-col items-start gap-2">
      <p class="text-overline text-muted-foreground">AFFECTED MODULE</p>
      <ModuleChip state="warning" class="text-[13px]!">
        <span><span class="font-bold">{{ module }}</span> {{ moduleName(module) }}</span>
      </ModuleChip>
    </div>
    <template #actions>
      <BaseButton variant="ghost" @click="emit('close')">Cancel</BaseButton>
      <BaseButton @click="emit('ban')">Ban from room</BaseButton>
    </template>
  </AlertModal>
</template>
