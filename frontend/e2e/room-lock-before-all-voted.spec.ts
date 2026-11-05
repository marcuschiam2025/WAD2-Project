import { test, expect } from './fixtures';

test('room-lock-before-all-voted', async ({ page, browser }) => {
  const context1 = await browser.newContext({ storageState: 'playwright/.auth/student-b.json' });
  const page1 = await context1.newPage();
  await page.goto('http://localhost:5173/rooms/new');
  await page.getByRole('textbox', { name: 'Party name' }).fill('E2E IS213 early lock');
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
  await expect(page.getByText('You can lock a section once everyone has voted.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lock this section' })).toHaveCount(0);
});
