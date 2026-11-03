import { canonicalTerm } from "../../bidding/utils/sectionData.js";
import { effectiveCode } from "../../planning/utils/requirementChecker.js";

export function prerequisitesBeforeTerm(user, targetTerm) {
  // 1. Completed and exempted modules, without duplicates
  const done = []
  addEach(done, user.completedModules || [])
  addEach(done, user.exempted || [])
 
  // 2. The term the student is in now, e.g. '2026-27_T1'. If we can't tell, stop here.
  const currentTerm = currentTermOf(user)
  if (!currentTerm) return done
 
  // 3. The term being checked, in the same format. If it isn't a valid term, stop here.
  let term
  try {
    term = canonicalTerm(targetTerm)
  } catch {
    return done
  }
 
  // 4. This term or an earlier one: only finished modules count
  if (term <= currentTerm) return done
 
  // 5. A later term: this semester's modules count as done too
  for (const code of modulesInSemester(user.takenBySem, user.currentSem)) {
    const tidy = effectiveCode(code)
    if (!done.includes(tidy)) done.push(tidy)
  }
  return done
}
 
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
 
// Adds each item to the list unless it's already there
function addEach(list, items) {
  for (const item of items) {
    if (!list.includes(item)) list.push(item)
  }
}
 
// Works out the current term from the intake year and current semester.
// Returns null when either piece is missing or invalid.
function currentTermOf(user) {
  const validSem = typeof user.currentSem === 'string' && /^Y[1-5]S[12]$/.test(user.currentSem)
  if (!validSem || !Number.isInteger(user.intakeYear)) return null
 
  const yearOfStudy = Number(user.currentSem[1]) // 'Y2S1' → 2
  const termNumber = user.currentSem[3]          // 'Y2S1' → '1'
 
  const startYear = user.intakeYear + yearOfStudy - 1                 // 2025 + 2 - 1 = 2026
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0') // 2027 → '27'
  return `${startYear}-${endYearShort}_T${termNumber}`               // '2026-27_T1'
}
 
// Pulls the modules listed for one semester. 
function modulesInSemester(takenBySem, semester) {
  if (!takenBySem) return []
  return takenBySem[semester] || []
}