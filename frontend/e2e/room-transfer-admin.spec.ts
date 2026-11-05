import { test, expect } from './fixtures';

test('room-transfer-admin', async ({ page, browser }) => {
  const context1 = await browser.newContext({ storageState: 'playwright/.auth/student-b.json' });
  const page1 = await context1.newPage();
  await page.goto('http://localhost:5173/rooms/new');
  await page.getByRole('textbox', { name: 'Party name' }).fill('E2E CS204 admin handover');
  await page.getByRole('textbox', { name: 'Module code' }).fill('CS204');
  await page.getByRole('button', { name: 'CS204 · Computer Networks' }).click();
  await page.getByRole('button', { name: 'Create room' }).click();
  await expect(page).toHaveURL(/\/rooms\/[a-f0-9]{24}$/);
  const inviteCode = await page.locator('span.select-all').first().innerText();
  await page1.goto('http://localhost:5173/rooms');
  await page1.getByRole('button', { name: 'Join with code' }).click();
  await page1.getByRole('textbox', { name: 'Room invite code' }).fill(inviteCode);
  await page1.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page1).toHaveURL(/\/rooms\/[a-f0-9]{24}$/);
  await page.getByRole('button', { name: 'Manage' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'Make party admin' }).click();
  await page.getByRole('button', { name: 'Make party admin' }).last().click();
  await expect(page.getByText('The party admin locks the section and manages members.')).toBeVisible();
  await page1.reload();
  await expect(page1.getByText("You're the party admin: you lock the section and manage members.")).toBeVisible();
});
