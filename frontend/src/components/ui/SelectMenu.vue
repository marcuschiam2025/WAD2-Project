<script setup>
// Select field with an attached listbox (Onboarding Major / Track / Year).
// `multiple` renders checkboxes and binds an array; otherwise binds a single value and shows a check on the active row.
// `searchable` turns the field into a type-to-filter input with a leading search icon.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { popEnter, popLeave } from '@/motion';
import iconSearch from '@/assets/v2/search.svg';
import chevronDown from '@/assets/v2/chevron-down.svg';
import chevronUp from '@/assets/v2/chevron-up.svg';
import checkWhite from '@/assets/v2/check-white-12.svg';
import checkPrimary from '@/assets/v2/check-primary-16.svg';

const model = defineModel({ type: [String, Number, Array], default: '' });
const props = defineProps({
  options: { type: Array, required: true }, // [{ value, label }]
  multiple: Boolean,
  searchable: Boolean,
  placeholder: { type: String, default: 'Select…' },
});

const open = ref(false);
const query = ref('');
const root = ref(null);

const isSelected = (v) => (props.multiple ? model.value.includes(v) : model.value === v);

const summary = computed(() => {
  const picked = props.options.filter((o) => isSelected(o.value));
  return picked.length ? picked.map((o) => o.label).join(', ') : '';
});

const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return q ? props.options.filter((o) => o.label.toLowerCase().includes(q)) : props.options;
});

function pick(o) {
  if (!props.multiple) {
    model.value = o.value;
    open.value = false;
    query.value = '';
    return;
  }
  // An option flagged `exclusive` (e.g. Undecided) can't be combined with others
  if (o.exclusive) {
    model.value = isSelected(o.value) ? [] : [o.value];
    return;
  }
  const exclusive = props.options.filter((x) => x.exclusive).map((x) => x.value);
  const rest = model.value.filter((v) => !exclusive.includes(v));
  model.value = rest.includes(o.value) ? rest.filter((v) => v !== o.value) : [...rest, o.value];
}

function onDocClick(e) {
  if (root.value && !root.value.contains(e.target)) open.value = false;
}
onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));
</script>

<template>
  <div ref="root" class="flex w-full flex-col gap-1.5">
    <div
      class="flex items-center gap-2 rounded-md border bg-card px-3 py-2.5 transition-colors"
      :class="open ? 'border-ring' : 'border-border'"
      @click="open = true"
    >
      <img v-if="searchable" :src="iconSearch" alt="" class="size-4" />
      <input
        v-if="searchable"
        v-model="query"
        :placeholder="summary || placeholder"
        class="min-w-0 flex-1 bg-transparent text-[14px] leading-normal outline-none"
        :class="summary && !open ? 'placeholder:text-foreground' : 'placeholder:text-muted-foreground'"
        @focus="open = true"
        @keydown.esc="open = false"
      />
      <span
        v-else
        class="min-w-0 flex-1 truncate text-[14px] leading-normal"
        :class="!summary && 'text-muted-foreground'"
      >
        {{ summary || placeholder }}
      </span>
      <button type="button" :aria-expanded="open" aria-label="Toggle options" @click.stop="open = !open">
        <img :src="open ? chevronUp : chevronDown" alt="" class="size-4" />
      </button>
    </div>

    <Transition :css="false" @enter="popEnter" @leave="popLeave">
      <ul
        v-if="open"
        role="listbox"
        :aria-multiselectable="multiple"
        class="flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-md"
      >
        <li v-for="o in visible" :key="o.value">
          <button
            type="button"
            role="option"
            :aria-selected="isSelected(o.value)"
            class="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[14px] leading-normal transition-colors"
            :class="isSelected(o.value) ? 'bg-primary-tint font-medium text-primary' : 'hover:bg-muted'"
            @click="pick(o)"
          >
            <span
              v-if="multiple"
              class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px]"
              :class="isSelected(o.value) ? 'border-primary bg-primary' : 'border-border bg-card'"
            >
              <img v-if="isSelected(o.value)" :src="checkWhite" alt="" class="size-3" />
            </span>
            <span class="flex-1">{{ o.label }}</span>
            <img
              v-if="!multiple && isSelected(o.value)"
              :src="checkPrimary"
              alt=""
              class="icon-accent size-4"
            />
          </button>
        </li>
        <li v-if="!visible.length" class="px-2.5 py-2 text-[13px] text-muted-foreground">No matches</li>
      </ul>
    </Transition>
  </div>
</template>
