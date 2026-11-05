import { test, expect } from './fixtures';

test('room-already-taken', async ({ page }) => {
  await page.goto('http://localhost:5173/rooms/new');
  await page.getByRole('textbox', { name: 'Party name' }).fill('E2E IS112 study group');
  await page.getByRole('textbox', { name: 'Module code' }).fill('IS112');
  await page.getByRole('button', { name: 'IS112 · Data Management' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'You have already taken IS112' })).toHaveText("You have already taken IS112 or are taking it now, so you can't create a room for it.");
  await expect(page.getByRole('button', { name: 'Create room' })).toBeDisabled();
});
