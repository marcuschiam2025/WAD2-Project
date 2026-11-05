import { test, expect } from './fixtures';

test('planner-course-count-rule', async ({ page }) => {
  await page.goto('http://localhost:5173/planner');
  await page.getByPlaceholder('Search modules...').fill('IS483');
  await page.getByRole('button', { name: 'IS483 IS/SMT/C&L Project' }).click();
  await page.getByRole('button', { name: 'IS483 IS/SMT/C&L Project' }).click();
  await page.getByText('Y2 · S2', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review academic warnings for IS483' })).toContainText('Requires 2 track courses before this one');
  await page.getByRole('button', { name: 'Keep it anyway' }).click();
});
