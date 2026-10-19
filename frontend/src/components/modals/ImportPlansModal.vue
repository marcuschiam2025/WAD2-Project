<script setup>
// Overlay / Import Plans
import { ref } from 'vue'
import { usePlannerStore } from '@core/stores/planner'
import { planLabel } from '@/trackLabels'
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
    <div class="flex items-start justify-between gap-3">
      <h2 class="text-[18px] leading-normal font-semibold">Which plans do you want to import?</h2>
      <button type="button" aria-label="Close" class="rounded-sm p-0.5 hover:bg-muted" @click="emit('close')">
        <img :src="iconX" alt="" class="size-4" />
      </button>
    </div>
    <p class="text-[13px] text-muted-foreground">Imported plans are visible to everyone in {{ roomName }}.</p>
    <div class="flex flex-col gap-2.5">
      <button
        v-for="p in planner.plans"
        :key="p.id"
        type="button"
        role="checkbox"
        :aria-checked="picked.includes(p.id)"
        class="flex items-center gap-2.5 rounded-md border px-3 py-3 text-left transition-colors"
        :class="picked.includes(p.id) ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'"
        @click="toggle(p.id)"
      >
        <span
          class="flex size-4 items-center justify-center rounded-[4px] border-[1.5px] transition-colors"
          :class="picked.includes(p.id) ? 'border-primary bg-primary' : 'border-border bg-card'"
        >
          <img v-if="picked.includes(p.id)" :src="iconCheck" alt="" class="size-3" />
        </span>
        <span class="text-[14px]">{{ planLabel(p) }}</span>
      </button>
    </div>
    <div class="flex justify-end gap-2">
      <BaseButton variant="ghost" @click="emit('close')">Cancel</BaseButton>
      <BaseButton :disabled="!picked.length" @click="emit('apply', picked)">Apply</BaseButton>
    </div>
  </BaseModal>
</template>
