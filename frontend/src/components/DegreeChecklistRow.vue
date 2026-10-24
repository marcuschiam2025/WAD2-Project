<script setup>
// One outstanding line in the degree checklist sidebar. Clicking it opens the options for that course.
// The semester tag on the right says when it is recommended (hover it for every recommended semester).
import chevronRight from '@/assets/v2/chevron-right.svg'
import SemesterChip from '@/components/SemesterChip.vue'

defineProps({
  item: { type: Object, required: true },
  selected: Boolean,
})
defineEmits(['select'])
</script>

<template>
  <li>
    <button
      type="button"
      class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors"
      :class="selected ? 'bg-primary-tint' : 'hover:bg-muted'"
      :aria-pressed="selected"
      @click="$emit('select')"
    >
      <div class="min-w-0 flex-1 leading-normal">
        <p class="text-[13px] font-medium">
          <span v-if="item.code" class="mr-1 font-mono font-bold">{{ item.code }}</span>{{ item.label }}
        </p>
        <p class="line-clamp-2 text-[11.5px] text-muted-foreground">{{ item.detail }}</p>
      </div>
      <SemesterChip :item="item" class="mt-0.5 shrink-0" />
      <img :src="chevronRight" alt="" class="size-4 shrink-0" />
    </button>
  </li>
</template>
