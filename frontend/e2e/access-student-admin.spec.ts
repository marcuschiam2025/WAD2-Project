import { test, expect } from './fixtures';

test('access-student-admin', async ({ page }) => {
  await page.goto('http://localhost:5173/admin');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
});
