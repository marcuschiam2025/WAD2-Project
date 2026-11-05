// Runs once before the E2E tests: signs in each saved account to get an API token for the reset, and records Student
// A's first plan and saved bids (without test modules) as the starting point.
import { chromium } from '@playwright/test';
import { existsSync, writeFileSync } from 'node:fs';
import { ACCOUNTS, AUTH_DIR, BASE, BASELINE_FILE, TEST_MODULES, TOKENS_FILE, call, firstPlan, type Baseline } from './reset';

export default async function globalSetup() {
  const browser = await chromium.launch();
  const tokens: Record<string, string> = {};
  for (const name of ACCOUNTS) {
    const file = `${AUTH_DIR}/${name}.json`;
    if (!existsSync(file)) continue;
    const page = await (await browser.newContext({ storageState: file })).newPage();
    const signedIn = page.waitForRequest((request) => request.url().includes('/api/') && !!request.headers()['authorization']);
    await page.goto(`${BASE}/dashboard`);
    tokens[name] = (await signedIn).headers()['authorization'];
  }
  await browser.close();
  writeFileSync(TOKENS_FILE, JSON.stringify(tokens));

  const a = tokens['student-a'];
  const [main] = await firstPlan(a);
  const { term } = await call(a, 'GET', '/bidding/round');
  const cart = await call(a, 'GET', `/bidding/cart?planId=${main._id}&term=${encodeURIComponent(term)}`);
  const items = cart.items
    .filter((item: { module: string }) => !TEST_MODULES.includes(item.module))
    .map(({ module, sectionId, amount }: Baseline['items'][number]) => ({ module, sectionId, amount }));
  // The plan's semesters, with test modules taken out of the current semester on
  const now = main.semesters.findIndex((s: { id: string }) => s.id === main.currentSem);
  const semesters = main.semesters.map((s: Baseline['semesters'][number], i: number) =>
    i < now ? s : { ...s, modules: s.modules.filter((code) => !TEST_MODULES.includes(code)) },
  );
  const baseline: Baseline = { planId: String(main._id), term, items, semesters };
  writeFileSync(BASELINE_FILE, JSON.stringify(baseline));
}
