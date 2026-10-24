<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoomsStore } from '@core/stores/rooms'
import BaseButton from '@/components/ui/BaseButton.vue'
import RoomSectionCalendar from './RoomSectionCalendar.vue'
import RoomResults from './RoomResults.vue'
const props = defineProps({ roomId: { type: String, required: true } })
const rooms = useRoomsStore()
const board = computed(() => rooms.voteBoards[props.roomId])
const picks = ref([]), dirty = ref(false), feedback = ref('')
watch(() => props.roomId, id => { picks.value = []; dirty.value = false; feedback.value = ''; rooms.loadVotes(id) }, { immediate: true })
watch(board, value => { if (value && !dirty.value) picks.value = [...value.mySectionIds] })
function toggle(id) {
  picks.value = picks.value.includes(id) ? picks.value.filter(pick => pick !== id) : [...picks.value, id]
  const saved = board.value?.mySectionIds ?? []
  dirty.value = picks.value.length !== saved.length || picks.value.some(id => !saved.includes(id))
  feedback.value = ''
}
async function save() {
  const roomId = props.roomId
  const ok = await rooms.saveRoomVotes(roomId, picks.value)
  if (roomId !== props.roomId) return
  if (ok) {
    dirty.value = false
    picks.value = [...rooms.voteBoards[roomId].mySectionIds]
    feedback.value = picks.value.length ? 'Your section choices are saved.' : 'Your section choices have been cleared.'
  }
}
let timer
onMounted(() => { timer = setInterval(() => {
  if (document.visibilityState === 'visible' && !rooms.busy && !rooms.voteSaving[props.roomId] && !rooms.voteLoading[props.roomId]) rooms.loadVotes(props.roomId, { quiet: true })
}, 10000) })
onBeforeUnmount(() => clearInterval(timer))
</script>
<template>
  <section class="card flex flex-col gap-4 p-5" aria-labelledby="room-voting-heading">
    <div class="flex flex-wrap items-center justify-between gap-2"><h2 id="room-voting-heading" class="text-lg font-semibold">Section voting</h2><BaseButton variant="outline" size="sm" :disabled="rooms.voteLoading[roomId] || rooms.voteSaving[roomId]" @click="rooms.loadVotes(roomId)">Refresh votes</BaseButton></div>
    <p v-if="!board && rooms.voteLoading[roomId]" role="status">Loading available sections…</p>
    <p v-if="rooms.voteErrors[roomId]" role="alert" class="text-sm text-destructive">{{ rooms.voteErrors[roomId] }}</p>
    <template v-if="board">
      <p class="text-xs text-muted-foreground">{{ board.term }} · Live voting</p>
      <p class="text-sm text-muted-foreground">Choose sections you can attend, then save. Each section includes all its weekly meetings.</p>
      <p v-if="board.missingSectionIds?.length" class="text-sm text-destructive">Some previously selected sections are no longer available. Review and save your choices again.</p>
      <p v-if="!board.rows.length" class="rounded-md bg-muted p-4 text-sm">No sections are available for this module in {{ board.term }}. Voting will be available when its section data is added.</p>
      <div v-else class="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div class="flex min-w-0 flex-col gap-4">
        <RoomSectionCalendar :rows="board.rows" :selected="picks" :disabled="rooms.voteSaving[roomId]" @toggle="toggle" />
        <details class="rounded-md border border-border p-4">
          <summary class="cursor-pointer font-medium">Section details &amp; exams</summary>
          <fieldset :disabled="rooms.voteSaving[roomId]" class="mt-4 flex flex-col gap-3">
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
        </div>
        <RoomResults :room-id="roomId" :dirty="dirty" />
      </div>
      <div v-if="board.rows.length" class="flex flex-wrap items-center gap-3"><BaseButton :disabled="!dirty || rooms.voteSaving[roomId]" @click="save">{{ rooms.voteSaving[roomId] ? 'Saving…' : 'Save choices' }}</BaseButton><span v-if="dirty" class="text-xs text-muted-foreground">Unsaved changes</span></div>
      <p v-if="feedback" role="status" class="text-sm text-success">{{ feedback }}</p>
      <p class="text-xs text-muted-foreground">To clear your vote, deselect all sections and save. Room choices do not reserve a BOSS allocation.</p>
    </template>
  </section>
</template>
