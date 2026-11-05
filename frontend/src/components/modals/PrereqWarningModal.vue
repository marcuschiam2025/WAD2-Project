<script setup>
// Overlay / Prereq Warning
import { moduleName } from '@core/data/catalogue';
import AlertModal from './AlertModal.vue';
import NoticeRow from './NoticeRow.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import iconPlus from '@/assets/figma/plus-14.svg';

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
  // The excluded modules that can come out of the plan, and whether this one can
  droppableExclusions: { type: Array, default: () => [] },
  canDrop: { type: Boolean, default: false },
  rules: { type: Array, default: () => [] },
  notOffered: { type: Object, default: null },
  unknown: { type: Boolean, default: false },
});
const emit = defineEmits(['close', 'add-prereq', 'add-coreq', 'move-next', 'drop-module']);
</script>

<template>
  <AlertModal :title="`Review ${code} in ${semLabel}`" @close="emit('close')">
    <p class="text-[14px] leading-[22px] text-muted-foreground">
      {{ code }} {{ moduleName(code) }} has these academic warnings in your plan:
    </p>
    <!-- One row per unmet requirement, listing every module that would satisfy it with its own add button -->
    <NoticeRow v-for="group in prereqGroups" :key="'pre-' + group.join()" label="Prerequisite">
      Take {{ group.length > 1 ? 'one of these' : 'this' }} in an earlier semester{{
        prevSemLabel ? '' : ' (no earlier semester is open to add it to)'
      }}:
      <ul class="mt-2 flex flex-col gap-2">
        <li v-for="c in group" :key="c" class="flex items-center justify-between gap-3">
          <span class="min-w-0"
            ><span class="font-mono font-semibold">{{ c }}</span>
            <span class="text-muted-foreground">{{ moduleName(c) }}</span></span
          >
          <BaseButton
            v-if="prevSemLabel"
            variant="outline"
            size="sm"
            :aria-label="`Add ${c} to ${prevSemLabel}`"
            @click="emit('add-prereq', c)"
          >
            <img :src="iconPlus" alt="" class="size-3.5" /> Add to {{ prevSemLabel }}
          </BaseButton>
        </li>
      </ul>
    </NoticeRow>
    <NoticeRow v-for="group in coreqGroups" :key="'co-' + group.join()" label="Corequisite" tone="info">
      Take {{ group.length > 1 ? 'one of these' : 'this' }} in the same or an earlier semester:
      <ul class="mt-2 flex flex-col gap-2">
        <li v-for="c in group" :key="c" class="flex items-center justify-between gap-3">
          <span class="min-w-0"
            ><span class="font-mono font-semibold">{{ c }}</span>
            <span class="text-muted-foreground">{{ moduleName(c) }}</span></span
          >
          <BaseButton
            variant="outline"
            size="sm"
            :aria-label="`Add ${c} to ${semLabel}`"
            @click="emit('add-coreq', c)"
          >
            <img :src="iconPlus" alt="" class="size-3.5" /> Add to {{ semLabel }}
          </BaseButton>
        </li>
      </ul>
    </NoticeRow>
    <NoticeRow v-for="c in exclusions" :key="`exclusion-${c}`" label="Exclusion">
      This module excludes {{ c }} {{ moduleName(c) }}, which is in your plan or exemptions.
      <template v-if="droppableExclusions.includes(c) || canDrop">
        Keep one: the module you drop goes back to your basket.
        <span class="mt-2 flex flex-wrap gap-2">
          <BaseButton
            v-if="droppableExclusions.includes(c)"
            variant="outline"
            size="sm"
            :aria-label="`Move ${c} back to basket`"
            @click="emit('drop-module', c)"
            >Drop {{ c }}</BaseButton
          >
          <BaseButton
            v-if="canDrop"
            variant="outline"
            size="sm"
            :aria-label="`Move ${code} back to basket`"
            @click="emit('drop-module', code)"
            >Drop {{ code }}</BaseButton
          >
        </span>
      </template>
      <template v-else
        >Neither can be dropped here: one is completed or exempted, or a collab room has locked it.</template
      >
    </NoticeRow>
    <NoticeRow v-for="rule in rules" :key="rule" label="Course-count prerequisite">
      Requires {{ rule }}. Courses in the same or a later semester do not count.
    </NoticeRow>
    <NoticeRow v-if="unknown" label="Catalogue">
      {{ code }} is not in the course catalogue, so its requirements could not be checked. Check the code
      before planning this course.
    </NoticeRow>
    <NoticeRow v-if="notOffered" label="Offering">
      {{ notOffered.lastOffered ? `Not offered since ${notOffered.lastOffered}.` : 'Not offered recently.' }}
      Check availability before planning this course.
    </NoticeRow>
    <template #actions>
      <BaseButton variant="ghost" @click="emit('close')">Keep it anyway</BaseButton>
      <BaseButton v-if="nextSemLabel" @click="emit('move-next')"
        >Move {{ code }} to {{ nextSemLabel }}</BaseButton
      >
    </template>
  </AlertModal>
</template>
