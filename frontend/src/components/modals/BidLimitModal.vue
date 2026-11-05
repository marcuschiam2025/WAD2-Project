<script setup>
// Overlay / Too many modules: the bid cart holds more modules than a semester allows. Room modules arrive on their own
// when a party admin locks a section, so this lets the student choose which module to take out.
import AlertModal from './AlertModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

defineProps({
  count: { type: Number, required: true },
  max: { type: Number, required: true },
  planName: { type: String, default: 'your plan' },
  // [{ code, name, roomName, roomId }]: roomId means a collab room locked it, so it can't be removed from here
  rows: { type: Array, default: () => [] },
});
const emit = defineEmits(['close', 'remove']);
</script>

<template>
  <AlertModal :title="`${count} modules is too many`" @close="emit('close')">
    <p class="text-[14px] leading-[22px] text-muted-foreground">
      A semester holds at most {{ max }} modules, and your bid cart has {{ count }}. Remove
      {{ count - max === 1 ? 'one' : count - max }}
      to save your bids.
    </p>
    <ul class="flex max-h-72 flex-col gap-2 overflow-y-auto">
      <li
        v-for="row in rows"
        :key="row.code"
        class="flex items-center gap-3 rounded-md border border-border p-3"
      >
        <div class="flex min-w-0 flex-1 flex-col leading-normal">
          <span class="truncate text-[14px]"
            ><span class="font-mono font-bold">{{ row.code }}</span>
            <span class="text-muted-foreground">{{ row.name }}</span></span
          >
          <span v-if="row.roomId" class="text-[12px] text-muted-foreground"
            >Locked by {{ row.roomName }}</span
          >
        </div>
        <RouterLink
          v-if="row.roomId"
          :to="`/rooms/${row.roomId}`"
          class="shrink-0 text-[13px] font-medium text-primary hover:underline"
          @click="emit('close')"
          >Open room</RouterLink
        >
        <BaseButton
          v-else
          variant="destructive-outline"
          size="sm"
          @click="emit('remove', row.code)"
          >Remove</BaseButton
        >
      </li>
    </ul>
    <p class="text-[12px] leading-normal text-muted-foreground">
      Removing a module takes it out of {{ planName }} for this semester and puts it back in your module
      basket.
      <template v-if="rows.every((row) => row.roomId)"
        >Every module here is locked by a collab room: leave a room, or ask its party admin to unlock it, to
        free a space.</template
      >
      <template v-else
        >A module locked by a collab room can only be freed by leaving that room or by its party admin
        unlocking it.</template
      >
    </p>
    <template #actions>
      <BaseButton variant="ghost" @click="emit('close')">Decide later</BaseButton>
    </template>
  </AlertModal>
</template>
