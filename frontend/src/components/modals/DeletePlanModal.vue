<script setup>
// Confirmation before a plan is deleted from its tab.
import { usePlannerStore } from '@core/stores/planner';
import BaseModal from '@/components/ui/BaseModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

defineProps({
  planName: { type: String, required: true },
  detail: { type: String, default: 'and everything planned in it' },
});
const emit = defineEmits(['close', 'confirm']);
const planner = usePlannerStore();
</script>

<template>
  <BaseModal width="w-[440px]" @close="!planner.planActionPending && emit('close')">
    <h2 class="text-h3">Delete {{ planName }}?</h2>
    <p class="text-[14px] leading-[22px] text-muted-foreground">
      This permanently removes {{ planName }} {{ detail }}. This cannot be undone.
    </p>
    <p v-if="planner.planActionError" role="alert" class="text-sm text-destructive">
      {{ planner.planActionError }}
    </p>
    <div class="flex justify-end gap-2">
      <BaseButton variant="ghost" :disabled="planner.planActionPending" @click="emit('close')"
        >Cancel</BaseButton
      >
      <BaseButton
        variant="destructive-outline"
        :disabled="planner.planActionPending"
        @click="emit('confirm')"
      >
        {{ planner.planActionPending ? 'Deleting…' : 'Delete plan' }}
      </BaseButton>
    </div>
  </BaseModal>
</template>
