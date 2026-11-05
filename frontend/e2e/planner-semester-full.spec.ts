import { test, expect } from './fixtures';

test('planner-semester-full', async ({ page }) => {
  await page.goto('http://localhost:5173/planner');
  await page.getByPlaceholder('Search modules...').fill('IS461');
  await page.getByRole('button', { name: 'IS461 AI Governance' }).click();
  await page.getByRole('button', { name: 'IS461 AI Governance' }).click();
  await page.getByText('Y3 · S2', { exact: true }).click();
  await page.getByPlaceholder('Search modules...').fill('IS467');
  await page.getByRole('button', { name: 'IS467 Low Code' }).click();
  await page.getByRole('button', { name: 'IS467 Low Code' }).click();
  await page.getByText('Y3 · S2', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Y3 · S2 is full' })).toBeVisible();
  await expect(page.getByText('A semester holds at most 6 modules.')).toBeVisible();
});
