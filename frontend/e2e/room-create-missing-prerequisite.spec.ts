import { test, expect } from './fixtures';

test('room-create-missing-prerequisite', async ({ page }) => {
  await page.goto('http://localhost:5173/rooms/new');
  await page.getByRole('textbox', { name: 'Party name' }).fill('E2E CS446 study group');
  await page.getByRole('textbox', { name: 'Module code' }).fill('CS446');
  await page.getByRole('button', { name: 'CS446 · Offensive Cybersecurity' }).click();
  await page.getByRole('button', { name: 'Create room' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Missing prerequisite' })).toHaveText('Missing prerequisite for CS446: CS440');
  await expect(page).toHaveURL('http://localhost:5173/rooms/new');
});
