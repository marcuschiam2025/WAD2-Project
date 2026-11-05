import { test, expect } from './fixtures';

test('export-ics', async ({ page }) => {
  await page.goto('http://localhost:5173/dashboard');
  await page.getByRole('link', { name: 'Bidding Planner', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Plans' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download calendar (.ics)' }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^bidmaxxer-.+\.ics$/);
});
