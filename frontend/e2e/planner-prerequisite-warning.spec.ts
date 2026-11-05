import { test, expect } from './fixtures';

test('planner-prerequisite-warning', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Bidding Planner', exact: true }).click();
  await page.getByRole('link', { name: 'What-If Planner' }).click();
  await page.locator('span').filter({ hasText: 'IS412' }).locator('img').click();
  await page.getByText('IS412', { exact: true }).click();
  await page.getByRole('button', { name: 'Review academic warnings for IS412' }).click();
  await expect(page.getByText('Prerequisite', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Move IS412 to Y2 · S2' }).click();
  await page.getByRole('button', { name: 'Move IS412 to Y3 · S1' }).click();
  await expect(page.getByRole('button', { name: 'Review academic warnings for IS412' })).toHaveCount(0);
});