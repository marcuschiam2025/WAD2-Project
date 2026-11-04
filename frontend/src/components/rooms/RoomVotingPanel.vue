<script setup>
// Right-hand side of a room: pick the module's sections you can attend on the weekly calendar, then submit.
// Submitted picks stay locked until "Unselect my picks". Votes load from and save to the backend, and refresh
// every 10 seconds while the page is visible. `dirty` (unsaved picks) is shared with the room decision panel.
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoomsStore } from '@core/stores/rooms'
import { moduleName } from '@core/data/catalogue'
import { termLabel } from '@core/data/bidding'
import BaseButton from '@/components/ui/BaseButton.vue'
import RoomSectionCalendar from './RoomSectionCalendar.vue'
const props = defineProps({ roomId: { type: String, required: true }, module: { type: String, required: true } })
const dirty = defineModel('dirty', { type: Boolean, default: false })
const rooms = useRoomsStore()
const board = computed(() => rooms.voteBoards[props.roomId])
const picks = ref([]), feedback = ref('')
// Saved picks that haven't been changed since: the calendar is locked until they are unselected
const submitted = computed(() => !dirty.value && (board.value?.mySectionIds?.length ?? 0) > 0)
const saving = computed(() => !!rooms.voteSaving[props.roomId])
// Once a section is picked in Room results, the votes behind it stay put
const sectionPicked = computed(() => !!board.value?.finalisedSection)
watch(() => props.roomId, id => { picks.value = []; dirty.value = false; feedback.value = ''; rooms.loadVotes(id) }, { immediate: true })
watch(board, value => { if (value && !dirty.value) picks.value = [...value.mySectionIds] })
function toggle(id) {
  if (submitted.value) return
  picks.value = picks.value.includes(id) ? picks.value.filter(pick => pick !== id) : [...picks.value, id]
  const saved = board.value?.mySectionIds ?? []
  dirty.value = picks.value.length !== saved.length || picks.value.some(id => !saved.includes(id))
  feedback.value = ''
}
async function save(ids = picks.value) {
  const roomId = props.roomId
  const ok = await rooms.saveRoomVotes(roomId, ids)
  if (roomId !== props.roomId) return
  if (ok) {
    dirty.value = false
    picks.value = [...rooms.voteBoards[roomId].mySectionIds]
    feedback.value = picks.value.length ? 'Your picks are submitted.' : 'Your picks are cleared. Pick again and submit.'
  }
}
// Clearing a vote is saving an empty set of picks
const unselect = () => { if (!sectionPicked.value) save([]) }
let timer
onMounted(() => { timer = setInterval(() => {
  if (document.visibilityState === 'visible' && !rooms.busy && !rooms.voteSaving[props.roomId] && !rooms.voteLoading[props.roomId]) rooms.loadVotes(props.roomId, { quiet: true })
}, 10000) })
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <section class="flex min-w-0 flex-1 flex-col gap-4 p-5" aria-labelledby="room-voting-heading">
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-0.5 leading-normal">
        <h2 id="room-voting-heading" class="text-h4">Modules for bid · {{ module }}</h2>
        <p class="text-[13px] text-muted-foreground">
          <template v-if="board">{{ termLabel(board.term) }} · </template>
          {{ submitted ? (sectionPicked ? "You've submitted these picks and picked a section, so your votes are locked." : "You've submitted these picks. Unselect them if you want to change your votes.") : "Pick every section you'd take. You can choose more than one." }}
        </p>
      </div>
      <div v-if="board?.rows.length" class="flex shrink-0 items-center gap-2">
        <span v-if="dirty" class="text-[12px] text-muted-foreground">Unsaved changes</span>
        <BaseButton v-if="submitted" variant="outline" :disabled="saving || sectionPicked" :title="sectionPicked ? 'Your votes are locked because you have picked a section' : undefined" @click="unselect">{{ saving ? 'Saving…' : 'Unselect my picks' }}</BaseButton>
        <BaseButton v-else :disabled="!dirty || saving" @click="save()">{{ saving ? 'Saving…' : 'Submit my picks' }}</BaseButton>
      </div>
    </div>

    <p v-if="!board && rooms.voteLoading[roomId]" role="status" class="text-[13px] text-muted-foreground">Loading available sections…</p>
    <p v-if="rooms.voteErrors[roomId]" role="alert" class="text-[13px] text-destructive">{{ rooms.voteErrors[roomId] }}</p>
    <template v-if="board">
      <p v-if="board.missingSectionIds?.length" class="text-[13px] text-destructive">Some previously selected sections are no longer available. Review and submit your picks again.</p>
      <p v-if="!board.rows.length" class="rounded-md bg-muted p-4 text-[13px]">
        No sections are available for {{ module }} {{ moduleName(module) }} in {{ termLabel(board.term) }}. Voting opens when its section data is added.
      </p>
      <template v-else>
        <RoomSectionCalendar :rows="board.rows" :selected="picks" :disabled="saving || submitted" @toggle="toggle" />
        <div class="flex flex-wrap items-center gap-5 text-[12px] text-muted-foreground">
          <span class="flex items-center gap-1.5"><span class="h-3 w-[18px] rounded-sm bg-primary" /> Selected section</span>
          <span class="flex items-center gap-1.5"><span class="h-3 w-[18px] rounded-sm border border-dashed border-border" /> Available section</span>
          <span>A section with several weekly classes is picked as a whole.</span>
        </div>
        <p v-if="feedback" role="status" class="text-[13px] text-success">{{ feedback }}</p>

        <details class="rounded-lg border border-border p-4">
          <summary class="cursor-pointer text-[14px] font-medium">Section details &amp; exams</summary>
          <fieldset :disabled="saving || submitted" class="mt-4 flex flex-col gap-3">
            <legend class="sr-only">Available sections</legend>
            <label v-for="row in board.rows" :key="row.section.id" class="flex cursor-pointer gap-3 rounded-md border p-4" :class="picks.includes(row.section.id) ? 'border-primary bg-primary-tint' : 'border-border'">
              <input type="checkbox" :checked="picks.includes(row.section.id)" class="mt-1 accent-primary" @change="toggle(row.section.id)" />
              <span class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="font-semibold">{{ row.section.module }} · {{ row.section.section }}</span>
                <span class="text-sm">{{ row.section.prof || 'Instructor not listed' }}</span>
                <span v-for="meeting in row.section.sessions" :key="`${meeting.day}:${meeting.start}`" class="text-sm text-muted-foreground">{{ ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][meeting.day] }} {{ meeting.start }}–{{ meeting.end }}<span v-if="meeting.venue"> · {{ meeting.venue }}</span></span>
                <span class="text-xs text-muted-foreground">Exam: {{ row.section.exam }}</span>
                <span class="mt-1 text-xs">{{ row.count }} {{ row.count === 1 ? 'vote' : 'votes' }}<span v-if="row.voters.length"> · {{ row.voters.map(person => person.name).join(', ') }}</span></span>
              </span>
            </label>
          </fieldset>
        </details>
      </template>
      <p class="text-[12px] text-muted-foreground">Room picks don't reserve a BOSS allocation.</p>
    </template>
  </section>
</template>
