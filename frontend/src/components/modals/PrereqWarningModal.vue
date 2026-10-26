<script setup>
// Overlay / Prereq Warning
import { moduleName } from '@core/data/catalogue'
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
  prereqGroups: { type: Array, default: () => [] },
  coreqGroups: { type: Array, default: () => [] },
  exclusions: { type: Array, default: () => [] },
  rules: { type: Array, default: () => [] },
  notOffered: { type: Object, default: null },
})
const emit = defineEmits(['close', 'add-prereq', 'add-coreq', 'move-next'])
</script>

<template>
  <AlertModal :title="`Review ${code} in ${semLabel}`" @close="emit('close')">
    <p class="text-[14px] leading-[22px] text-muted-foreground">
      {{ code }} {{ moduleName(code) }} has these academic warnings in your plan:
    </p>
    <NoticeRow v-for="(p, i) in prereqs" :key="p" label="Prerequisite">
      Take {{ (prereqGroups[i] ?? [p]).join(' or ') }} in an earlier semester.
      <template v-if="prevSemLabel" #action>
        <BaseButton variant="outline" size="sm" @click="emit('add-prereq', p)">
          <img :src="iconPlus" alt="" class="size-3.5" /> Add to {{ prevSemLabel }}
        </BaseButton>
      </template>
    </NoticeRow>
    <NoticeRow v-for="(c, i) in coreqs" :key="c" label="Corequisite" tone="info">
      Take {{ (coreqGroups[i] ?? [c]).join(' or ') }} in the same or an earlier semester.
      <template #action>
        <BaseButton variant="outline" size="sm" @click="emit('add-coreq', c)">
          <img :src="iconPlus" alt="" class="size-3.5" /> Add to {{ semLabel }}
        </BaseButton>
      </template>
    </NoticeRow>
    <NoticeRow v-for="c in exclusions" :key="`exclusion-${c}`" label="Exclusion">
      This module excludes {{ c }} {{ moduleName(c) }}, which is in your plan or exemptions. Review the conflicting courses.
    </NoticeRow>
    <NoticeRow v-for="rule in rules" :key="rule" label="Course-count prerequisite">
      Requires {{ rule }}. Courses in the same or a later semester do not count.
    </NoticeRow>
    <NoticeRow v-if="notOffered" label="Offering">
      {{ notOffered.lastOffered ? `Not offered since ${notOffered.lastOffered}.` : 'Not offered recently.' }} Check availability before planning this course.
    </NoticeRow>
    <template #actions>
      <BaseButton variant="ghost" @click="emit('close')">Keep it anyway</BaseButton>
      <BaseButton v-if="nextSemLabel" @click="emit('move-next')">Move {{ code }} to {{ nextSemLabel }}</BaseButton>
    </template>
  </AlertModal>
</template>
