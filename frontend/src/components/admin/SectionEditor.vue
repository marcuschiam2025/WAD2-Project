<script setup>
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue';
import { api } from '@core/services/api';
import { useUserStore } from '@core/stores/user';
const emit = defineEmits(['saved']);
const user = useUserStore();
const moduleCode = ref(''),
  term = ref(''),
  terms = ref([]),
  rows = ref([]);
const operation = ref('');
const form = ref(null),
  original = ref(null),
  creating = ref(false),
  review = ref(false),
  busy = ref(false),
  error = ref(''),
  message = ref('');
const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
let generation = 0;
const copy = (value) => JSON.parse(JSON.stringify(value));
const dirty = computed(() => form.value && JSON.stringify(form.value) !== JSON.stringify(original.value));
const meeting = () => ({ day: 'MON', start: '08:15', end: '11:30', venue: '' });
function discardAllowed() {
  return !dirty.value || window.confirm('Discard unsaved section changes?');
}
async function run(action) {
  if (busy.value) return;
  const version = ++generation,
    uid = user.uid;
  const current = () => version === generation && uid === user.uid && user.profile.role === 'admin';
  busy.value = true;
  error.value = '';
  message.value = '';
  try {
    await action(current);
  } catch (failure) {
    if (current()) error.value = failure.message;
  } finally {
    if (version === generation) busy.value = false;
  }
}
function toForm(row) {
  return {
    ...row,
    capacity: row.capacity ?? '',
    hasExam: !!row.finalExam,
    finalExam: row.finalExam ?? { date: '', start: '09:00', end: '11:00', venue: '' },
  };
}
async function load() {
  if (!discardAllowed()) return;
  await run(async (current) => {
    const found = await api.adminSections(moduleCode.value.trim(), term.value.trim());
    if (!current()) return;
    rows.value = found;
    form.value = null;
    original.value = null;
    review.value = false;
    operation.value = '';
  });
}
function edit(row) {
  if (busy.value || !discardAllowed()) return;
  form.value = toForm(copy(row));
  original.value = copy(form.value);
  creating.value = false;
  review.value = false;
  operation.value = '';
  error.value = '';
  message.value = '';
}
function add() {
  if (busy.value || !discardAllowed()) return;
  form.value = toForm({
    moduleCode: moduleCode.value.trim(),
    termKey: term.value.trim(),
    sectionCode: '',
    instructor: '',
    capacity: null,
    classSlots: [meeting()],
    finalExam: null,
  });
  original.value = null;
  creating.value = true;
  review.value = false;
  operation.value = '';
  error.value = '';
  message.value = '';
}
async function reload() {
  if (!form.value || !discardAllowed()) return;
  const { moduleCode: code, termKey, sectionCode } = form.value;
  await run(async (current) => {
    const found = await api.adminSections(code, termKey);
    if (!current()) return;
    const row = found.find((s) => s.sectionCode === sectionCode);
    if (!row) throw Error('Section no longer exists');
    form.value = toForm(row);
    original.value = copy(form.value);
    review.value = false;
    operation.value = '';
    rows.value = found;
  });
}
async function save() {
  await run(async (current) => {
    const f = form.value;
    const data = {
      moduleCode: f.moduleCode,
      termKey: f.termKey,
      sectionCode: f.sectionCode,
      instructor: f.instructor,
      capacity: f.capacity === '' ? null : Number(f.capacity),
      classSlots: f.classSlots,
      finalExam: f.hasExam ? f.finalExam : null,
    };
    const row = creating.value
      ? await api.createAdminSection(data)
      : await api.updateAdminSection({ ...data, revision: f.revision });
    if (!current()) return;
    form.value = toForm(row);
    original.value = copy(form.value);
    creating.value = false;
    review.value = false;
    moduleCode.value = row.moduleCode;
    term.value = row.termKey;
    const index = rows.value.findIndex(
      (s) =>
        s.moduleCode === row.moduleCode && s.termKey === row.termKey && s.sectionCode === row.sectionCode,
    );
    if (index >= 0) rows.value[index] = row;
    else
      rows.value = [
        ...rows.value.filter((s) => s.moduleCode === row.moduleCode && s.termKey === row.termKey),
        row,
      ];
    message.value =
      'Section saved. Existing selections retain their section ID. Students should reload and recheck clashes before saving bids.';
    emit('saved');
  });
}
function requestLifecycle(action) {
  if (busy.value || !discardAllowed()) return;
  if (original.value) form.value = copy(original.value);
  operation.value = action;
  review.value = false;
  error.value = '';
}
async function applyLifecycle() {
  const action = operation.value;
  await run(async (current) => {
    const row = await (action === 'archive' ? api.archiveAdminSection : api.restoreAdminSection)(form.value);
    if (!current()) return;
    form.value = toForm(row);
    original.value = copy(form.value);
    operation.value = '';
    const index = rows.value.findIndex((item) => item.sectionId === row.sectionId);
    if (index >= 0) rows.value[index] = row;
    message.value =
      action === 'archive'
        ? 'Section archived. Saved votes and carts are retained; students must choose an active section before saving new bids.'
        : 'Section restored. Students can select it again after reloading.';
    emit('saved');
  });
}
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
    original.value = null;
    rows.value = [];
    busy.value = false;
    review.value = false;
    operation.value = '';
    error.value = '';
    message.value = '';
  },
);
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload);
  const uid = user.uid,
    version = generation;
  try {
    const info = await api.round();
    if (uid === user.uid && version === generation) {
      terms.value = info.availableTerms ?? [];
      term.value = info.term ?? '';
    }
  } catch {
    /* Term can be entered manually. */
  }
});
onBeforeUnmount(() => {
  generation++;
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<template>
  <section class="mt-8 rounded-lg border border-border bg-card p-5" aria-labelledby="sections-heading">
    <h2 id="sections-heading" class="text-xl font-semibold">Sections & schedules</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      Manage weekly classes and final exams. All times are Singapore time.
    </p>
    <p
      v-if="error"
      role="alert"
      class="mt-4 rounded-md border border-destructive p-3 text-sm text-destructive"
    >
      {{ error }}
      <button v-if="form && !creating" type="button" class="ml-2 underline" :disabled="busy" @click="reload">
        Reload saved section
      </button>
    </p>
    <p v-if="message" role="status" class="mt-4 rounded-md bg-muted p-3 text-sm">{{ message }}</p>
    <form class="mt-5 flex flex-wrap items-end gap-3" @submit.prevent="load">
      <label class="text-sm"
        >Module code<input
          v-model="moduleCode"
          required
          placeholder="IS216"
          maxlength="40"
          class="mt-1 block w-40 rounded-md border border-border bg-background p-2"
      /></label>
      <label class="text-sm"
        >Academic term<input
          v-model="term"
          required
          list="admin-section-terms"
          placeholder="2026-27_T2"
          class="mt-1 block w-44 rounded-md border border-border bg-background p-2" /><datalist
          id="admin-section-terms"
        >
          <option v-for="t in terms" :key="t" :value="t" /></datalist
      ></label>
      <button class="rounded-md border border-border px-4 py-2 text-sm" :disabled="busy">
        Load sections
      </button>
      <button
        type="button"
        class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        :disabled="busy || !moduleCode || !term"
        @click="add"
      >
        New section
      </button>
    </form>
    <p v-if="busy" role="status" class="mt-3 text-sm text-muted-foreground">Loading…</p>
    <div class="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <ul class="max-h-[450px] divide-y divide-border overflow-auto">
          <li v-for="row in rows" :key="row.sectionId">
            <button
              class="w-full rounded-md p-3 text-left hover:bg-muted"
              :class="{ 'bg-muted': form?.sectionId === row.sectionId }"
              :disabled="busy"
              @click="edit(row)"
            >
              <span class="block text-sm font-semibold"
                >{{ row.sectionCode }} · {{ row.moduleCode }}
                <span v-if="row.archived" class="text-xs font-normal text-muted-foreground"
                  >Archived</span
                ></span
              ><span class="mt-1 block text-xs text-muted-foreground"
                >{{ row.instructor || 'Instructor not listed' }}<br />{{ row.classSlots.length }} weekly
                meeting(s) · {{ row.termKey }}</span
              >
            </button>
          </li>
        </ul>
        <p v-if="!rows.length" class="text-sm text-muted-foreground">
          Load a module and term to find its sections.
        </p>
      </div>
      <form v-if="form" class="space-y-4" @submit.prevent="review = true">
        <h3 class="font-semibold">
          {{ creating ? 'Create section' : `Edit ${form.sectionCode}` }} · {{ form.moduleCode }} ·
          {{ form.termKey }}
        </h3>
        <p v-if="form.legacyExamNote" class="rounded-md bg-muted p-3 text-sm">
          Existing exam note: {{ form.legacyExamNote }}. Enter the exam date and times below before saving.
        </p>
        <p v-if="form.archived" class="rounded-md bg-muted p-3 text-sm">
          Archived: unavailable for new votes and bid saves. Existing saved records are retained.
        </p>
        <fieldset :disabled="busy || review || !!operation" class="space-y-4 disabled:opacity-70">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block text-sm"
              >Section code<input
                v-model="form.sectionCode"
                required
                :readonly="!creating"
                placeholder="G1"
                pattern="[A-Z0-9][A-Z0-9_\-]{0,19}"
                maxlength="20"
                class="mt-1 block w-full rounded-md border border-border bg-background p-2" /></label
            ><label class="block text-sm"
              >Capacity<input
                v-model="form.capacity"
                type="number"
                min="1"
                max="10000"
                step="1"
                placeholder="Unknown"
                class="mt-1 block w-full rounded-md border border-border bg-background p-2"
            /></label>
          </div>
          <label class="block text-sm"
            >Instructor<input
              v-model="form.instructor"
              maxlength="200"
              class="mt-1 block w-full rounded-md border border-border bg-background p-2"
          /></label>
          <div class="flex items-center justify-between gap-3">
            <h4 class="text-sm font-semibold">Weekly meetings</h4>
            <button
              type="button"
              class="rounded-md border border-border px-3 py-2 text-sm"
              :disabled="form.classSlots.length >= 14"
              @click="form.classSlots.push(meeting())"
            >
              Add meeting
            </button>
          </div>
          <div
            v-for="(slot, index) in form.classSlots"
            :key="index"
            class="rounded-md border border-border p-3"
          >
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label class="text-sm"
                >Day<select
                  v-model="slot.day"
                  class="mt-1 block w-full rounded-md border border-border bg-background p-2"
                >
                  <option v-for="day in days" :key="day">{{ day }}</option>
                </select></label
              ><label class="text-sm"
                >Start<input
                  v-model="slot.start"
                  required
                  type="time"
                  class="mt-1 block w-full rounded-md border border-border bg-background p-2" /></label
              ><label class="text-sm"
                >End<input
                  v-model="slot.end"
                  required
                  type="time"
                  class="mt-1 block w-full rounded-md border border-border bg-background p-2"
              /></label>
            </div>
            <label class="mt-3 block text-sm"
              >Venue<input
                v-model="slot.venue"
                maxlength="200"
                class="mt-1 block w-full rounded-md border border-border bg-background p-2"
            /></label>
            <button
              type="button"
              class="mt-3 text-xs text-destructive underline disabled:opacity-40"
              :disabled="form.classSlots.length === 1"
              @click="form.classSlots.splice(index, 1)"
            >
              Remove meeting {{ index + 1 }}
            </button>
          </div>
          <label class="flex items-center gap-2 text-sm"
            ><input v-model="form.hasExam" type="checkbox" />This section has a final exam</label
          >
          <div v-if="form.hasExam" class="rounded-md border border-border p-3">
            <div class="grid gap-3 sm:grid-cols-3">
              <label class="text-sm"
                >Exam date<input
                  v-model="form.finalExam.date"
                  required
                  type="date"
                  class="mt-1 block w-full rounded-md border border-border bg-background p-2" /></label
              ><label class="text-sm"
                >Start<input
                  v-model="form.finalExam.start"
                  required
                  type="time"
                  class="mt-1 block w-full rounded-md border border-border bg-background p-2" /></label
              ><label class="text-sm"
                >End<input
                  v-model="form.finalExam.end"
                  required
                  type="time"
                  class="mt-1 block w-full rounded-md border border-border bg-background p-2"
              /></label>
            </div>
            <label class="mt-3 block text-sm"
              >Exam venue<input
                v-model="form.finalExam.venue"
                maxlength="200"
                class="mt-1 block w-full rounded-md border border-border bg-background p-2"
            /></label>
          </div>
        </fieldset>
        <div v-if="review" class="rounded-md border border-primary bg-muted p-4 text-sm">
          <h4 class="font-semibold">Review {{ form.sectionCode }}</h4>
          <p class="mt-2">
            {{ form.classSlots.length }} weekly meeting(s) ·
            {{ form.hasExam ? 'Final exam included' : 'No final exam' }}. Check all details above before
            saving to the shared timetable.
          </p>
          <p class="mt-2">
            Existing votes and carts keep their section selection. Changed times can introduce clashes;
            students must refresh and review.
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
          v-else-if="!operation"
          class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          :disabled="busy || !dirty"
        >
          Review changes
        </button>
        <div v-if="!creating && !review && !operation" class="border-t border-border pt-4">
          <button
            type="button"
            class="rounded-md border border-border px-4 py-2 text-sm"
            :disabled="busy"
            @click="requestLifecycle(form.archived ? 'restore' : 'archive')"
          >
            {{ form.archived ? 'Restore section' : 'Archive section' }}
          </button>
        </div>
        <div
          v-if="operation"
          class="rounded-md border border-border bg-muted p-4 text-sm"
          role="region"
        >
          <h4 class="font-semibold">
            {{ operation === 'archive' ? 'Archive' : 'Restore' }} {{ form.moduleCode }}
            {{ form.sectionCode }} · {{ form.termKey }}?
          </h4>
          <p v-if="operation === 'archive'" class="mt-2">
            Remove this section from active voting and new bid saves. Existing votes and carts remain stored,
            but students must review their choices. You can restore it later.
          </p>
          <p v-else class="mt-2">
            Make this section available again. Its module must be active. Retained room votes count again once
            restored; review any room decisions.
          </p>
          <div class="mt-4 flex gap-3">
            <button
              type="button"
              class="rounded-md bg-primary px-4 py-2 text-primary-foreground"
              :disabled="busy"
              @click="applyLifecycle"
            >
              {{ busy ? 'Saving…' : 'Confirm' }}</button
            ><button
              type="button"
              class="rounded-md border border-border px-4 py-2"
              :disabled="busy"
              @click="operation = ''"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
      <p v-else class="rounded-md bg-muted p-5 text-sm text-muted-foreground">
        Choose an existing section or create one for the module and term above.
      </p>
    </div>
  </section>
</template>
