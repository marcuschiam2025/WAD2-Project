import { test, expect } from './fixtures';

test.use({
  storageState: 'playwright/.auth/student-a.json'
});

test('bid-rating-clash-warning', async ({ page }) => {
  await page.goto('http://localhost:5173/dashboard');
  await page.getByRole('link', { name: 'Bidding Planner', exact: true }).click();
  await page.getByRole('button', { name: 'ACCT101 G2 Financial' }).click();
  await page.getByRole('button', { name: 'ACCT101 G4 Financial' }).click();
  await page.getByRole('button', { name: 'ACCT101 G4 Financial' }).click();
  await page.getByRole('button', { name: 'Save plan' }).click();
  await page.getByRole('button', { name: 'Save plan' }).click();
  await page.getByRole('button', { name: 'ACCT101 G4 Financial' }).click();
  await page.getByRole('button', { name: 'ACCT101 G9 Financial' }).click();
  await page.getByRole('button', { name: 'ACCT101 G4 Financial' }).click();
  await page.getByRole('button', { name: 'ACCT101 G9 Financial' }).click();
  await page.locator('span').filter({ hasText: 'e$' }).nth(1).click();
  await page.getByRole('spinbutton', { name: 'Bid amount in e$' }).click();
  await page.getByRole('spinbutton', { name: 'Bid amount in e$' }).fill('25');
  await expect(page.getByText('More than 1 SD below the e$')).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Bid amount in e$' }).click();
  await page.getByRole('spinbutton', { name: 'Bid amount in e$' }).fill('30');
  await expect(page.getByText('Within 1 SD of the e$ 33.5')).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Bid amount in e$' }).click();
  await page.getByRole('spinbutton', { name: 'Bid amount in e$' }).fill('43');
  await expect(page.getByText('Above the average of the last')).toBeVisible();
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(page.getByText('Saved at')).toBeVisible({ timeout: 15000 });
});