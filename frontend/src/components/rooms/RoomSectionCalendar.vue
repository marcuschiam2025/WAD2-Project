<script setup>
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
  <div class="overflow-x-auto rounded-lg border border-border bg-card" tabindex="0" aria-label="Weekly section calendar; scroll horizontally to see all days">
    <table class="w-full min-w-[850px] table-fixed border-collapse text-left text-sm">
      <caption class="sr-only">Weekly section calendar. Select any meeting to select or deselect its whole section. Rows show exact meeting times, not a proportional time scale.</caption>
      <thead class="bg-muted">
        <tr><th scope="col" class="w-24 p-3 text-xs font-semibold">Time</th><th v-for="day in visibleDays" :key="day.day" scope="col" class="border-l border-border p-3 font-semibold">{{ day.name }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="time in times" :key="`${time.start}-${time.end}`" class="border-t border-border">
          <th scope="row" class="p-3 align-top font-mono text-xs font-medium"><span class="block">{{ time.start }}</span><span class="mt-1 block text-muted-foreground">{{ time.end }}</span></th>
          <td v-for="day in visibleDays" :key="day.day" class="border-l border-border p-1.5 align-top">
            <div class="flex min-h-24 flex-col gap-2">
              <button v-for="(event, index) in time.days[day.day]" :key="`${event.section.id}:${index}`" type="button"
                :disabled="disabled" :aria-pressed="selected.includes(event.section.id)"
                :aria-label="`${event.section.module} ${event.section.section}, ${day.name} ${time.start} to ${time.end}, ${event.count} votes. ${selected.includes(event.section.id) ? 'Deselect' : 'Select'} whole section`"
                class="flex w-full flex-col gap-1 rounded-md border p-2.5 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
                :class="selected.includes(event.section.id) ? 'border-primary bg-primary-tint' : 'border-border hover:border-primary hover:bg-muted'"
                @click="emit('toggle', event.section.id)">
                <span class="flex justify-between gap-1 font-semibold text-sm"><span>{{ event.section.module }} · {{ event.section.section }}</span><span v-if="selected.includes(event.section.id)" aria-hidden="true" class="text-primary">✓</span></span>
                <span>{{ event.section.prof || 'Instructor not listed' }}</span>
                <span class="text-muted-foreground">{{ time.start }}–{{ time.end }}</span>
                <span v-if="event.meeting.venue" class="text-muted-foreground">{{ event.meeting.venue }}</span>
                <span class="mt-1 font-medium">{{ event.count }} {{ event.count === 1 ? 'vote' : 'votes' }}</span>
                <span v-if="event.voters.length" class="break-words text-muted-foreground">{{ event.voters.map(person => person.name).join(', ') }}</span>
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
