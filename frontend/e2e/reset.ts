// Puts the test accounts back to a known starting point before every E2E test, so tests never trip over what an
// earlier test left behind. It only touches test leftovers:
//   - rooms whose names start with "E2E " (every test room does; real rooms are never touched)
//   - extra What-If plans with nothing planned after the current semester (the plan-limit test makes these; a new
//     plan copies the semesters up to and including the current one)
//   - Student A's first plan and its saved bids, set back to how they were when the run started (minus TEST_MODULES)
//   - the modules in TEST_MODULES, out of Student A's basket
// For the two recorded tests only, it also sets up where they start from: IS412 in the current semester (so it has a
// prerequisite warning) for planner-prerequisite-warning, and ACCT101 booked in G2 for bid-rating-clash-warning.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const BASE = 'http://localhost:5173';
export const AUTH_DIR = fileURLToPath(new URL('../playwright/.auth', import.meta.url));
export const ACCOUNTS = ['student-a', 'student-b', 'student-c'];
export const TOKENS_FILE = `${AUTH_DIR}/tokens.json`;
export const BASELINE_FILE = `${AUTH_DIR}/baseline.json`;

// Modules the tests add to Student A's plan, basket or bids, and nothing else uses
export const TEST_MODULES = ['CS204', 'IS428', 'IS453', 'IS461', 'IS467', 'CS301', 'CS446', 'CS447', 'IS483', 'COR-MGMT1303', 'COR-MGMT1316'];

type Item = { module: string; sectionId: string; amount: number };
type Semester = { id: string; modules: string[]; [field: string]: unknown };
export type Baseline = { planId: string; term: string; items: Item[]; semesters: Semester[] };

export async function call(token: string, method: string, path: string, body?: unknown) {
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { authorization: token, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path} answered ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

// Student A's first plan: the oldest one
export async function firstPlan(token: string) {
  const plans = await call(token, 'GET', '/plans');
  return [...plans].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function resetTestData(testTitle = '') {
  const tokens: Record<string, string> = JSON.parse(readFileSync(TOKENS_FILE, 'utf8'));
  const a = tokens['student-a'];

  // 1. Test rooms: everyone leaves, Student A last, and a room is deleted when its last member leaves
  for (const name of ['student-b', 'student-c', 'student-a']) {
    if (!tokens[name]) continue;
    for (const room of await call(tokens[name], 'GET', '/parties')) {
      if (String(room.name).startsWith('E2E ')) await call(tokens[name], 'DELETE', `/parties/${room._id}/members/me`);
    }
  }

  // 2. Extra plans with nothing planned after the current semester
  const [main, ...others] = await firstPlan(a);
  for (const plan of others) {
    const now = plan.semesters.findIndex((s: { id: string }) => s.id === plan.currentSem);
    const hasPlans = plan.semesters.slice(now + 1).some((s: { modules: string[] }) => s.modules.length > 0);
    if (!hasPlans) await call(a, 'DELETE', `/plans/${plan._id}`);
  }

  // 3. The first plan's semesters back to how they were when the run started (without test modules). This also undoes
  //    planner changes a test made but hadn't saved yet. For planner-prerequisite-warning only, IS412 goes into the
  //    current semester, where it has a prerequisite warning.
  const baseline: Baseline | null = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) : null;
  if (baseline) {
    const now = baseline.semesters.findIndex((s) => s.id === main.currentSem);
    const semesters = baseline.semesters.map((s) => ({ ...s, modules: [...s.modules] }));
    if (testTitle === 'planner-prerequisite-warning' && semesters.some((s, i) => i > now && s.modules.includes('IS412'))) {
      semesters.forEach((s, i) => { if (i > now) s.modules = s.modules.filter((code) => code !== 'IS412'); });
      semesters[now].modules.push('IS412');
    }
    await call(a, 'PUT', `/plans/${main._id}`, { semesters });
  }

  // 4. Test modules out of the basket
  const me = await call(a, 'GET', '/users/me');
  const basket = (me.basket ?? []).filter((code: string) => !TEST_MODULES.includes(code));
  if (basket.length !== (me.basket ?? []).length) await call(a, 'PATCH', '/users/me', { basket });

  // 5. Saved bids back to how they were when the run started
  if (baseline) {
    const items = baseline.items.map((item) =>
      testTitle === 'bid-rating-clash-warning' && item.module === 'ACCT101' ? { ...item, sectionId: 'ACCT101-G2' } : item,
    );
    await call(a, 'PUT', '/bidding/cart', { planId: baseline.planId, term: baseline.term, items });
  }
}
