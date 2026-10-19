<script setup>
// Overlay / Module Detail
import { computed } from 'vue'
import { modules } from '@core/data/catalogue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import iconClose from '@/assets/figma/icon-close.svg'

const props = defineProps({
  code: { type: String, required: true },
  trackLabel: { type: String, default: '' },
  saved: Boolean,
})
const emit = defineEmits(['close', 'save'])

// TODO(backend): description / offered / median bid come from GET /api/modules/:code
const mod = computed(() => modules[props.code])
const facts = computed(() => [
  { label: 'Prerequisite', value: mod.value.prereqs.join(', ') || 'None' },
  { label: 'Offered', value: mod.value.offered ?? 'Term 1 & 2' },
  ...(mod.value.medianBid ? [{ label: 'Median bid', value: `e$ ${mod.value.medianBid}`, mono: true }] : []),
])
</script>

<template>
  <BaseModal width="w-[480px]" @close="emit('close')">
    <div class="flex items-start gap-3">
      <div class="flex flex-1 flex-col gap-1">
        <p class="text-overline text-primary">{{ code }} · {{ mod.cu ?? 1 }} CU · {{ trackLabel }}</p>
        <h2 class="text-h3">{{ mod.name }}</h2>
      </div>
      <button type="button" aria-label="Close" class="rounded-sm p-0.5 hover:bg-muted" @click="emit('close')">
        <img :src="iconClose" alt="" class="size-[18px]" />
      </button>
    </div>
    <div class="flex flex-col gap-2">
      <p class="text-[13px] font-semibold">Description</p>
      <p class="rounded-lg bg-muted px-3.5 py-3 text-[14px] leading-[22px]">
        {{ mod.description ?? 'Course description will be loaded from the module catalogue.' }}
      </p>
    </div>
    <div class="flex gap-8 whitespace-nowrap">
      <div v-for="f in facts" :key="f.label" class="flex flex-col gap-0.5 leading-normal">
        <span class="text-[12px] text-muted-foreground">{{ f.label }}</span>
        <span class="text-[14px] font-medium" :class="f.mono && 'font-mono'">{{ f.value }}</span>
      </div>
    </div>
    <div class="flex justify-end gap-2">
      <BaseButton variant="ghost" @click="emit('close')">Close</BaseButton>
      <BaseButton :disabled="saved" @click="emit('save')">
        {{ saved ? 'Saved to What-If planner' : 'Save to What-If planner' }}
      </BaseButton>
    </div>
  </BaseModal>
</template>
