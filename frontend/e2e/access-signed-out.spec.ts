import { test, expect } from './fixtures';

test('access-signed-out', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('http://localhost:5173/planner');
  await expect(page).toHaveURL('http://localhost:5173/signin');
});
