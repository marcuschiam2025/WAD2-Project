const SLOTS=[{start:'08:15',end:'11:30'},{start:'12:00',end:'15:15'},{start:'15:30',end:'18:45'},{start:'19:00',end:'22:15'}]
const meetings=s=>s.sessions??[{day:s.day,...SLOTS[s.slot]}]
const overlap=(a,b)=>a.start<b.end && b.start<a.end
// Same starts, or a start inside a known interval, prove overlap without assuming an unknown end.
const examOverlap=(a,b)=>a.date===b.date && !!a.start && !!b.start &&
 (a.start===b.start || (!!a.end && a.start<=b.start && b.start<a.end) || (!!b.end && b.start<=a.start && a.start<b.end))
// Exam notes that aren't an exam time, so two sections sharing one don't clash
const NO_EXAM_TIME=['No final exam','Exam not yet announced']
function pairs(sections,predicate) {
 const result=[]
 for(let i=0;i<sections.length;i++) for(let j=i+1;j<sections.length;j++) if(predicate(sections[i],sections[j])) result.push([sections[i].sectionId??sections[i].id,sections[j].sectionId??sections[j].id])
 return result
}
export const findClashes=sections=>pairs(sections,(a,b)=>meetings(a).some(x=>meetings(b).some(y=>x.day===y.day&&overlap(x,y))))
export const findExamClashes=sections=>pairs(sections,(a,b)=>a.examPeriod&&b.examPeriod?examOverlap(a.examPeriod,b.examPeriod):!!a.exam&&!NO_EXAM_TIME.includes(a.exam)&&a.exam===b.exam)
export const sectionMeetings=section=>meetings(section)
// "COR-MGMT1302-G1" -> "G1". Module codes can hold hyphens, so strip the module rather than split on them.
export const sectionCode=(id,module)=>id?.includes(':')?id.split(':').pop():id?.startsWith(`${module}-`)?id.slice(module.length+1):id

