<script setup>
// Shared shell for the warning overlays (prereq warning, plan limit, prerequisite ban).
import BaseModal from '@/components/ui/BaseModal.vue'
import iconAlert from '@/assets/figma/alert-18.svg'
import iconClose from '@/assets/figma/icon-close.svg'

defineProps({ title: { type: String, required: true } })
const emit = defineEmits(['close'])
</script>

<template>
  <BaseModal @close="emit('close')">
    <div class="flex items-center gap-2.5">
      <span class="flex shrink-0 items-center justify-center rounded-full bg-warning-soft p-2">
        <img :src="iconAlert" alt="" class="size-[18px]" />
      </span>
      <h2 class="flex-1 text-h4">{{ title }}</h2>
      <button type="button" aria-label="Close" @click="emit('close')">
        <img :src="iconClose" alt="" class="size-[18px]" />
      </button>
    </div>
    <slot />
    <div class="flex justify-end gap-2.5">
      <slot name="actions" />
    </div>
  </BaseModal>
</template>
