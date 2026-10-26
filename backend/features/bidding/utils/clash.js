const SLOTS=[{start:'08:15',end:'11:30'},{start:'12:00',end:'15:15'},{start:'15:30',end:'18:45'},{start:'19:00',end:'22:15'}]
const meetings=s=>s.sessions??[{day:s.day,...SLOTS[s.slot]}]
const overlap=(a,b)=>a.start<b.end && b.start<a.end
// Exam notes that aren't an exam time, so two sections sharing one don't clash
const NO_EXAM_TIME=['No final exam','Exam not yet announced']
function pairs(sections,predicate) {
 const result=[]
 for(let i=0;i<sections.length;i++) for(let j=i+1;j<sections.length;j++) if(predicate(sections[i],sections[j])) result.push([sections[i].sectionId??sections[i].id,sections[j].sectionId??sections[j].id])
 return result
}
export const findClashes=sections=>pairs(sections,(a,b)=>meetings(a).some(x=>meetings(b).some(y=>x.day===y.day&&overlap(x,y))))
export const findExamClashes=sections=>pairs(sections,(a,b)=>a.examPeriod&&b.examPeriod?a.examPeriod.date===b.examPeriod.date&&overlap(a.examPeriod,b.examPeriod):!!a.exam&&!NO_EXAM_TIME.includes(a.exam)&&a.exam===b.exam)
