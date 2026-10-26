const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN']
// finalExam null means the section has no final exam; a missing finalExam means it isn't announced yet
export const NO_FINAL_EXAM = 'No final exam'
export const EXAM_NOT_ANNOUNCED = 'Exam not yet announced'
// Joins a co-taught section's instructors into one prof string. Not a comma: BOSS names can contain one ("LEE, YUN").
export const INSTRUCTOR_SEPARATOR = '; '
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
// Reads the three section formats into one shape:
//   catalogue (scripts/build-sections.js): module, term "AY26/27 T2", section, meetings[], instructors[]
//   shared (older admin rows): moduleCode, termKey "2026-27_T2", sectionCode, classSlots[], instructor
//   legacy (sample data): module, term, section, day, slot, prof
// Catalogue sections may have no meetings (work-study, SMU-X): sessions is then [] and day/slot are null.
export function normalizeSection(raw) {
 const shared=raw.moduleCode !== undefined
 const catalogue=!shared && Array.isArray(raw.meetings)
 const term=canonicalTerm(shared?raw.termKey:raw.term)
 const module=shared?raw.moduleCode:raw.module
 const section=shared?raw.sectionCode:raw.section
 if (!module || !section || (shared && (!Array.isArray(raw.classSlots) || !raw.classSlots.length))) throw new Error('Invalid section identity or meetings')
 const sessions=shared?raw.classSlots.map(meeting):catalogue?raw.meetings.map(meeting):[meeting({...SLOTS[raw.slot],day:raw.day,venue:raw.venue})]
 let examPeriod=null
 if ((shared || catalogue) && raw.finalExam) {
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(raw.finalExam.date))
  meeting({day:0,start:raw.finalExam.start,end:raw.finalExam.end})
  examPeriod={date,start:raw.finalExam.start,end:raw.finalExam.end,...(raw.finalExam.venue?{venue:raw.finalExam.venue}:{})}
 }
 return {...raw,sectionId:raw.sectionId??(shared?`${term}:${module}:${section}`:raw.sectionId),module,section,term,sessions,
  day:sessions[0]?.day??null,slot:sessions[0]?.slot??null,venue:sessions[0]?.venue??null,
  prof:shared?raw.instructor:catalogue?(raw.instructors??[]).join(INSTRUCTOR_SEPARATOR):raw.prof,examPeriod,
  exam:examPeriod?`${examPeriod.date} · ${examPeriod.start} – ${examPeriod.end}`:shared||raw.finalExam===null?NO_FINAL_EXAM:raw.exam??EXAM_NOT_ANNOUNCED}
}
