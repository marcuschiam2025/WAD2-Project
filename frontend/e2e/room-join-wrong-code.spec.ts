import { test, expect } from './fixtures';

test('room-join-wrong-code', async ({ page }) => {
  await page.goto('http://localhost:5173/rooms');
  await page.getByRole('button', { name: 'Join with code' }).click();
  await page.getByRole('textbox', { name: 'Room invite code' }).fill('ZZZZZZ');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'No party found for that invite code' })).toBeVisible();
});
