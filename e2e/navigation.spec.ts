import { expect, test } from '@playwright/test';

test('Startseite leitet auf Buchungen um', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/buchungen$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Buchungen');
});

test('Navigation wechselt zwischen den Bereichen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Verträge' }).click();
  await expect(page).toHaveURL(/\/vertraege$/);
  await expect(page).toHaveTitle('Verträge – Haushaltsbuch');
});
