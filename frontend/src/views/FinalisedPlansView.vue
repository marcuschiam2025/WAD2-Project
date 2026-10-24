<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useBiddingStore } from '@core/stores/bidding'
import { useUserStore } from '@core/stores/user'
import { api } from '@core/services/api'
import { moduleName } from '@core/data/catalogue'
import { buildIcs, downloadFile } from '@core/utils/ics'
import { findClashes, findExamClashes } from '@core/utils/clash'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const bidding = useBiddingStore()
const user = useUserStore()
const copies = ref([])
const loading = ref(false)
const error = ref('')
const exportError = ref('')
const termStart = ref('')
const weeks = ref(13)
let revision = 0
async function load() {
  const version = ++revision
  copies.value = []
  error.value = ''
  if (!user.isSignedIn || !bidding.round.term) { loading.value = false; return }
  loading.value = true
  try {
    const saved = await api.savedBidPlans(bidding.round.term)
    if (version === revision) copies.value = saved
  } catch (err) { if (version === revision) error.value = err.message }
  finally { if (version === revision) loading.value = false }
}
watch(() => [user.uid, bidding.round.term], load, { immediate: true })
onBeforeUnmount(() => { revision++ })
const modules = computed(() => [...new Set(copies.value.flatMap(copy => copy.items.map(item => item.module)))])
const cell = (copy, code) => copy.items.find(item => item.module === code)
const schedule = copy => copy.items.map(item => item.section).filter(Boolean)
function blocked(copy) {
  if (!copy.items.length) return 'This saved cart is empty.'
  if (copy.missingModules.length) return `Section data is unavailable for ${copy.missingModules.join(', ')}. Update this cart before exporting.`
  if (findClashes(schedule(copy)).length || findExamClashes(schedule(copy)).length) return 'Saved sections now clash. Review this cart before exporting.'
  return ''
}
function exportCopy(copy) {
  exportError.value = ''
  try {
    const reason = blocked(copy)
    if (reason) throw new Error(reason)
    const calendar = buildIcs(schedule(copy).map(section => ({...section,name:moduleName(section.module)})), termStart.value, weeks.value)
    downloadFile(`bidmaxxer-${copy.planId}-${copy.term}.ics`, calendar)
  } catch (err) { exportError.value = err.message }
}
</script>

<template>
  <div>
    <PageHeader :overline="bidding.roundInfo.term" title="Saved bidding plans" subtitle="Compare your saved section choices and download a calendar file.">
      <template #actions><BaseButton variant="outline" :to="`/bidding?plan=${bidding.planId || ''}`">Back to bidding</BaseButton></template>
    </PageHeader>
    <main class="flex flex-col gap-6 px-5 py-8 lg:px-16">
      <p class="rounded-lg border border-primary bg-primary-tint p-4 text-sm">These are your last saved bids for this catalogue term. They do not confirm course allocation in BOSS. Save changes in the bidding planner before returning here.</p>
      <p v-if="loading" role="status">Loading saved plans…</p>
      <div v-else-if="error" role="alert" class="card p-5"><p>{{ error }}</p><BaseButton class="mt-3" variant="outline" @click="load">Retry</BaseButton></div>
      <section v-else-if="!copies.length" class="card flex flex-col items-start gap-3 p-5">
        <h2 class="text-lg font-semibold">No saved bidding plans for this term</h2>
        <p class="text-sm text-muted-foreground">Choose available sections, enter your bids and save the cart in the bidding planner. A degree plan alone does not create a saved bid cart.</p>
        <BaseButton variant="outline" :to="`/bidding?plan=${bidding.planId || ''}`">Open bidding planner</BaseButton>
      </section>
      <template v-else>
        <section class="card flex flex-col gap-3 p-5">
          <h2 class="text-lg font-semibold">Calendar dates</h2>
          <p class="text-sm text-muted-foreground">Use your official teaching schedule. Downloads repeat each meeting weekly, including recess weeks and public holidays; adjust those dates after import. Final exams are not included.</p>
          <div class="flex flex-wrap gap-4">
            <label class="flex flex-col gap-1 text-sm">Monday of first teaching week<input v-model="termStart" type="date" class="rounded-md border border-border p-2" /></label>
            <label class="flex flex-col gap-1 text-sm">Consecutive weeks<input v-model.number="weeks" type="number" min="1" max="20" class="w-32 rounded-md border border-border p-2" /></label>
          </div>
          <p class="text-xs text-muted-foreground">Import the .ics file into Google Calendar, Outlook or Apple Calendar. Re-importing may create duplicates.</p>
          <p v-if="exportError" role="alert" class="text-sm text-destructive">{{ exportError }}</p>
        </section>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article v-for="copy in copies" :key="copy.id" class="card flex flex-col gap-3 p-5">
            <h2 class="text-lg font-semibold">{{ copy.name }}</h2>
            <p class="font-mono text-xl font-semibold">e$ {{ copy.allocated }} <span class="text-sm font-normal">saved bids</span></p>
            <p class="text-sm text-muted-foreground">{{ copy.items.length }} modules · {{ copy.term }}</p>
            <p v-if="copy.updatedAt" class="text-xs text-muted-foreground">Saved {{ new Date(copy.updatedAt).toLocaleString() }}</p>
            <p v-if="blocked(copy)" class="text-sm text-destructive">{{ blocked(copy) }}</p>
            <BaseButton :disabled="!!blocked(copy) || !termStart" @click="exportCopy(copy)">Download calendar (.ics)</BaseButton>
            <BaseButton variant="outline" :to="`/bidding?plan=${copy.planId}`">Edit bids</BaseButton>
          </article>
        </div>
        <section class="card overflow-x-auto" aria-label="Saved section comparison">
          <table class="w-full text-left text-sm">
            <thead class="bg-muted"><tr><th class="p-4">Module</th><th v-for="copy in copies" :key="copy.id" class="p-4">{{ copy.name }}</th></tr></thead>
            <tbody><tr v-for="code in modules" :key="code" class="border-t border-border">
              <th class="p-4"><span class="font-mono">{{ code }}</span><span class="block font-normal">{{ moduleName(code) }}</span></th>
              <td v-for="copy in copies" :key="copy.id" class="min-w-52 p-4">
                <template v-if="cell(copy,code)"><p>{{ cell(copy,code).section?.section || 'Section unavailable' }} · e$ {{ cell(copy,code).amount }}</p><p v-if="cell(copy,code).section" class="mt-1 text-xs text-muted-foreground">{{ bidding.slotLabel(cell(copy,code).section) }}</p></template>
                <span v-else class="text-muted-foreground">Not in this cart</span>
              </td>
            </tr></tbody>
          </table>
        </section>
      </template>
    </main>
  </div>
</template>
