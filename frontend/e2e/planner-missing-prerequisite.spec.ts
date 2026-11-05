import { test, expect } from './fixtures';

test('planner-missing-prerequisite', async ({ page }) => {
  await page.goto('http://localhost:5173/planner');
  await page.getByPlaceholder('Search modules...').fill('CS446');
  await page.getByRole('button', { name: 'CS446 Offensive Cybersecurity' }).click();
  await page.getByRole('button', { name: 'CS446 Offensive Cybersecurity' }).click();
  await page.getByText('Y4 · S2', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review academic warnings for CS446' })).toContainText('Prerequisite CS440 must be taken in an earlier semester');
  await page.getByRole('button', { name: 'Keep it anyway' }).click();
});
