import { expect, test } from '@playwright/test';
import { backendSimulieren } from './backend-mock';

test.beforeEach(async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true });
});

test('Wurzel leitet auf die Startseite um', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/start$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Willkommen, Max');
});

test('Navigation wechselt zwischen den Bereichen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Verträge' }).click();
  await expect(page).toHaveURL(/\/vertraege$/);
  await expect(page).toHaveTitle('Verträge – Haushaltsbuch');
});
