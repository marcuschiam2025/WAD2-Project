<script setup>
// Profile: who the student is and their degree details from onboarding, edited right here (DegreeForm).
import { computed, ref } from 'vue'
import { useUserStore } from '@core/stores/user'
import { moduleName, trackName } from '@core/data/catalogue'
import { SEM_IDS, MARK_DONE } from '@core/data/degree'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import DegreeForm from '@/components/DegreeForm.vue'

const user = useUserStore()

// Editing opens the degree form inside the card. Saving updates the profile and every What-If plan.
const editingDegree = ref(false)
const savedNote = ref(false)
let noteTimer
function degreeSaved() {
  editingDegree.value = false
  savedNote.value = true
  clearTimeout(noteTimer)
  noteTimer = setTimeout(() => (savedNote.value = false), 5000)
}

// What the student told us in onboarding
const degree = computed(() => {
  const p = user.profile
  return {
    sem: p.currentSem ?? `Y${p.year}S1`,
    tracks: p.tracks?.length ? p.tracks.map((c) => trackName(c === 'SMT' ? 'SMCT' : c)).join(' + ') : 'Undecided',
    taken: SEM_IDS.filter((id) => p.takenBySem?.[id]?.length).map((id) => ({ id, codes: p.takenBySem[id] })),
    exempted: p.exempted ?? [],
    freeExempt: p.freeExemptions ?? 0,
    markedDone: (p.markedDone ?? []).filter((id) => id in MARK_DONE),
  }
})
</script>

<template>
  <div>
    <PageHeader overline="Account" title="Profile" />

    <main class="flex flex-col gap-6 px-16 pt-8 pb-12">
      <section v-enter class="card flex items-center gap-4 p-6"> <!-- motion: profile header fades in on mount -->
        <UserAvatar :initials="user.profile.initials" :size="64" />
        <div class="flex flex-col gap-1 leading-normal">
          <p class="text-[18px] font-semibold">{{ user.profile.displayName }}</p>
          <p class="text-[13px] text-muted-foreground">
            {{ user.profile.email }} · BSc {{ user.profile.major }} · Y{{ user.profile.year }}
          </p>
        </div>
      </section>

      <!-- Degree details from onboarding: current semester, tracks, modules taken, exemptions -->
      <section v-enter="0.05" class="card flex flex-col gap-4 p-6"> <!-- motion: degree card fades in, 50ms delay -->
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-0.5 leading-normal">
            <h2 class="text-h3">Degree details</h2>
            <p class="text-[14px] text-muted-foreground">
              Your semester, tracks and modules taken. Changes update every What-If plan.
            </p>
          </div>
          <span v-if="savedNote" class="rounded-md bg-success-tint px-2.5 py-1 text-[13px] font-medium">Saved. Your What-If plans are updated.</span>
          <BaseButton v-else-if="!editingDegree" variant="outline" @click="editingDegree = true">Edit</BaseButton>
        </div>
        <DegreeForm v-if="editingDegree" mode="edit" @saved="degreeSaved" @cancel="editingDegree = false" />
        <dl v-else class="grid grid-cols-[160px_1fr] gap-x-6 gap-y-3 text-[14px] leading-normal">
          <dt class="text-muted-foreground">Current semester</dt>
          <dd class="font-mono font-bold">{{ degree.sem }}</dd>
          <dt class="text-muted-foreground">Tracks</dt>
          <dd class="font-medium">{{ degree.tracks }}</dd>
          <dt class="text-muted-foreground">Modules taken</dt>
          <dd class="flex flex-col gap-1.5">
            <p v-for="t in degree.taken" :key="t.id" class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span class="w-12 shrink-0 font-mono text-[12px] font-bold text-muted-foreground">{{ t.id }}</span>
              <span v-if="t.id === degree.sem" class="rounded-sm bg-warning-tint px-1.5 py-px text-[11px] font-medium text-warning">In progress</span>
              <span v-for="code in t.codes" :key="code" class="rounded-sm bg-secondary px-1.5 py-px text-[12.5px]" :title="moduleName(code)">
                <span class="font-mono font-bold">{{ code }}</span> {{ moduleName(code) }}
              </span>
            </p>
            <span v-if="!degree.taken.length" class="text-muted-foreground">None yet</span>
          </dd>
          <dt class="text-muted-foreground">Exemptions</dt>
          <dd class="flex flex-wrap gap-1.5">
            <span v-for="code in degree.exempted" :key="code" class="rounded-sm bg-secondary px-1.5 py-px text-[12.5px]">
              <span class="font-mono font-bold">{{ code }}</span> {{ moduleName(code) }}
            </span>
            <span v-if="degree.freeExempt" class="rounded-sm bg-secondary px-1.5 py-px text-[12.5px]">
              {{ degree.freeExempt }} free elective{{ degree.freeExempt === 1 ? '' : 's' }}
            </span>
            <span v-if="!degree.exempted.length && !degree.freeExempt" class="text-muted-foreground">None</span>
          </dd>
          <dt class="text-muted-foreground">Marked as done</dt>
          <dd class="flex flex-wrap gap-1.5">
            <span v-for="id in degree.markedDone" :key="id" class="flex items-center gap-1.5 rounded-sm bg-success-tint px-1.5 py-px text-[12.5px]">
              {{ MARK_DONE[id] }}
              <button
                type="button"
                :aria-label="`Undo: ${MARK_DONE[id]} is not done`"
                class="text-muted-foreground hover:text-foreground"
                @click="user.unmarkDone(id)"
              >✕</button>
            </span>
            <span v-if="!degree.markedDone.length" class="text-muted-foreground">
              None. Mark Internship, Community Service or Global Exposure as done from Outstanding Modules in the What-If Planner.
            </span>
          </dd>
        </dl>
      </section>
    </main>
  </div>
</template>
