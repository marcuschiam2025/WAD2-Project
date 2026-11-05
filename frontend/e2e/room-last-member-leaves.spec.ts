import { test, expect } from './fixtures';

test('room-last-member-leaves', async ({ page }) => {
  await page.goto('http://localhost:5173/rooms/new');
  await page.getByRole('textbox', { name: 'Party name' }).fill('E2E CS204 solo room');
  await page.getByRole('textbox', { name: 'Module code' }).fill('CS204');
  await page.getByRole('button', { name: 'CS204 · Computer Networks' }).click();
  await page.getByRole('button', { name: 'Create room' }).click();
  await expect(page).toHaveURL(/\/rooms\/[a-f0-9]{24}$/);
  const inviteCode = await page.locator('span.select-all').first().innerText();
  await page.getByRole('button', { name: 'Leave room' }).click();
  await expect(page.getByText('You are the last member. Leaving deletes this room and its votes.')).toBeVisible();
  await page.getByRole('button', { name: 'Leave room' }).last().click();
  await expect(page).toHaveURL('http://localhost:5173/rooms');
  await expect(page.getByText('E2E CS204 solo room')).toHaveCount(0);
});
