import { test, expect } from './fixtures';

test('bid-below-minimum', async ({ page }) => {
  await page.goto('http://localhost:5173/bidding');
  await page.getByRole('button', { name: /^[A-Z][A-Z-]*\d+ G\d+/ }).first().click();
  await page.getByRole('spinbutton', { name: 'Bid amount in e$' }).click();
  await page.getByRole('spinbutton', { name: 'Bid amount in e$' }).fill('5');
  await expect(page.getByText('Minimum bid is e$ 10.')).toBeVisible();
});
