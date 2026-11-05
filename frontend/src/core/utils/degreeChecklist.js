// Helpers for the degree checklist. Pure functions. The checklist itself is built in curriculumChecklist.js.
import { SEM_IDS } from '../data/degree';
import { curriculumCandidates, effectiveCode } from './curriculumChecklist';

// "Y2S1" -> 3, so semesters compare as numbers
const semNum = (id) => {
  const [y, s] = id.match(/\d/g).map(Number);
  return (y - 1) * 2 + s;
};

const windowLabel = ([a, b]) => (a === b ? a : `${a}-${b}`);
const idsIn = ([a, b]) => SEM_IDS.filter((id) => semNum(id) >= semNum(a) && semNum(id) <= semNum(b));

// A semester before the current one is done, the current one is being taken, later ones are planned
const statusAt = (i, nowIdx) => (i < nowIdx ? 'cleared' : i === nowIdx ? 'inProgress' : 'planned');

// Every catalogue module in the plan (one entry per code, exchange mappings resolved), with where it sits.
// Exempted modules count as cleared, with 'Exempt' in place of a semester.
export function placedModules(plan, catalogue, exempted = []) {
  const nowIdx = plan.semesters.findIndex((s) => s.id === plan.currentSem);
  const placed = [];
  const seen = new Set();
  plan.semesters.forEach((sem, i) => {
    sem.modules.forEach((entry) => {
      const code = effectiveCode(entry);
      const mod = catalogue[code];
      if (!mod || seen.has(code)) return;
      // A leave-of-absence term only counts an internship
      if (sem.loa && !mod.fulfils?.includes('CORE:INTERNSHIP')) return;
      seen.add(code);
      placed.push({ mod, semId: sem.id, status: statusAt(i, nowIdx) });
    });
  });
  exempted.forEach((code) => {
    const mod = catalogue[code];
    if (!mod || seen.has(code)) return;
    seen.add(code);
    placed.push({ mod, semId: 'Exempt', status: 'cleared', exempt: true });
  });
  return placed;
}

// How a recommended window [first, last] relates to the plan's current semester.
export function semTools(plan) {
  const nowNum = semNum(plan.currentSem);

  const urgencyOf = (win) => {
    if (nowNum > semNum(win[1])) return 'late';
    if (nowNum >= semNum(win[0])) return 'due';
    return 'later';
  };

  // now | later | late
  const toneOf = (win) => ({ late: 'late', due: 'now', later: 'later' })[urgencyOf(win)];

  // rec: everything the hover needs. chip: the one semester tag shown in the list.
  //   planned -> the semester it sits in (blue)   inProgress -> being taken this semester (amber)
  //   now -> recommended for the current semester (green)
  //   later -> first recommended semester (grey)   late -> last recommended semester, already passed (red)
  const recFor = (win, placedId) => ({
    ids: idsIn(win),
    tone: toneOf(win),
    label: windowLabel(win),
    now: plan.currentSem,
    placed: placedId,
  });
  const chipFor = (win, placedId, status) => {
    if (placedId)
      return {
        text: placedId,
        tone: status === 'inProgress' ? 'inProgress' : status === 'exempted' ? 'exempted' : 'planned',
      };
    const tone = toneOf(win);
    return { text: tone === 'now' ? plan.currentSem : tone === 'later' ? win[0] : win[1], tone };
  };

  return { urgencyOf, recFor, chipFor };
}

/**
 * The modules a student could pick for a checklist item, each with where it already sits in the plan (or null).
 * `catalogue` is the backend's module catalogue in this shape (see stores/catalogue.js).
 */
export function candidatesFor(item, plan, catalogue, exempted = []) {
  const where = new Map(
    placedModules(plan, catalogue, exempted).map((p) => [
      p.mod.code,
      { status: p.exempt ? 'exempted' : p.status, semId: p.semId },
    ]),
  );
  return curriculumCandidates(item, catalogue)
    .map((m) => ({ ...m, key: m.code || item.id, placement: where.get(m.code) ?? null }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
