import { test, expect } from './fixtures';

test('planner-corequisite', async ({ page }) => {
  await page.goto('http://localhost:5173/planner');
  await page.getByPlaceholder('Search modules...').fill('CS301');
  await page.getByRole('button', { name: 'CS301 Solution Architecture' }).click();
  await page.getByRole('button', { name: 'CS301 Solution Architecture' }).click();
  await page.getByText('Y2 · S1', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review academic warnings for CS301' })).toContainText(/Corequisite .* must be taken in the same or an earlier semester/);
  await page.getByRole('button', { name: 'Keep it anyway' }).click();
});
