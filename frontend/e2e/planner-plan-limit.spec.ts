import { test, expect } from './fixtures';

test('planner-plan-limit', async ({ page }) => {
  await page.goto('http://localhost:5173/planner');
  await page.getByRole('button', { name: 'Add plan' }).click();
  await page.getByRole('button', { name: 'Add plan' }).click();
  await page.getByRole('button', { name: 'Add plan' }).click();
  await expect(page.getByRole('heading', { name: 'You already have 3 plans' })).toBeVisible();
  await page.getByRole('button', { name: 'Go to My plans' }).click();
  await page.getByRole('button', { name: /^Plan 1/ }).click();
});
