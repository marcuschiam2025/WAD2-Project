<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useBiddingStore } from '@core/stores/bidding'
import { useUserStore } from '@core/stores/user'
import { usePlannerStore } from '@core/stores/planner'
import { api } from '@core/services/api'
import { useCalendarExportStore } from '@core/stores/calendarExport'
import { moduleName } from '@core/data/catalogue'
import { termLabel } from '@core/data/bidding'
import { buildIcs, downloadFile, hasTeachingDates } from '@core/utils/ics'
import { findClashes, findExamClashes } from '@core/utils/clash'
import { fmtE } from '@core/utils/money'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import DeletePlanModal from '@/components/modals/DeletePlanModal.vue'

const bidding = useBiddingStore()
const user = useUserStore()
const planner = usePlannerStore()
const copies = ref([])
const loading = ref(false)
const error = ref('')
const calendarExport = useCalendarExportStore()
const { error: exportError, message: exportMessage, adding } = storeToRefs(calendarExport)
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
watch(() => [user.uid, user.isSignedIn, bidding.round.term], () => {
  termStart.value = ''
  weeks.value = 13
  load()
}, { immediate: true })
onBeforeUnmount(() => { revision++; calendarExport.cancel() })
const modules = computed(() => [...new Set(copies.value.flatMap(copy => copy.items.map(item => item.module)))])
const cell = (copy, code) => copy.items.find(item => item.module === code)
const schedule = copy => copy.items.map(item => item.section).filter(Boolean)
// Sections carry their own teaching dates; only plans with a section missing them need the manual dates
const needsDates = copy => schedule(copy).some(section => !hasTeachingDates(section))
const anyNeedsDates = computed(() => copies.value.some(needsDates))
function blocked(copy) {
  if (!copy.items.length) return 'This saved cart is empty.'
  if (schedule(copy).some(section => section.archived)) return 'This saved cart contains an archived section. Review it in bidding before exporting.'
  if (copy.missingModules.length) return `Section data is unavailable for ${copy.missingModules.join(', ')}. Update this cart before exporting.`
  if (findClashes(schedule(copy)).length || findExamClashes(schedule(copy)).length) return 'Saved sections now clash. Review this cart before exporting.'
  return ''
}
// Adds the plan's classes straight into the student's Google Calendar, next to their other commitments
async function addToGoogle(copy) {
  exportError.value = ''
  exportMessage.value = ''
  const reason = blocked(copy)
  if (reason) { exportError.value = reason; return }
  await calendarExport.addToGoogle(copy, termStart.value, weeks.value)
}
function exportCopy(copy) {
  exportError.value = ''
  exportMessage.value = ''
  try {
    const reason = blocked(copy)
    if (reason) throw new Error(reason)
    const calendar = buildIcs(schedule(copy).map(section => ({...section,name:moduleName(section.module)})), termStart.value, weeks.value)
    downloadFile(`bidmaxxer-${copy.planId}-${copy.term}.ics`, calendar)
  } catch (err) { exportError.value = err.message }
}

// Deleting a saved plan deletes the plan itself (What-If plan and its saved bids); the backend always keeps at least one plan
const planToDelete = ref(null)
async function confirmDelete() {
  if (!(await planner.deletePlan(planToDelete.value.planId))) return
  planToDelete.value = null
  await load()
}
</script>

<template>
  <div>
    <PageHeader :overline="bidding.roundInfo.term" title="Saved bidding plans" subtitle="Compare your saved section choices and download a calendar file.">
      <template #actions><BaseButton variant="outline" :to="`/bidding?plan=${bidding.planId || ''}`">Back to bidding</BaseButton></template>
    </PageHeader>
    <main class="flex flex-col gap-6 px-5 py-8 md:px-8 lg:px-16">
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
          <h2 class="text-lg font-semibold">Calendar export</h2>
          <p class="text-sm text-muted-foreground">Each class repeats weekly between its section's start and end dates from the class timetable, including recess weeks and public holidays; adjust those dates after adding them. Final exams are not included.</p>
          <template v-if="anyNeedsDates">
            <p class="text-sm">Some saved sections have no teaching dates yet. Enter your official teaching schedule for those.</p>
            <div class="flex flex-wrap gap-4">
              <label class="flex flex-col gap-1 text-sm">Monday of first teaching week<input v-model="termStart" type="date" class="rounded-md border border-border p-2" /></label>
              <label class="flex flex-col gap-1 text-sm">Consecutive weeks<input v-model.number="weeks" type="number" min="1" max="20" class="w-32 rounded-md border border-border p-2" /></label>
            </div>
          </template>
          <p class="text-xs text-muted-foreground">"Add to Google Calendar" asks Google for permission to add events, then puts the classes straight into your calendar so you can see them next to your other commitments. Or download the .ics file for Google Calendar, Outlook or Apple Calendar. Adding the same plan twice creates duplicates.</p>
          <p v-if="exportMessage" role="status" class="text-sm text-success">{{ exportMessage }}</p>
          <p v-if="exportError" role="alert" class="text-sm text-destructive">{{ exportError }}</p>
        </section>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article v-for="copy in copies" :key="copy.id" class="card flex flex-col gap-3 p-5">
            <h2 class="text-lg font-semibold">{{ copy.name }}</h2>
            <p class="font-mono text-xl font-semibold">e$ {{ fmtE(copy.allocated) }} <span class="text-sm font-normal">saved bids</span></p>
            <p class="text-sm text-muted-foreground">{{ copy.items.length }} modules · {{ termLabel(copy.term) }}</p>
            <p v-if="copy.updatedAt" class="text-xs text-muted-foreground">Saved {{ new Date(copy.updatedAt).toLocaleString() }}</p>
            <p v-if="blocked(copy)" class="text-sm text-destructive">{{ blocked(copy) }}</p>
            <BaseButton :disabled="!!blocked(copy) || (needsDates(copy) && !termStart) || adding !== null" @click="addToGoogle(copy)">{{ adding === copy.id ? 'Adding to Google Calendar…' : 'Add to Google Calendar' }}</BaseButton>
            <BaseButton v-if="adding === copy.id" variant="ghost" size="sm" @click="calendarExport.cancel()">Cancel</BaseButton>
            <BaseButton variant="outline" :disabled="!!blocked(copy) || (needsDates(copy) && !termStart)" @click="exportCopy(copy)">Download calendar (.ics)</BaseButton>
            <BaseButton variant="outline" :to="`/bidding?plan=${copy.planId}`">Edit bids</BaseButton>
            <BaseButton variant="destructive-outline" :disabled="!planner.online || planner.planActionPending || planner.plans.length <= 1" :title="planner.plans.length <= 1 ? 'You need at least one plan' : undefined" @click="planToDelete = copy">Delete plan</BaseButton>
          </article>
        </div>
        <p v-if="copies.length > 1" class="text-[12px] text-muted-foreground md:hidden">Swipe the table sideways to compare your plans.</p>
        <section class="card overflow-x-auto" aria-label="Saved section comparison">
          <table class="w-full text-left text-sm">
            <thead class="bg-muted"><tr><th class="sticky left-0 z-10 bg-muted p-4">Module</th><th v-for="copy in copies" :key="copy.id" class="p-4">{{ copy.name }}</th></tr></thead>
            <tbody><tr v-for="code in modules" :key="code" class="border-t border-border">
              <th class="sticky left-0 z-10 max-w-[130px] bg-card p-4 md:max-w-none"><span class="font-mono">{{ code }}</span><span class="block font-normal">{{ moduleName(code) }}</span></th>
              <td v-for="copy in copies" :key="copy.id" class="min-w-52 p-4">
                <template v-if="cell(copy,code)"><p>{{ cell(copy,code).section?.section || 'Section unavailable' }} · e$ {{ fmtE(cell(copy,code).amount) }}</p><p v-if="cell(copy,code).section" class="mt-1 text-xs text-muted-foreground">{{ bidding.slotLabel(cell(copy,code).section) }}</p></template>
                <span v-else class="text-muted-foreground">Not in this cart</span>
              </td>
            </tr></tbody>
          </table>
        </section>
      </template>
    </main>
    <DeletePlanModal v-if="planToDelete" :plan-name="planToDelete.name" detail="from the What-If Planner, along with its saved bids" @close="planToDelete = null" @confirm="confirmDelete" />
  </div>
</template>
