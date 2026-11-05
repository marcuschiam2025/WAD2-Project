<script setup>
// Overlay / Semester Full: shown when a module is dropped into a semester that already has the maximum.
import AlertModal from './AlertModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

defineProps({
  semLabel: { type: String, required: true },
  max: { type: Number, required: true },
});
const emit = defineEmits(['close']);
</script>

<template>
  <AlertModal :title="`${semLabel} is full`" @close="emit('close')">
    <p class="text-[14px] leading-[22px] text-muted-foreground">
      A semester holds at most {{ max }} modules. Move one out of {{ semLabel }} first, then try again.
    </p>
    <template #actions>
      <BaseButton @click="emit('close')">Got it</BaseButton>
    </template>
  </AlertModal>
</template>
