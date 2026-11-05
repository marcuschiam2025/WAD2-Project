<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { api } from '@core/services/api';
import { useUserStore } from '@core/stores/user';
import { singaporeInput, singaporeInstant } from '@core/utils/roundTime';
const emit = defineEmits(['saved']);
const user = useUserStore();
const form = ref(null),
  original = ref(''),
  terms = ref([]),
  busy = ref(false),
  review = ref(false),
  error = ref(''),
  message = ref(''),
  source = ref('');
let generation = 0;
const dirty = computed(() => form.value && JSON.stringify(form.value) !== original.value);
// BOSS's rounds (BiddingWindow.js). A saved name outside this list stays selectable until it is changed.
const ROUNDS = ['1', '1A', '1B', '2', '2A'];
const roundOptions = computed(() =>
  form.value?.round && !ROUNDS.includes(form.value.round) ? [...ROUNDS, form.value.round] : ROUNDS,
);
function fill(row) {
  form.value = {
    term: row.term ?? '',
    round: row.round ?? '',
    closesAt: singaporeInput(row.closesAt),
    revision: row.revision ?? 0,
  };
  original.value = JSON.stringify(form.value);
  review.value = false;
}
async function run(action) {
  if (busy.value) return;
  const uid = user.uid,
    version = ++generation;
  const current = () => uid === user.uid && generation === version && user.profile.role === 'admin';
  busy.value = true;
  error.value = '';
  message.value = '';
  try {
    await action(current);
  } catch (e) {
    if (current()) error.value = e.message;
  } finally {
    if (current()) busy.value = false;
  }
}
async function load() {
  if (dirty.value && !window.confirm('Discard unsaved round settings?')) return;
  await run(async (current) => {
    const row = await api.adminRound();
    if (!current()) return;
    terms.value = [...new Set([...(row.availableTerms ?? []), ...(row.term ? [row.term] : [])])];
    source.value = row.source;
    fill(row);
  });
}
async function save() {
  await run(async (current) => {
    const row = await api.saveAdminRound({ ...form.value, closesAt: singaporeInstant(form.value.closesAt) });
    if (!current()) return;
    fill(row);
    source.value = 'staff';
    message.value =
      'Saved. Students receive the updated round when they reload bidding. Existing plans and carts are retained.';
    emit('saved');
  });
}
const closesInPast = computed(
  () => form.value?.closesAt && Date.parse(singaporeInstant(form.value.closesAt)) < Date.now(),
);
function beforeUnload(event) {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = '';
  }
}
watch(
  () => user.uid,
  () => {
    generation++;
    form.value = null;
    original.value = '';
    terms.value = [];
    busy.value = false;
    review.value = false;
    error.value = '';
    message.value = '';
  },
);
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload);
  load();
});
onBeforeUnmount(() => {
  generation++;
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<template>
  <section class="mt-8 rounded-lg border border-border bg-card p-5" aria-labelledby="round-heading">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="round-heading" class="text-xl font-semibold">Active bidding round</h2>
        <p class="mt-2 text-sm text-muted-foreground">
          Set the term, round and closing time shown in the student bidding planner.
        </p>
      </div>
      <button
        type="button"
        class="rounded-md border border-border px-3 py-2 text-sm"
        :disabled="busy"
        @click="load"
      >
        Reload settings
      </button>
    </div>
    <p v-if="error" role="alert" class="mt-4 text-sm text-destructive">{{ error }}</p>
    <p v-if="message" role="status" class="mt-4 text-sm text-success">{{ message }}</p>
    <p v-if="busy && !form" role="status" class="mt-4 text-sm">Loading round settings…</p>
    <form v-if="form" class="mt-5 max-w-xl space-y-4" @submit.prevent="review = true">
      <p class="text-xs text-muted-foreground">
        {{
          source === 'staff'
            ? 'Using saved staff settings.'
            : source === 'configured'
              ? 'Using server configuration until you save staff settings.'
              : 'No round configured yet. The term currently comes from the section catalogue.'
        }}
      </p>
      <fieldset :disabled="busy || review" class="space-y-4 disabled:opacity-70">
        <label class="block text-sm"
          >Academic term<select
            v-model="form.term"
            required
            class="mt-1 block w-full rounded-md border border-border bg-background p-2"
          >
            <option value="" disabled>Select a term</option>
            <option v-for="term in terms" :key="term" :value="term">{{ term }}</option>
          </select></label
        >
        <p v-if="!terms.length" class="text-sm text-muted-foreground">
          Add class sections for a term before configuring its round.
        </p>
        <label class="block text-sm"
          >Round name<select
            v-model="form.round"
            required
            class="mt-1 block w-full rounded-md border border-border bg-background p-2"
          >
            <option value="" disabled>Select a round</option>
            <option v-for="round in roundOptions" :key="round" :value="round">{{ round }}</option>
          </select></label
        >
        <label class="block text-sm"
          >Closing time · Singapore (UTC+08:00)<input
            v-model="form.closesAt"
            required
            type="datetime-local"
            step="60"
            class="mt-1 block w-full rounded-md border border-border bg-background p-2"
        /></label>
      </fieldset>
      <p class="text-xs text-muted-foreground">
        This is a planning reference. Students submit actual bids in BOSS; saving a personal plan here remains
        available after the deadline.
      </p>
      <div v-if="review" class="rounded-md border border-primary bg-muted p-4 text-sm">
        <h3 class="font-semibold">Review active round</h3>
        <p class="mt-2">
          {{ form.term }} · Round {{ form.round }} · Closes {{ form.closesAt.replace('T', ' ') }} Singapore
          time
        </p>
        <p v-if="closesInPast" class="mt-2 font-medium">This closing time has already passed.</p>
        <p class="mt-2">
          Changing the term switches the section catalogue students load. Previously saved carts stay attached
          to their original term. This change is recorded in staff history.
        </p>
        <div class="mt-4 flex gap-3">
          <button
            type="button"
            class="rounded-md bg-primary px-4 py-2 text-primary-foreground"
            :disabled="busy"
            @click="save"
          >
            {{ busy ? 'Saving…' : 'Confirm save' }}</button
          ><button
            type="button"
            class="rounded-md border border-border px-4 py-2"
            :disabled="busy"
            @click="review = false"
          >
            Back to editing
          </button>
        </div>
      </div>
      <button
        v-else
        type="submit"
        class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        :disabled="busy || !dirty || !terms.length"
      >
        Review changes
      </button>
    </form>
  </section>
</template>
