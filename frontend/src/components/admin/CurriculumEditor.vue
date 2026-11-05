<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { api } from '@core/services/api';
import { useUserStore } from '@core/stores/user';
import ChipSelect from './ChipSelect.vue';
import SelectMenu from '@/components/ui/SelectMenu.vue';
const emit = defineEmits(['saved']);
const user = useUserStore();
const curricula = ref([]),
  selection = ref(''),
  bundle = ref(null),
  form = ref(null),
  original = ref(null);
const busy = ref(false),
  error = ref(''),
  message = ref(''),
  review = ref(false);
let generation = 0;
const copy = (value) => JSON.parse(JSON.stringify(value));
const dirty = computed(() => form.value && JSON.stringify(form.value) !== JSON.stringify(original.value));
const options = ref({ modules: [], categories: [], fulfils: [] });
const asOptions = (values) => values.map((value) => ({ value, label: value }));
const moduleOptions = computed(() =>
  options.value.modules.map((m) => ({
    value: m._id,
    label: `${m._id} ${m.title}${m.archived ? ' (archived)' : ''}`,
  })),
);
// ANY means "any course": it is only meaningful on a requirement, so it isn't one of the catalogue's categories
const categoryOptions = computed(() => asOptions(['ANY', ...options.value.categories]));
const tagOptions = computed(() => {
  const saved = form.value?.tag;
  const tags = options.value.fulfils;
  return asOptions(saved && !tags.includes(saved) ? [...tags, saved] : tags);
});
// These pickers aren't native inputs, so the browser's "required" check can't cover them
const missingPick = computed(() => {
  const f = form.value;
  if (f?.kind !== 'requirement') return '';
  if (['all', 'chooseN'].includes(f.rule) && !f.modules.length) return 'Choose at least one module.';
  if (f.rule === 'anyFromCategory' && !f.categories.length) return 'Choose at least one category.';
  if (['basket', 'flag'].includes(f.rule) && !f.tag) return 'Choose a requirement tag.';
  return '';
});
const readOnly = computed(
  () =>
    form.value?.kind === 'requirement' &&
    !['all', 'chooseN', 'basket', 'anyFromCategory', 'flag'].includes(form.value.rule),
);
const ruleNames = {
  all: 'All listed courses',
  chooseN: 'Choose a number of courses',
  basket: 'Credit units from a requirement tag',
  anyFromCategory: 'Credit units from categories',
  flag: 'Non-credit requirement',
};
const creditCategories = {
  UNI_CORE: 'University core',
  MAJOR_CORE: 'Major core',
  MAJOR_ELECTIVES: 'Major electives',
  FREE_ELECTIVES: 'Free electives',
  NONE: 'No credit category',
};
const records = computed(() =>
  bundle.value
    ? [
        ...bundle.value.tracks.map((row) => ({
          ...row,
          kind: 'track',
          display: row.name,
          scope: `Track · ${row.trackCode}`,
        })),
        ...bundle.value.requirements.map((row) => ({
          ...row,
          kind: 'requirement',
          display: row.label,
          scope:
            row.level === 'track'
              ? `Track rule · ${bundle.value.tracks.find((t) => t._id === row.ownerId)?.trackCode ?? row.ownerId}`
              : `${row.level === 'core' ? 'Core' : 'Major'} requirement`,
        })),
      ]
    : [],
);
const intakeLabel = (major) => `${major.intakeFrom}${major.intakeTo ? `-${major.intakeTo}` : ' onwards'}`;
function discardAllowed() {
  return !dirty.value || window.confirm('Discard unsaved curriculum changes?');
}
function fill(row) {
  return {
    ...copy(row),
    heading: row.heading ?? '',
    order: row.order ?? 0,
    countsToward: row.countsToward ?? 'NONE',
    cuRequired: row.cuRequired ?? 0,
    modules: [...(row.modules ?? [])],
    categories: [...(row.categories ?? [])],
    n: row.n ?? 1,
    tag: row.tag ?? '',
    autoFulfilled: row.autoFulfilled === true,
    description: row.description ?? '',
    source: row.source ?? '',
    lastChecked: row.lastChecked?.slice(0, 10) ?? '',
  };
}
async function run(action) {
  if (busy.value) return;
  const uid = user.uid,
    version = ++generation;
  const current = () => uid === user.uid && version === generation && user.profile.role === 'admin';
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
async function load() {
  if (!discardAllowed()) return;
  const id = selection.value;
  await run(async (current) => {
    const result = await api.adminCurriculum(id);
    if (!current()) return;
    bundle.value = result;
    form.value = null;
    original.value = null;
    review.value = false;
  });
}
function edit(row) {
  if (busy.value || !discardAllowed()) return;
  form.value = fill(row);
  original.value = copy(form.value);
  review.value = false;
  error.value = '';
  message.value = '';
}
async function reload() {
  if (!form.value || !discardAllowed()) return;
  const { kind, _id } = form.value,
    curriculum = bundle.value.major._id;
  await run(async (current) => {
    const result = await api.adminCurriculum(curriculum);
    if (!current()) return;
    const row = (kind === 'track' ? result.tracks : result.requirements).find((item) => item._id === _id);
    if (!row) throw Error('Curriculum record no longer exists');
    bundle.value = result;
    form.value = fill({ ...row, kind });
    original.value = copy(form.value);
    review.value = false;
  });
}
function payload() {
  const f = form.value;
  if (f.kind === 'track')
    return {
      name: f.name,
      description: f.description,
      source: f.source,
      lastChecked: f.lastChecked,
      revision: f.revision,
    };
  const data = {
    label: f.label,
    heading: f.heading,
    order: Number(f.order),
    countsToward: f.countsToward,
    cuRequired: Number(f.cuRequired),
    revision: f.revision,
  };
  if (['all', 'chooseN'].includes(f.rule)) data.modules = f.modules;
  if (f.rule === 'chooseN') data.n = Number(f.n);
  if (f.rule === 'anyFromCategory') data.categories = f.categories;
  if (['basket', 'flag'].includes(f.rule)) data.tag = f.tag;
  if (f.rule === 'flag') data.autoFulfilled = f.autoFulfilled;
  return data;
}
async function save() {
  await run(async (current) => {
    const { kind, _id } = form.value;
    const row = await (kind === 'track' ? api.updateAdminTrack : api.updateAdminRequirement)(
      bundle.value.major._id,
      _id,
      payload(),
    );
    if (!current()) return;
    const key = kind === 'track' ? 'tracks' : 'requirements';
    const index = bundle.value[key].findIndex((item) => item._id === _id);
    bundle.value[key][index] = row;
    form.value = fill({ ...row, kind });
    original.value = copy(form.value);
    review.value = false;
    message.value =
      'Saved for this curriculum. Students must reload to receive updated rules; existing plan module placements are retained.';
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
    curricula.value = [];
    selection.value = '';
    bundle.value = null;
    form.value = null;
    original.value = null;
    busy.value = false;
    review.value = false;
    error.value = '';
    message.value = '';
  },
);
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload);
  api
    .adminModuleOptions()
    .then((result) => (options.value = result))
    .catch((failure) => (error.value = failure.message));
  run(async (current) => {
    const rows = await api.adminCurricula();
    if (current()) {
      curricula.value = rows;
      selection.value = rows.find((row) => row._id === 'BSC-IS_AY2025')?._id ?? rows[0]?._id ?? '';
    }
  });
});
onBeforeUnmount(() => {
  generation++;
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<template>
  <section class="mt-8 rounded-lg border border-border bg-card p-5" aria-labelledby="curriculum-heading">
    <h2 id="curriculum-heading" class="text-xl font-semibold">Tracks & curriculum requirements</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      Edit existing track details and rules within one degree and intake range.
    </p>
    <p
      v-if="error"
      role="alert"
      class="mt-4 rounded-md border border-destructive p-3 text-sm text-destructive"
    >
      {{ error }}
      <button v-if="form" type="button" class="ml-2 underline" :disabled="busy" @click="reload">
        Reload saved record
      </button>
    </p>
    <p v-if="message" role="status" class="mt-4 rounded-md bg-muted p-3 text-sm">{{ message }}</p>
    <form class="mt-5 flex flex-wrap items-end gap-3" @submit.prevent="load">
      <label class="min-w-0 flex-1 text-sm"
        >Degree, major and intake<select
          v-model="selection"
          required
          :disabled="busy"
          class="mt-1 block w-full rounded-md border border-border bg-background p-2"
        >
          <option v-for="major in curricula" :key="major._id" :value="major._id">
            {{ major.degreeName }} · {{ major.name }} · Intake {{ intakeLabel(major) }}
          </option>
        </select></label
      >
      <button class="rounded-md border border-border px-4 py-2 text-sm" :disabled="busy || !selection">
        Load curriculum
      </button>
    </form>
    <p v-if="busy" role="status" class="mt-3 text-sm text-muted-foreground">Loading…</p>
    <template v-if="bundle">
      <div class="mt-5 rounded-md bg-muted p-4 text-sm">
        <p class="font-semibold">{{ bundle.major.name }} · Intake {{ intakeLabel(bundle.major) }}</p>
        <p class="mt-1">{{ bundle.major._id }} · {{ bundle.major.totalCU }} total CU</p>
        <p class="mt-2">
          Changes affect the rules used by plans linked to this curriculum. They do not move students to a
          different intake or add modules to their plans.
        </p>
        <p v-if="!bundle.major.requirementsAvailable" class="mt-2">
          Graduation requirements for this curriculum are not marked available.
        </p>
      </div>
      <div class="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div>
          <ul class="max-h-[600px] divide-y divide-border overflow-auto">
            <li v-for="row in records" :key="`${row.kind}:${row._id}`">
              <button
                class="w-full rounded-md p-3 text-left hover:bg-muted"
                :class="{ 'bg-muted': form?._id === row._id }"
                :disabled="busy"
                @click="edit(row)"
              >
                <span class="block text-xs text-muted-foreground">{{ row.scope }}</span
                ><span class="mt-1 block text-sm font-medium">{{ row.display }}</span>
              </button>
            </li>
          </ul>
          <p v-if="!records.length" class="text-sm text-muted-foreground">
            No track or requirement records are available for this curriculum yet.
          </p>
        </div>
        <form v-if="form" class="space-y-4" @submit.prevent="review = true">
          <h3 class="font-semibold">
            {{ form.kind === 'track' ? `Track ${form.trackCode}` : ruleNames[form.rule] }}
          </h3>
          <p class="break-all text-xs text-muted-foreground">{{ form._id }}</p>
          <p v-if="readOnly" class="rounded-md bg-muted p-3 text-sm">
            Read-only: this rule type is not supported by the planner checklist.
          </p>
          <fieldset :disabled="busy || review || readOnly" class="space-y-4 disabled:opacity-70">
            <template v-if="form.kind === 'track'">
              <label class="block text-sm"
                >Track name<input
                  v-model="form.name"
                  required
                  maxlength="300"
                  class="mt-1 block w-full rounded-md border border-border bg-background p-2"
              /></label>
              <label class="block text-sm"
                >Description<textarea
                  v-model="form.description"
                  rows="6"
                  maxlength="10000"
                  class="mt-1 block w-full rounded-md border border-border bg-background p-2"
                />
              </label>
              <label class="block text-sm"
                >Source URL<input
                  v-model="form.source"
                  type="url"
                  maxlength="2000"
                  class="mt-1 block w-full rounded-md border border-border bg-background p-2"
              /></label>
              <label class="block text-sm"
                >Last checked<input
                  v-model="form.lastChecked"
                  type="date"
                  class="mt-1 block w-full rounded-md border border-border bg-background p-2"
              /></label>
              <p class="text-xs text-muted-foreground">
                Track codes and curriculum identity are fixed. This does not change the Track Finder scoring
                rubric or add new quiz tracks.
              </p>
            </template>
            <template v-else>
              <label class="block text-sm"
                >Requirement label<input
                  v-model="form.label"
                  required
                  maxlength="300"
                  class="mt-1 block w-full rounded-md border border-border bg-background p-2"
              /></label>
              <div v-if="['all', 'chooseN'].includes(form.rule)" class="text-sm">
                <span class="mb-1 block">Modules</span>
                <ChipSelect
                  v-model="form.modules"
                  :options="moduleOptions"
                  placeholder="Search and tick modules"
                />
                <span class="mt-1 block text-xs text-muted-foreground"
                  >{{
                    form.rule === 'all'
                      ? 'Every listed course is required.'
                      : 'Students choose from this list.'
                  }}
                  New additions must be active catalogue modules.</span
                >
              </div>
              <label v-if="form.rule === 'chooseN'" class="block text-sm"
                >Number of courses<input
                  v-model="form.n"
                  required
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  class="mt-1 block w-full rounded-md border border-border bg-background p-2"
              /></label>
              <label class="block text-sm"
                >Required credit units<input
                  v-model="form.cuRequired"
                  required
                  :readonly="form.rule === 'flag'"
                  type="number"
                  min="0"
                  max="100"
                  step="0.25"
                  class="mt-1 block w-full rounded-md border border-border bg-background p-2"
                /><span class="mt-1 block text-xs text-muted-foreground">{{
                  form.rule === 'flag'
                    ? 'Non-credit requirements use zero CU.'
                    : 'Use the official credit target; course count and credit units are separate fields.'
                }}</span></label
              >
              <div v-if="form.rule === 'anyFromCategory'" class="text-sm">
                <span class="mb-1 block">Catalogue categories</span>
                <ChipSelect
                  v-model="form.categories"
                  :options="categoryOptions"
                  placeholder="Search and tick categories"
                />
              </div>
              <div v-if="['basket', 'flag'].includes(form.rule)" class="text-sm">
                <span class="mb-1 block">Requirement tag</span>
                <SelectMenu
                  v-model="form.tag"
                  :options="tagOptions"
                  searchable
                  placeholder="Search requirement tags"
                />
              </div>
              <label v-if="form.rule === 'flag'" class="flex items-center gap-2 text-sm"
                ><input v-model="form.autoFulfilled" type="checkbox" />Automatically fulfilled</label
              >
              <details class="rounded-md border border-border p-3">
                <summary class="cursor-pointer text-sm font-medium">Grouping and credit allocation</summary>
                <label class="mt-3 block text-sm"
                  >Group heading<input
                    v-model="form.heading"
                    maxlength="300"
                    class="mt-1 block w-full rounded-md border border-border bg-background p-2"
                /></label>
                <label class="mt-3 block text-sm"
                  >Display order<input
                    v-model="form.order"
                    required
                    type="number"
                    min="0"
                    max="10000"
                    step="1"
                    class="mt-1 block w-full rounded-md border border-border bg-background p-2"
                /></label>
                <label class="mt-3 block text-sm"
                  >Credits count toward<select
                    v-model="form.countsToward"
                    class="mt-1 block w-full rounded-md border border-border bg-background p-2"
                  >
                    <option v-for="(name, key) in creditCategories" :key="key" :value="key">
                      {{ name }}
                    </option>
                  </select></label
                >
              </details>
              <p class="text-xs text-muted-foreground">
                The rule type, owner and level are fixed in this editor. Check official curriculum
                requirements before changing credit targets or module membership.
              </p>
            </template>
          </fieldset>
          <div v-if="review" class="rounded-md border border-primary bg-muted p-4 text-sm">
            <h4 class="font-semibold">Review curriculum change</h4>
            <p class="mt-2">
              {{ form.kind === 'track' ? form.name : form.label }} · {{ bundle.major.name }} · Intake
              {{ intakeLabel(bundle.major) }}
            </p>
            <p class="mt-2">
              Confirm the fields above. This updates the shared curriculum and records your change in staff
              history. Existing plans may receive different requirement-check results after reloading.
            </p>
            <p v-if="error" role="alert" class="mt-2 text-destructive">{{ error }}</p>
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
          <p v-if="dirty && missingPick" class="text-sm text-destructive">{{ missingPick }}</p>
          <button
            v-if="!review && !readOnly"
            class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            :disabled="busy || !dirty || !!missingPick"
          >
            Review changes
          </button>
        </form>
        <p v-else class="rounded-md bg-muted p-5 text-sm text-muted-foreground">
          Choose a track or requirement to edit.
        </p>
      </div>
    </template>
  </section>
</template>
