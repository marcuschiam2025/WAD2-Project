<script setup>
// Weekly calendar of a room module's live sections, in the timetable style of the rest of the app.
// Rows are the exact meeting times from the catalogue (not fixed BOSS slots); a section with several weekly
// meetings shows in each of them and is picked or unpicked as a whole.
import { computed } from 'vue'
import { roomCalendar } from '@core/utils/roomCalendar'
const props = defineProps({
  rows: { type: Array, required: true },
  selected: { type: Array, required: true },
  disabled: Boolean,
})
const emit = defineEmits(['toggle'])
const times = computed(() => roomCalendar(props.rows))
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
// Weekends are included whenever the live catalogue contains a weekend meeting.
const visibleDays = computed(() => days.map((name, day) => ({ name, day })).filter(({ day }) => day < 5 || times.value.some(time => time.days[day].length)))
</script>

<template>
 <div>
  <div class="overflow-x-auto rounded-lg border border-border bg-card" tabindex="0" aria-label="Weekly section calendar; scroll horizontally to see all days">
    <div class="min-w-[720px]" role="table" aria-label="Weekly section calendar. Select any meeting to select or deselect its whole section.">
      <div class="flex bg-muted" role="row">
        <div class="sticky left-0 z-10 w-[68px] shrink-0 bg-muted px-2.5 py-2.5 text-overline text-muted-foreground" role="columnheader">Time</div>
        <div v-for="day in visibleDays" :key="day.day" class="min-w-0 flex-1 border-l border-border px-2.5 py-2.5 text-[13px] font-semibold" role="columnheader">
          {{ day.name.slice(0, 3) }}
        </div>
      </div>
      <div v-for="time in times" :key="`${time.start}-${time.end}`" class="flex min-h-[104px] border-t border-border" role="row">
        <div class="sticky left-0 z-10 flex w-[68px] shrink-0 flex-col gap-0.5 bg-card px-2.5 py-2.5 font-mono text-[11px] leading-normal font-medium" role="rowheader">
          <span>{{ time.start }}</span>
          <span class="text-muted-foreground">{{ time.end }}</span>
        </div>
        <div v-for="day in visibleDays" :key="day.day" class="flex min-w-0 flex-1 flex-col gap-1.5 border-l border-border p-1.5" role="cell">
          <button
            v-for="(event, index) in time.days[day.day]"
            :key="`${event.section.id}:${index}`"
            type="button"
            role="checkbox"
            :aria-checked="selected.includes(event.section.id)"
            :disabled="disabled"
            :aria-label="`${event.section.module} ${event.section.section}, ${day.name} ${time.start} to ${time.end}, ${event.count} votes. ${selected.includes(event.section.id) ? 'Deselect' : 'Select'} whole section`"
            class="flex w-full flex-col gap-0.5 rounded-sm px-2.5 py-2 text-left text-[11px] leading-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default"
            :class="
              selected.includes(event.section.id)
                ? 'bg-primary text-primary-foreground'
                : 'border-[1.5px] border-dashed border-border text-muted-foreground hover:border-primary hover:text-foreground'
            "
            @click="emit('toggle', event.section.id)"
          >
            <span class="flex items-center gap-1.5 font-mono text-[12px] font-bold">
              {{ event.section.section }}<span v-if="selected.includes(event.section.id)" aria-hidden="true">✓</span>
            </span>
            <span class="truncate">{{ event.section.prof || 'Instructor not listed' }}</span>
            <span>{{ time.start }}–{{ time.end }}<template v-if="event.meeting.venue"> · {{ event.meeting.venue }}</template></span>
            <span class="mt-0.5 flex flex-col leading-normal">
              <span class="font-semibold">{{ event.count }} {{ event.count === 1 ? 'vote' : 'votes' }}</span>
              <span class="opacity-80">{{ event.voters.length ? event.voters.map(person => person.name).join(', ') : 'Nobody yet' }}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
  <p class="mt-1.5 text-[12px] text-muted-foreground xl:hidden">Swipe sideways to see the whole week.</p>
 </div>
</template>
