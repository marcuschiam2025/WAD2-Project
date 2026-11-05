import { effectiveCode } from './curriculumChecklist.js';

// The term a semester falls in: intake 2025 in Y2S1 -> '2026-27_T1'
function termOf(intakeYear, semester) {
  const start = intakeYear + Number(semester[1]) - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}_T${semester[3]}`;
}

// True when the student has finished the module, is exempted from it, or is taking it this semester, so it can't get a
// new room. Later semesters are only plans, and this semester doesn't count when the room is for this semester's term
// (Rounds 2 and 2A run after term starts). Same rule as alreadyTaken in backend/features/parties/utils/eligibility.js.
export function alreadyTaken(profile, code, roomTerm) {
  const taken = [...(profile.completedModules ?? []), ...(profile.exempted ?? [])];
  if (/^Y[1-5]S[12]$/.test(profile.currentSem ?? '')) {
    for (const [semester, codes] of Object.entries(profile.takenBySem ?? {})) {
      // Labels like Y1S2 sort in semester order
      const isCurrent = semester === profile.currentSem;
      const biddingForIt =
        Number.isInteger(profile.intakeYear) && roomTerm === termOf(profile.intakeYear, profile.currentSem);
      if (semester < profile.currentSem || (isCurrent && !biddingForIt)) taken.push(...codes);
    }
  }
  return taken.some((entry) => effectiveCode(entry) === code);
}
