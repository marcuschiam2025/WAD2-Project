<script setup>
import { moduleName } from '@backend/data/catalogue'
import AlertModal from './AlertModal.vue'
import NoticeRow from './NoticeRow.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import iconPlus from '@/assets/figma/plus-14.svg'

defineProps({
  code: { type: String, required: true },
  semLabel: { type: String, required: true },
  prevSemLabel: { type: String, default: '' },
  nextSemLabel: { type: String, default: '' },
  prereqs: { type: Array, default: () => [] },
  coreqs: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'add-prereq', 'add-coreq', 'move-next'])
</script>

<template>
  <AlertModal :title="`${code} can’t go in ${semLabel} yet`" @close="emit('close')">
    <p class="text-small text-muted-foreground">
      You dragged {{ code }} {{ moduleName(code) }} into a future semester. Sort these out first:
    </p>
    <NoticeRow v-for="p in prereqs" :key="p" label="PREREQUISITE">
      <span class="font-semibold">{{ p }}</span> {{ moduleName(p) }} is not done. Please do this first.
      <template v-if="prevSemLabel" #action>
        <BaseButton variant="outline" size="sm" @click="emit('add-prereq', p)">
          <img :src="iconPlus" alt="" class="size-3.5" /> Add to {{ prevSemLabel }}
        </BaseButton>
      </template>
    </NoticeRow>
    <NoticeRow v-for="c in coreqs" :key="c" label="COREQUISITE" tone="info">
      <span class="font-semibold">{{ c }}</span> {{ moduleName(c) }} — take it in the same semester.
      <template #action>
        <BaseButton variant="outline" size="sm" @click="emit('add-coreq', c)">
          <img :src="iconPlus" alt="" class="size-3.5" /> Add to {{ semLabel }}
        </BaseButton>
      </template>
    </NoticeRow>
    <template #actions>
      <BaseButton variant="ghost" @click="emit('close')">Keep it anyway</BaseButton>
      <BaseButton v-if="nextSemLabel" @click="emit('move-next')">Move {{ code }} to {{ nextSemLabel }}</BaseButton>
    </template>
  </AlertModal>
</template>
