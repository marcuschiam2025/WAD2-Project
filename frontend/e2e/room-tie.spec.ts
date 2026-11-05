import { test, expect } from './fixtures';

test('room-tie', async ({ page, browser }) => {
  const context1 = await browser.newContext({ storageState: 'playwright/.auth/student-b.json' });
  const page1 = await context1.newPage();
  await page.goto('http://localhost:5173/rooms/new');
  await page.getByRole('textbox', { name: 'Party name' }).fill('E2E IS213 tie room');
  await page.getByRole('textbox', { name: 'Module code' }).fill('IS213');
  await page.getByRole('button', { name: 'IS213 · Enterprise Solution Development' }).click();
  await page.getByRole('button', { name: 'Create room' }).click();
  await expect(page).toHaveURL(/\/rooms\/[a-f0-9]{24}$/);
  const inviteCode = await page.locator('span.select-all').first().innerText();
  await page1.goto('http://localhost:5173/rooms');
  await page1.getByRole('button', { name: 'Join with code' }).click();
  await page1.getByRole('textbox', { name: 'Room invite code' }).fill(inviteCode);
  await page1.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page1).toHaveURL(/\/rooms\/[a-f0-9]{24}$/);
  await page.getByRole('checkbox', { name: 'IS213 G1, Tuesday' }).click();
  await page.getByRole('button', { name: 'Submit my picks' }).click();
  await page1.getByRole('checkbox', { name: 'IS213 G3, Wednesday' }).click();
  await page1.getByRole('button', { name: 'Submit my picks' }).click();
  await expect(page.getByText('Everyone has voted and there’s a tie at the top. Lock one of the tied sections.')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Tied for most votes')).toHaveCount(2);
});
