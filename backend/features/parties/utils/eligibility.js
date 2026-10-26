import { canonicalTerm } from '../../bidding/utils/sectionData.js'
import { effectiveCode } from '../../planning/utils/requirementChecker.js'

// A later term may rely on courses being taken now, without changing completion history.
export function prerequisitesBeforeTerm(user, targetTerm) {
  const completed = [...new Set([...(user.completedModules ?? []), ...(user.exempted ?? [])])]
  const semester = /^Y([1-5])S([12])$/.exec(user.currentSem ?? '')
  if (!semester || !Number.isInteger(user.intakeYear)) return completed
  let term
  try { term = canonicalTerm(targetTerm) } catch { return completed }
  const year = user.intakeYear + Number(semester[1]) - 1
  const currentTerm = `${year}-${String((year + 1) % 100).padStart(2, '0')}_T${semester[2]}`
  if (term <= currentTerm) return completed
  const current = user.takenBySem instanceof Map ? user.takenBySem.get(user.currentSem) : user.takenBySem?.[user.currentSem]
  return [...new Set([...completed, ...(current ?? []).map(effectiveCode)])]
}
