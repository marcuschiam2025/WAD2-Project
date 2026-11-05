import { test, expect } from './fixtures';

test('quiz-blank-answer', async ({ page }) => {
  await page.goto('http://localhost:5173/quiz');
  await page.getByRole('button', { name: 'Start new attempt' }).click();
  await page.locator('fieldset label').first().click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Section completion').getByRole('button').nth(3).click();
  await page.locator('fieldset label').first().click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('fieldset label').first().click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('fieldset label').first().click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('fieldset label').first().click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('fieldset label').first().click();
  await page.getByRole('button', { name: 'See my results', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Please answer this question.' })).toHaveText('Please answer this question. Every question needs an answer before you can see your results.');
  await expect(page).toHaveURL('http://localhost:5173/quiz/attempt');
});
