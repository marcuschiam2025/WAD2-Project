<script setup>
// Shared shell for the warning overlays (Prereq Warning, Plan Limit Warning, Prerequisite Ban).
import BaseModal from '@/components/ui/BaseModal.vue';
import iconAlert from '@/assets/figma/alert-18.svg';
import iconClose from '@/assets/figma/icon-close.svg';

defineProps({ title: { type: String, required: true } });
const emit = defineEmits(['close']);
</script>

<template>
  <BaseModal @close="emit('close')">
    <div class="flex items-center gap-3">
      <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive-tint">
        <img :src="iconAlert" alt="" class="size-[18px]" />
      </span>
      <h2 class="flex-1 text-[18px] leading-normal font-semibold">{{ title }}</h2>
      <button type="button" class="rounded-sm p-0.5 hover:bg-muted" @click="emit('close')">
        <img :src="iconClose" alt="" class="size-[18px]" />
      </button>
    </div>
    <slot />
    <div class="flex justify-end gap-2">
      <slot name="actions" />
    </div>
  </BaseModal>
</template>
