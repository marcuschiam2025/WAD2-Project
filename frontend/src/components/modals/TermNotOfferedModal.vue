<script setup>
// Overlay / Term Not Offered: shown when a module is dropped into a semester of a term it is not taught in.
// The drop was refused; the student can send it to the next semester that does offer it.
import AlertModal from './AlertModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

defineProps({
  code: { type: String, required: true },
  semLabel: { type: String, required: true },
  offered: { type: String, required: true }, // e.g. "Term 2", "Terms 1 & 2"
  nextLabel: { type: String, default: '' }, // the next semester that offers it; empty when the plan has none
});
const emit = defineEmits(['close', 'move']);
</script>

<template>
  <AlertModal :title="`${code} is not offered in ${semLabel}`" @close="emit('close')">
    <p class="text-[14px] leading-[22px] text-muted-foreground">
      {{ code }} is only offered in {{ offered }}, so it can't go in {{ semLabel }}.
      <template v-if="nextLabel">Move it to {{ nextLabel }} instead?</template>
      <template v-else>No later semester in this plan offers it. Add a term that does, or choose another module.</template>
    </p>
    <template #actions>
      <BaseButton v-if="nextLabel" variant="outline" @click="emit('close')">Cancel</BaseButton>
      <BaseButton v-if="nextLabel" @click="emit('move')">Move to {{ nextLabel }}</BaseButton>
      <BaseButton v-else @click="emit('close')">Got it</BaseButton>
    </template>
  </AlertModal>
</template>
