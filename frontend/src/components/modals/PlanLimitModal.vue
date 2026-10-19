<script setup>
import { MAX_PLANS } from '@/stores/planner'
import AlertModal from './AlertModal.vue'
import NoticeRow from './NoticeRow.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const emit = defineEmits(['close', 'go-to-plans'])
</script>

<template>
  <AlertModal :title="`You already have ${MAX_PLANS} plans`" @close="emit('close')">
    <p class="text-small text-muted-foreground">
      You can create up to {{ MAX_PLANS }} plans. To create another plan, delete one of your existing plans first.
    </p>
    <NoticeRow label="PLAN LIMIT">
      Delete one of your {{ MAX_PLANS }} existing plans before you can create a new one.
    </NoticeRow>
    <NoticeRow label="NEXT STEPS" tone="info">
      Go to My plans, delete one plan, then come back to create a new one.
    </NoticeRow>
    <template #actions>
      <BaseButton variant="ghost" @click="emit('close')">Cancel</BaseButton>
      <BaseButton @click="emit('go-to-plans')">Go to My plans</BaseButton>
    </template>
  </AlertModal>
</template>
