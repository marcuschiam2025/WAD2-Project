<script setup>
import { computed } from 'vue'
import { modules } from '@/data/catalogue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import iconClose from '@/assets/figma/icon-close.svg'
import iconBookmark from '@/assets/figma/icon-bookmark.svg'

const props = defineProps({
  code: { type: String, required: true },
  trackLabel: { type: String, default: '' },
  saved: Boolean,
})
const emit = defineEmits(['close', 'save'])

const mod = computed(() => modules[props.code])
</script>

<template>
  <BaseModal width="w-[480px]" @close="emit('close')">
    <div class="flex items-start gap-3">
      <div class="flex flex-1 flex-col gap-1">
        <p class="text-overline text-primary uppercase">{{ code }} · {{ mod.cu ?? 1 }} CU · {{ trackLabel }}</p>
        <h2 class="text-h3">{{ mod.name }}</h2>
      </div>
      <button type="button" aria-label="Close" @click="emit('close')">
        <img :src="iconClose" alt="" class="size-[18px]" />
      </button>
    </div>
    <div class="flex flex-col gap-1.5">
      <p class="text-[13px] font-medium">Description</p>
      <p class="rounded-md bg-muted px-3.5 py-3 text-small">
        {{ mod.description ?? 'Course description will be loaded from the module catalogue.' }}
      </p>
    </div>
    <div class="flex gap-6 whitespace-nowrap">
      <div class="flex flex-col gap-0.5">
        <span class="text-[12px] text-muted-foreground">Prerequisite</span>
        <span class="text-[13px] font-medium">{{ mod.prereqs.join(', ') || 'None' }}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-[12px] text-muted-foreground">Offered</span>
        <span class="text-[13px] font-medium">{{ mod.offered ?? 'Term 1 & 2' }}</span>
      </div>
      <div v-if="mod.medianBid" class="flex flex-col gap-0.5">
        <span class="text-[12px] text-muted-foreground">Median bid</span>
        <span class="font-mono text-[13px] font-medium">e$ {{ mod.medianBid }}</span>
      </div>
    </div>
    <div class="flex justify-end gap-2.5">
      <BaseButton variant="ghost" @click="emit('close')">Close</BaseButton>
      <BaseButton :disabled="saved" @click="emit('save')">
        <img :src="iconBookmark" alt="" class="size-4" />
        {{ saved ? 'Saved to What-If planner' : 'Save to What-If planner' }}
      </BaseButton>
    </div>
  </BaseModal>
</template>
