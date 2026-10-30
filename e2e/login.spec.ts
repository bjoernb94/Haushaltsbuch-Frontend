import { expect, test } from '@playwright/test';
import { backendSimulieren } from './backend-mock';

test.beforeEach(async ({ page }) => {
  await backendSimulieren(page);
});

test('ohne Anmeldung geht es zum Login und danach zurück', async ({ page }) => {
  await page.goto('/vertraege');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fvertraege$/);
  await expect(page).toHaveTitle('Anmelden – Haushaltsbuch');

  await page.getByLabel('E-Mail-Adresse').fill('max@beispiel.de');
  await page.getByLabel('Passwort').fill('geheim123');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/vertraege$/);
  await expect(page.getByText('Max Muster')).toBeVisible();
});

test('falsches Passwort zeigt eine Fehlermeldung', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill('max@beispiel.de');
  await page.getByLabel('Passwort').fill('falsch');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'E-Mail-Adresse oder Passwort ist falsch. Bitte versuche es erneut.',
  );
  await expect(page).toHaveURL(/\/login$/);
});

test('Abmelden führt zurück zum Login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill('max@beispiel.de');
  await page.getByLabel('Passwort').fill('geheim123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/start$/);

  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
