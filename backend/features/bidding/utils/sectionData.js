const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN']
const SLOTS = [{start:'08:15',end:'11:30'},{start:'12:00',end:'15:15'},{start:'15:30',end:'18:45'},{start:'19:00',end:'22:15'}]
export function canonicalTerm(value) {
 const shared=/^(20\d{2})-(\d{2})_T([1-3])$/.exec(value ?? '')
 if (shared && Number(shared[2]) === (Number(shared[1])+1)%100) return value
 const old=/^AY(\d{2})\/(\d{2}) T([1-3])$/.exec(value ?? '')
 if (old && Number(old[2]) === (Number(old[1])+1)%100) return `20${old[1]}-${old[2]}_T${old[3]}`
 throw new Error('Invalid bidding term')
}
export function termLabel(value) {
 const key=canonicalTerm(value)
 return `AY${key.slice(2,4)}/${key.slice(5,7)} T${key.at(-1)}`
}
function meeting(value) {
 const day=typeof value.day === 'number' ? value.day : DAYS.indexOf(value.day?.toUpperCase())
 if (!Number.isInteger(day) || day<0 || day>6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.start??'') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.end??'') || value.start>=value.end) throw new Error('Invalid section meeting')
 const containing=SLOTS.findIndex(slot=>value.start>=slot.start && value.start<slot.end)
 // Display bands group cards only; exact start/end times determine clashes.
 const slot=containing>=0?containing:Math.max(0,SLOTS.findLastIndex(slot=>value.start>=slot.start))
 return {day,start:value.start,end:value.end,venue:value.venue,slot}
}
export function normalizeSection(raw) {
 const shared=raw.moduleCode !== undefined
 const term=canonicalTerm(shared?raw.termKey:raw.term)
 const module=shared?raw.moduleCode:raw.module
 const section=shared?raw.sectionCode:raw.section
 if (!module || !section || (shared && (!Array.isArray(raw.classSlots) || !raw.classSlots.length))) throw new Error('Invalid section identity or meetings')
 const sessions=shared?raw.classSlots.map(meeting):[meeting({...SLOTS[raw.slot],day:raw.day,venue:raw.venue})]
 let examPeriod=null
 if (shared && raw.finalExam) {
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(raw.finalExam.date))
  meeting({day:0,start:raw.finalExam.start,end:raw.finalExam.end})
  examPeriod={date,start:raw.finalExam.start,end:raw.finalExam.end}
 }
 return {...raw,sectionId:shared?`${term}:${module}:${section}`:raw.sectionId,module,section,term,sessions,
  day:sessions[0].day,slot:sessions[0].slot,venue:sessions[0].venue,
  prof:shared?raw.instructor:raw.prof,examPeriod,
  exam:shared?(examPeriod?`${examPeriod.date} · ${examPeriod.start} – ${examPeriod.end}`:'No final exam'):raw.exam??'No final exam'}
}
