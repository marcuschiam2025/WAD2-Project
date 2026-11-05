import { test, expect } from './fixtures';

test('quiz-resume-draft', async ({ page }) => {
  await page.goto('http://localhost:5173/quiz');
  await page.getByRole('button', { name: 'Start new attempt' }).click();
  await page.locator('fieldset label').first().click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('fieldset label').first().click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('fieldset label').first().click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.reload();
  await expect(page.getByText('3 / 20 answered')).toBeVisible();
  await page.goto('http://localhost:5173/quiz');
  await expect(page.getByRole('link', { name: 'Resume unfinished quiz' })).toBeVisible();
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toBe('Replace your unfinished quiz with a new attempt?');
    dialog.dismiss().catch(() => {});
  });
  await page.getByRole('button', { name: 'Start new attempt' }).click();
  await expect(page).toHaveURL('http://localhost:5173/quiz');
});
