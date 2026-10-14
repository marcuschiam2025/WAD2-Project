<script setup>
import { ref } from 'vue'
import { usePlannerStore } from '@backend/stores/planner'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import iconX from '@/assets/figma/icon-x.svg'
import iconCheck from '@/assets/figma/check-white-import.svg'

const props = defineProps({
  roomName: { type: String, required: true },
  initial: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'apply'])
const planner = usePlannerStore()
const picked = ref(props.initial.length ? [...props.initial] : [planner.plans[0].id])

function toggle(id) {
  picked.value = picked.value.includes(id) ? picked.value.filter((x) => x !== id) : [...picked.value, id]
}
</script>

<template>
  <BaseModal width="w-[400px]" @close="emit('close')">
    <div class="flex items-start justify-between">
      <h2 class="text-h4">Which plans do you want to import?</h2>
      <button type="button" aria-label="Close" @click="emit('close')"><img :src="iconX" alt="" class="size-4" /></button>
    </div>
    <p class="text-small text-muted-foreground">Imported plans are visible to everyone in {{ roomName }}.</p>
    <button
      v-for="p in planner.plans"
      :key="p.id"
      type="button"
      class="flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left"
      :class="picked.includes(p.id) ? 'border-primary bg-primary-soft' : 'border-border hover:bg-muted'"
      @click="toggle(p.id)"
    >
      <span
        class="flex size-[18px] items-center justify-center rounded-sm border-[1.5px]"
        :class="picked.includes(p.id) ? 'border-primary bg-primary' : 'border-border'"
      >
        <img v-if="picked.includes(p.id)" :src="iconCheck" alt="" class="size-3" />
      </span>
      <span class="text-[13px] font-semibold">{{ p.name }}</span>
    </button>
    <div class="flex justify-end gap-2.5">
      <BaseButton variant="ghost" @click="emit('close')">Cancel</BaseButton>
      <BaseButton :disabled="!picked.length" @click="emit('apply', picked)">Apply</BaseButton>
    </div>
  </BaseModal>
</template>
