import { test, expect } from './fixtures';

test('planner-mutually-exclusive', async ({ page }) => {
  await page.goto('http://localhost:5173/planner');
  await page.getByPlaceholder('Search modules...').fill('COR-MGMT1303');
  await page.getByRole('button', { name: 'COR-MGMT1303 Entrepreneurship' }).click();
  await page.getByRole('button', { name: 'COR-MGMT1303 Entrepreneurship' }).click();
  await page.getByText('Y4 · S1', { exact: true }).click();
  await page.getByPlaceholder('Search modules...').fill('COR-MGMT1316');
  await page.getByRole('button', { name: 'COR-MGMT1316 Entrepreneurship' }).click();
  await page.getByRole('button', { name: 'COR-MGMT1316 Entrepreneurship' }).click();
  await page.getByText('Y4 · S2', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review academic warnings for COR-MGMT1316' })).toContainText('Exclusion with COR-MGMT1303 in your plan or exemptions');
  await expect(page.getByRole('button', { name: 'Review academic warnings for COR-MGMT1303' })).toContainText('Exclusion with COR-MGMT1316 in your plan or exemptions');
  await page.getByRole('button', { name: 'Keep it anyway' }).click();
});
