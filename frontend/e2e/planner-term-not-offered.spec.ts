import { test, expect } from './fixtures';

test('planner-term-not-offered', async ({ page }) => {
  await page.goto('http://localhost:5173/planner');
  await page.getByPlaceholder('Search modules...').fill('CS447');
  await page.getByRole('button', { name: 'CS447 IT Audit' }).click();
  await page.getByRole('button', { name: 'CS447 IT Audit' }).click();
  await page.getByText('Y3 · S2', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CS447 is not offered in Y3 · S2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move to Y4 · S1' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
});
