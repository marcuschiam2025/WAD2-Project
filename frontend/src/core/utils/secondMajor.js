// Progress on a plan's second major, worked out on top of the first major's checklist.
// Double-counting rules (Majors Offered by SCIS.xlsx, intake 2019 onwards):
//   - a course can't count for both the University Core and a second major
//   - a course can't count for two tracks (a first-major track and a second-major track)
//   - a course can count for both the 1st major and the second major, but at least 3 CU must not
//   - a course can count for both Free Electives and the second major
// The first major's checklist is never changed. A second-major course it doesn't use is an add-on, on top of the degree.
import { effectiveCode } from './curriculumChecklist';

const NON_DOUBLE_COUNTED_CU = 3;
const round = (n) => Math.round(n * 100) / 100;

// How the first major's checklist uses each course: core | track | major | free
function firstMajorUse(checklist) {
  const use = new Map();
  for (const slot of checklist.groups.flatMap((g) => g.slots)) {
    if (slot.extra) continue; // an additional track only shows progress
    const r = slot.requirement;
    const kind =
      r.level === 'core'
        ? 'core'
        : r.level === 'track'
          ? 'track'
          : r.countsToward === 'FREE_ELECTIVES'
            ? 'free'
            : 'major';
    (slot.credit?.held ?? []).forEach((held) => use.set(held.code, kind));
  }
  return use;
}

function placedCourses(plan, catalogue, exempted) {
  const now = plan.semesters.findIndex((s) => s.id === plan.currentSem);
  const placed = new Map();
  const add = (code, semId, status) => {
    if (catalogue[code] && !placed.has(code)) placed.set(code, { code, semId, status });
  };
  exempted.forEach((code) => add(code, 'Exempt', 'cleared'));
  plan.semesters.forEach((s, i) => {
    if (s.loa) return;
    s.modules.forEach((entry) =>
      add(effectiveCode(entry), s.id, i < now ? 'cleared' : i === now ? 'inProgress' : 'planned'),
    );
  });
  const rank = { cleared: 0, inProgress: 1, planned: 2 };
  return [...placed.values()].sort((a, b) => rank[a.status] - rank[b.status]);
}

const isMet = (r, codes) =>
  r.rule === 'all' ? r.modules.every((c) => codes.includes(c)) : codes.length >= r.n;

function rowStatus(r, taken) {
  const metWith = (statuses) =>
    isMet(
      r,
      taken.filter((t) => statuses.includes(t.status)).map((t) => t.code),
    );
  if (metWith(['cleared'])) return 'cleared';
  if (metWith(['cleared', 'inProgress'])) return 'inProgress';
  return metWith(['cleared', 'inProgress', 'planned']) ? 'planned' : 'todo';
}

/**
 * @param plan       the plan, with secondMajor: { id, trackCode }
 * @param catalogue  modules by code, in the checklist's shape
 * @param definition the second major from GET /api/second-majors
 * @param checklist  the plan's first-major checklist (layoutCurriculum's result)
 */
export function buildSecondMajor(plan, catalogue, definition, checklist, { exempted = [] } = {}) {
  const track = definition.tracks.find((t) => t.trackCode === plan.secondMajor?.trackCode) ?? null;
  const needsTrack = definition.tracks.length > 0 && !track;
  const trackCu = definition.tracks[0]?.requirements.reduce((n, r) => n + r.cuRequired, 0) ?? 0;
  const rules = [
    ...definition.requirements.map((r) => ({ ...r, isTrack: false })),
    ...(track?.requirements ?? []).map((r) => ({ ...r, isTrack: true })),
  ];
  const use = firstMajorUse(checklist);
  const allocated = new Map(rules.map((r) => [r.id, []]));
  const blocked = [];

  // The narrowest requirements pick first, so a course isn't used up by a wide list that could be met another way
  const order = [...rules].sort(
    (a, b) => Number(a.rule !== 'all') - Number(b.rule !== 'all') || a.modules.length - b.modules.length,
  );
  for (const course of placedCourses(plan, catalogue, exempted)) {
    const kind = use.get(course.code);
    const wanted = order.filter((r) => r.modules.includes(course.code));
    if (!wanted.length) continue;
    if (kind === 'core') {
      blocked.push({ code: course.code, reason: 'counts for the University Core' });
      continue;
    }
    const open = wanted.filter(
      (r) =>
        !isMet(
          r,
          allocated.get(r.id).map((t) => t.code),
        ),
    );
    const target = open.find((r) => !(r.isTrack && kind === 'track'));
    if (target) allocated.get(target.id).push({ ...course, use: kind ?? 'addOn' });
    else if (open.length) blocked.push({ code: course.code, reason: 'already counts for your track' });
  }

  const name = (code) => catalogue[code]?.name ?? code;
  const cuOf = (code) => catalogue[code]?.cu ?? 1;
  const rows = rules.map((r) => {
    const taken = allocated.get(r.id);
    const codes = taken.map((t) => t.code);
    return {
      id: r.id,
      label: r.label,
      cuRequired: r.cuRequired,
      status: rowStatus(r, taken),
      taken: taken.map((t) => ({ ...t, name: name(t.code) })),
      options: isMet(r, codes)
        ? []
        : r.modules
            .filter((c) => catalogue[c] && !codes.includes(c))
            .map((code) => ({ code, name: name(code) })),
    };
  });
  if (needsTrack) {
    rows.push({
      id: 'no-track',
      label: 'Track courses (choose a track in plan settings)',
      cuRequired: trackCu,
      status: 'todo',
      taken: [],
      options: [],
    });
  }

  const allTaken = rows.flatMap((r) => r.taken);
  const cuWhere = (test) => round(allTaken.filter(test).reduce((n, t) => n + cuOf(t.code), 0));
  const required = round(rows.reduce((n, r) => n + r.cuRequired, 0));
  const doubleCountedCu = cuWhere((t) => t.use === 'major' || t.use === 'track');
  const overLimitCu = round(Math.max(0, doubleCountedCu - (required - NON_DOUBLE_COUNTED_CU)));
  return {
    id: definition._id,
    name: definition.name,
    track: track?.name ?? null,
    rows,
    blocked,
    totals: {
      required,
      cleared: cuWhere((t) => t.status === 'cleared'),
      inProgress: cuWhere((t) => t.status === 'inProgress'),
      planned: cuWhere((t) => t.status === 'planned'),
      todo: round(required - cuWhere(() => true)),
    },
    doubleCountedCu,
    overLimitCu,
    addOnCu: cuWhere((t) => t.use === 'addOn'),
    complete: !needsTrack && overLimitCu === 0 && rows.every((r) => r.status !== 'todo'),
  };
}
