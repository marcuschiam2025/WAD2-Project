<script setup>
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import { api } from '@core/services/api'
import { useUserStore } from '@core/stores/user'

const emit = defineEmits(['saved'])
const user = useUserStore()
const items = ref([]), query = ref(''), next = ref(null), error = ref(''), busy = ref(false)
const operation = ref(''), confirmCode = ref('')
const form = ref(null), original = ref(null), review = ref(false), creating = ref(false), saved = ref('')
let generation = 0
const empty = () => ({ code: '', title: '', cu: 1, schoolId: '', department: '', description: '', categories: '', fulfils: '', prerequisites: '', corequisites: '', mutuallyExclusive: '', requisiteNotes: '', termsOffered: '', trackCount: '', revision: 0 })
const split = value => value.split(',').map(v => v.trim()).filter(Boolean)
const groups = value => value.split('\n').filter(line => line.trim()).map(split)
const lines = value => value.split('\n').map(v => v.trim()).filter(Boolean)
function payload() {
  const f = form.value
  return { title: f.title, cu: Number(f.cu), schoolId: f.schoolId || null, department: f.department, description: f.description,
    categories: split(f.categories), fulfils: split(f.fulfils), prerequisites: groups(f.prerequisites), corequisites: groups(f.corequisites), mutuallyExclusive: split(f.mutuallyExclusive), requisiteNotes: lines(f.requisiteNotes), termsOffered: split(f.termsOffered),
    prerequisiteRules: f.trackCount === '' ? [] : [{ countFrom: 'TRACK', n: Number(f.trackCount) }],
  }
}
function fill(row) {
  const f = { ...empty(), ...row, code: row._id, revision: row.revision ?? 0 }
  for (const key of ['categories', 'fulfils', 'mutuallyExclusive', 'termsOffered']) f[key] = (row[key] ?? []).join(', ')
  for (const key of ['prerequisites', 'corequisites']) f[key] = (row[key] ?? []).map(group => group.join(', ')).join('\n')
  f.requisiteNotes = (row.requisiteNotes ?? []).join('\n')
  f.trackCount = row.prerequisiteRules?.length ? Math.max(...row.prerequisiteRules.map(rule => rule.n)) : ''
  return f
}
const dirty = computed(() => form.value && JSON.stringify(form.value) !== JSON.stringify(original.value))
function discardAllowed() { return !dirty.value || window.confirm('Discard your unsaved module changes?') }
async function run(action) {
  if (busy.value) return
  const version = ++generation, uid = user.uid
  busy.value = true; error.value = ''; saved.value = ''
  const current = () => version === generation && uid === user.uid && user.profile.role === 'admin'
  try { await action(current) } catch (failure) { if (current()) error.value = failure.message }
  finally { if (version === generation) busy.value = false }
}
async function search(more = false) {
  await run(async current => {
    const result = await api.adminModules({ q: query.value, after: more ? next.value : undefined })
    if (!current()) return
    items.value = more ? [...items.value, ...result.items] : result.items; next.value = result.next
  })
}
async function edit(code) {
  if (!discardAllowed()) return
  await run(async current => {
    const row = await api.adminModule(code)
    if (!current()) return
    form.value = fill(row); original.value = JSON.parse(JSON.stringify(form.value)); creating.value = false; review.value = false; operation.value = ''
  })
}
function add() {
  if (busy.value || !discardAllowed()) return
  operation.value = ''; creating.value = true; form.value = empty(); original.value = null; review.value = false; error.value = ''; saved.value = ''
}
async function save() {
  await run(async current => {
    const data = payload()
    const row = creating.value ? await api.createAdminModule({ code: form.value.code, ...data }) : await api.updateAdminModule(form.value.code, { ...data, revision: form.value.revision })
    if (!current()) return
    form.value = fill(row); original.value = JSON.parse(JSON.stringify(form.value)); creating.value = false; review.value = false; operation.value = ''
    saved.value = 'Module saved. Students receive the updated details when they reload the catalogue.'
    const index = items.value.findIndex(item => item._id === row._id)
    if (index >= 0) items.value[index] = row
    else items.value = [row, ...items.value]
    emit('saved')
  })
}
function requestLifecycle(action) {
  if (busy.value || !discardAllowed()) return
  // Lifecycle changes act on the loaded revision, never on unsaved form edits.
  if (original.value) form.value = JSON.parse(JSON.stringify(original.value))
  operation.value = action; confirmCode.value = ''; review.value = false; error.value = ''
}
async function applyLifecycle() {
  const action = operation.value
  if (action === 'delete' && confirmCode.value !== form.value.code) return
  await run(async current => {
    const code = form.value.code, revision = form.value.revision
    const fn = { archive: api.archiveAdminModule, restore: api.restoreAdminModule, delete: api.deleteAdminModule }[action]
    const row = await fn(code, revision)
    if (!current()) return
    operation.value = ''
    if (action === 'delete') {
      items.value = items.value.filter(item => item._id !== code); form.value = null; original.value = null
      saved.value = `${code} permanently deleted. Its audit history is retained.`
    } else {
      form.value = fill(row); original.value = JSON.parse(JSON.stringify(form.value))
      const index = items.value.findIndex(item => item._id === code)
      if (index >= 0) items.value[index] = row
      saved.value = action === 'archive' ? `${code} archived. Existing student records are retained. Students see this change after reloading.` : `${code} restored to the active catalogue.`
    }
    emit('saved')
  })
}
function beforeUnload(event) { if (dirty.value) { event.preventDefault(); event.returnValue = '' } }
watch(() => user.uid, () => { generation++; form.value = null; original.value = null; items.value = []; review.value = false; operation.value = ''; busy.value = false; error.value = ''; saved.value = '' })
onMounted(() => { search(); window.addEventListener('beforeunload', beforeUnload) })
onBeforeUnmount(() => { generation++; window.removeEventListener('beforeunload', beforeUnload) })
</script>

<template>
  <section class="mt-8 rounded-lg border border-border bg-card p-5" aria-labelledby="modules-heading">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="modules-heading" class="text-xl font-semibold">Modules</h2><p class="mt-1 text-sm text-muted-foreground">Course details and requisites. Schedules and curriculum membership are managed separately.</p></div>
      <button class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" :disabled="busy" @click="add">New module</button>
    </div>
    <p v-if="error" role="alert" class="mt-4 rounded-md border border-destructive p-3 text-sm text-destructive">{{ error }} <button v-if="form && !creating" class="ml-2 underline" :disabled="busy" @click="edit(form.code)">Reload saved record</button></p>
    <p v-if="saved" role="status" class="mt-4 rounded-md bg-muted p-3 text-sm">{{ saved }}</p>
    <div class="mt-5 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div>
        <form class="flex gap-2" @submit.prevent="search()"><label class="sr-only" for="module-search">Search modules</label><input id="module-search" v-model="query" placeholder="Code or title" maxlength="100" class="min-w-0 flex-1 rounded-md border border-border bg-background p-2 text-sm"/><button class="rounded-md border border-border px-3 text-sm" :disabled="busy">Search</button></form>
        <p v-if="busy" role="status" class="mt-3 text-sm text-muted-foreground">Loading…</p>
        <ul class="mt-3 max-h-[500px] overflow-auto divide-y divide-border">
          <li v-for="item in items" :key="item._id"><button class="w-full rounded-md p-3 text-left hover:bg-muted disabled:opacity-50" :class="{ 'bg-muted': form?.code === item._id }" :disabled="busy" @click="edit(item._id)"><span class="block text-sm font-semibold">{{ item._id }} <span v-if="item.archived" class="ml-1 text-xs font-normal text-muted-foreground">Archived</span></span><span class="mt-1 block text-sm text-muted-foreground">{{ item.title }}</span></button></li>
        </ul>
        <p v-if="!busy && !items.length" class="mt-4 text-sm text-muted-foreground">No modules found.</p>
        <button v-if="next" class="mt-3 rounded-md border border-border px-3 py-2 text-sm" :disabled="busy" @click="search(true)">Load more</button>
      </div>
      <form v-if="form" class="space-y-4" @submit.prevent="review = true">
        <h3 class="font-semibold">{{ creating ? 'Create module' : `Edit ${form.code}` }}</h3>
        <p v-if="form.archived" class="rounded-md bg-muted p-3 text-sm">Archived — hidden from module discovery. Existing records remain readable.</p>
        <fieldset :disabled="busy || review || !!operation" class="space-y-4 disabled:opacity-70">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block text-sm">Module code<input v-model="form.code" :readonly="!creating" required pattern="[A-Z][A-Z0-9._\-]{1,39}" maxlength="40" class="mt-1 block w-full rounded-md border border-border bg-background p-2"/><span class="mt-1 block text-xs text-muted-foreground">Code is fixed after creation.</span></label>
            <label class="block text-sm">Credit units<input v-model="form.cu" required type="number" min="0" max="10" step="0.25" class="mt-1 block w-full rounded-md border border-border bg-background p-2"/></label>
          </div>
          <label class="block text-sm">Title<input v-model="form.title" required maxlength="300" class="mt-1 block w-full rounded-md border border-border bg-background p-2"/></label>
          <label class="block text-sm">Description<textarea v-model="form.description" rows="4" maxlength="20000" class="mt-1 block w-full rounded-md border border-border bg-background p-2"/></label>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block text-sm">School ID<input v-model="form.schoolId" placeholder="e.g. SCIS" class="mt-1 block w-full rounded-md border border-border bg-background p-2"/></label>
            <label class="block text-sm">Department<input v-model="form.department" placeholder="e.g. SIS" class="mt-1 block w-full rounded-md border border-border bg-background p-2"/></label>
          </div>
          <details class="rounded-md border border-border p-3" open><summary class="cursor-pointer text-sm font-medium">Prerequisites and restrictions</summary>
            <p class="my-3 text-xs text-muted-foreground">Each line is required. Within a line, any one of the comma-separated module codes is enough. For example, IS111, CS101 on the first line and IS112 on the second means (IS111 OR CS101) AND IS112.</p>
            <div class="grid gap-4 sm:grid-cols-2"><label class="block text-sm">Prerequisites<textarea v-model="form.prerequisites" rows="3" class="mt-1 block w-full rounded-md border border-border bg-background p-2"/></label><label class="block text-sm">Corequisites<textarea v-model="form.corequisites" rows="3" class="mt-1 block w-full rounded-md border border-border bg-background p-2"/><span class="text-xs text-muted-foreground">May be completed already or taken in the same term.</span></label></div>
            <label class="mt-4 block text-sm">Mutually exclusive modules<input v-model="form.mutuallyExclusive" placeholder="Comma-separated codes" class="mt-1 block w-full rounded-md border border-border bg-background p-2"/></label>
            <label class="mt-4 block text-sm">Minimum completed track courses<input v-model="form.trackCount" type="number" min="1" max="100" step="1" placeholder="Leave blank if none" class="mt-1 block w-full rounded-md border border-border bg-background p-2"/></label>
            <label class="mt-4 block text-sm">Other requisite notes<textarea v-model="form.requisiteNotes" rows="2" placeholder="One note per line, e.g. instructor permission required" class="mt-1 block w-full rounded-md border border-border bg-background p-2"/></label>
          </details>
          <details class="rounded-md border border-border p-3"><summary class="cursor-pointer text-sm font-medium">Catalogue tags and offering terms</summary>
            <p class="mt-3 text-xs text-muted-foreground">Use existing catalogue tags. These affect graduation checks; adding a tag does not add a module to a track curriculum.</p>
            <label v-for="[key, label, hint] in [['categories', 'Categories', 'e.g. IS, IS_TRACK'], ['fulfils', 'Requirement tags', 'e.g. CORE:MANAGING'], ['termsOffered', 'Terms offered', 'T1, T2 or T3; blank if unknown']]" :key="key" class="mt-3 block text-sm">{{ label }}<input v-model="form[key]" :placeholder="hint" class="mt-1 block w-full rounded-md border border-border bg-background p-2"/></label>
          </details>
        </fieldset>
        <div v-if="review" class="rounded-md border border-primary bg-muted p-4 text-sm">
          <h4 class="font-semibold">Review {{ form.code }}</h4><p class="mt-2">{{ form.title }} · {{ form.cu }} CU</p>
          <p class="mt-2">This saves all the fields above to the shared catalogue and records your change in staff history. Existing student plans remain saved.</p>
          <div class="mt-4 flex gap-3"><button type="button" class="rounded-md bg-primary px-4 py-2 text-primary-foreground" :disabled="busy" @click="save">{{ busy ? 'Saving…' : 'Confirm save' }}</button><button type="button" class="rounded-md border border-border px-4 py-2" :disabled="busy" @click="review = false">Back to editing</button></div>
        </div>
        <button v-else-if="!operation" type="submit" class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" :disabled="busy || !dirty">Review changes</button>
        <div v-if="!creating && !review && !operation" class="flex flex-wrap gap-3 border-t border-border pt-4 text-sm">
          <button v-if="!form.archived" type="button" class="rounded-md border border-border px-3 py-2" :disabled="busy" @click="requestLifecycle('archive')">Archive module</button>
          <template v-else>
            <button type="button" class="rounded-md border border-border px-3 py-2" :disabled="busy" @click="requestLifecycle('restore')">Restore module</button>
            <button type="button" class="rounded-md border border-destructive px-3 py-2 text-destructive" :disabled="busy" @click="requestLifecycle('delete')">Permanently delete…</button>
          </template>
        </div>
        <div v-if="operation" class="rounded-md border border-border bg-muted p-4 text-sm" role="region" aria-label="Confirm module action">
          <h4 class="font-semibold">{{ operation === 'delete' ? 'Permanently delete' : operation === 'archive' ? 'Archive' : 'Restore' }} {{ form.code }}?</h4>
          <p v-if="operation === 'archive'" class="mt-2">Remove it from module searches and new quiz recommendations. Existing plans, requirements and history remain readable. You can restore it later.</p>
          <p v-else-if="operation === 'restore'" class="mt-2">Make this course discoverable again. This does not create class sections or change track membership.</p>
          <template v-else><p class="mt-2">Only unused modules created by staff can be deleted. The server checks catalogue and student references before deleting. Original seeded modules must remain archived.</p><label class="mt-3 block">Type {{ form.code }} to confirm<input v-model="confirmCode" autocomplete="off" class="mt-1 block w-full rounded-md border border-border bg-background p-2"/></label></template>
          <div class="mt-4 flex gap-3"><button type="button" class="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" :disabled="busy || (operation === 'delete' && confirmCode !== form.code)" @click="applyLifecycle">{{ busy ? 'Saving…' : 'Confirm' }}</button><button type="button" class="rounded-md border border-border px-4 py-2" :disabled="busy" @click="operation = ''">Cancel</button></div>
        </div>
      </form>
      <p v-else class="rounded-md bg-muted p-6 text-sm text-muted-foreground">Select a module to edit its details, or create a new module.</p>
    </div>
  </section>
</template>
