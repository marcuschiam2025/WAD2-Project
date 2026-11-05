import { test, expect } from './fixtures';

test('bid-decimals', async ({ page }) => {
  await page.goto('http://localhost:5173/bidding');
  await page.getByRole('button', { name: /^[A-Z][A-Z-]*\d+ G\d+/ }).first().click();
  await page.getByRole('spinbutton', { name: 'Bid amount in e$' }).click();
  await page.getByRole('spinbutton', { name: 'Bid amount in e$' }).fill('12.345');
  await expect(page.getByRole('spinbutton', { name: 'Bid amount in e$' })).toHaveValue('12.34');
});
