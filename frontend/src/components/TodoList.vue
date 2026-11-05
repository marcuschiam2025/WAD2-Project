<script setup>
// Dashboard to-do list: add, tick off, delete and clear finished items.
import { computed, ref, watch } from 'vue';
import { useTodosStore } from '@core/stores/todos';
import { useUserStore } from '@core/stores/user';
import { popEnter, popLeave } from '@/motion';
import BaseButton from '@/components/ui/BaseButton.vue';
import checkWhite from '@/assets/v2/check-white-12.svg';
import iconRemove from '@/assets/figma/icon-remove.svg';

const todos = useTodosStore();
const user = useUserStore();
const text = ref('');
watch(
  () => [user.uid, user.isSignedIn],
  () => {
    text.value = '';
  },
  { flush: 'sync' },
);

// Open items first, finished ones below
const sorted = computed(() => [...todos.items.filter((i) => !i.done), ...todos.items.filter((i) => i.done)]);
const doneCount = computed(() => todos.items.filter((i) => i.done).length);

function add() {
  if (!text.value.trim()) return;
  todos.add(text.value);
  text.value = '';
}
</script>

<template>
  <section class="card flex flex-col gap-3 p-5">
    <div class="flex items-center justify-between">
      <h2 class="text-h4">To-do</h2>
      <span class="text-[13px] text-muted-foreground">{{ doneCount }} of {{ todos.items.length }} done</span>
    </div>

    <p class="text-xs text-muted-foreground">
      Saved in this browser for your account. Tasks do not sync across devices.
    </p>

    <form class="flex gap-2" @submit.prevent="add">
      <input
        v-model="text"
        :disabled="!user.isSignedIn"
        maxlength="120"
        placeholder="Add a to-do"
        aria-label="New to-do"
        class="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-[9px] text-[14px] leading-normal outline-none transition-colors focus:border-ring"
      />
      <BaseButton :disabled="!user.isSignedIn || !text.trim()" @click="add">Add</BaseButton>
    </form>

    <!-- motion: new to-dos pop in, removed ones fade out -->
    <TransitionGroup tag="ul" :css="false" @enter="popEnter" @leave="popLeave">
      <li
        v-for="item in sorted"
        :key="item.id"
        class="group flex items-center gap-3 border-t border-border py-2.5"
      >
        <button
          type="button"
          role="checkbox"
          :aria-checked="item.done"
          :aria-label="`${item.done ? 'Mark not done' : 'Mark done'}: ${item.text}`"
          class="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors"
          :class="item.done ? 'border-primary bg-primary' : 'border-border bg-card hover:border-primary'"
          @click="todos.toggle(item.id)"
        >
          <img v-if="item.done" :src="checkWhite" alt="" class="size-3" />
        </button>
        <span
          class="min-w-0 flex-1 text-[14px] leading-normal"
          :class="item.done && 'text-muted-foreground line-through'"
          >{{ item.text }}</span
        >
        <button
          type="button"
          :aria-label="`Delete: ${item.text}`"
          class="rounded-sm p-1 opacity-60 transition-opacity hover:bg-muted hover:opacity-100 focus-visible:opacity-100"
          @click="todos.remove(item.id)"
        >
          <img :src="iconRemove" alt="" class="size-3" />
        </button>
      </li>
    </TransitionGroup>

    <p v-if="!todos.items.length" class="border-t border-border pt-3 text-[13px] text-muted-foreground">
      Nothing on your list. Add something above.
    </p>

    <div v-if="doneCount" class="border-t border-border pt-3">
      <BaseButton variant="ghost" size="sm" @click="todos.clearDone()"
        >Clear {{ doneCount }} finished</BaseButton
      >
    </div>
  </section>
</template>
