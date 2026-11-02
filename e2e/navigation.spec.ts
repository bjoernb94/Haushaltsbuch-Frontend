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

test('Startseite hat keine Navigation', async ({ page }) => {
  await page.goto('/start');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('Navigation führt zur Übersicht und markiert den aktiven Bereich', async ({ page }) => {
  await page.goto('/vertraege');
  await expect(page).toHaveTitle('Verträge – Haushaltsbuch');
  const hauptmenue = page.getByRole('navigation', { name: 'Hauptmenü' });
  await expect(hauptmenue.getByRole('link', { name: 'Verträge' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await hauptmenue.getByRole('link', { name: 'Übersicht' }).click();

  await expect(page).toHaveURL(/\/start$/);
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('auf dem Desktop steht das Copyright in der Navigation', async ({ page }) => {
  await page.goto('/vertraege');
  const hauptmenue = page.getByRole('navigation', { name: 'Hauptmenü' });
  await expect(hauptmenue.getByText('© Björn Bochmann')).toBeVisible();
  await expect(page.getByRole('contentinfo').getByText('© Björn Bochmann')).toBeHidden();
  await expect(hauptmenue.getByText('Finanzübersicht')).toBeVisible();
  await expect(hauptmenue.getByText('Demnächst verfügbar').first()).toBeVisible();
});

test('auf dem Handy wird die Navigation zur Leiste mit Kurzbezeichnungen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/vertraege');
  const hauptmenue = page.getByRole('navigation', { name: 'Hauptmenü' });

  await expect(hauptmenue.getByText('Finanzen')).toBeVisible();
  await expect(hauptmenue.getByText('Finanzübersicht')).toBeHidden();
  await expect(hauptmenue.getByText('Komponenten')).toBeHidden();
  await expect(hauptmenue.getByText('© Björn Bochmann')).toBeHidden();
  await expect(page.getByRole('contentinfo').getByText('© Björn Bochmann')).toBeVisible();
  // Nur für Screenreader: Der Text bleibt im Zugriffsbaum, sichtbar ist nur der graue Eintrag.
  await expect(hauptmenue).toContainText('Demnächst verfügbar');

  const box = await hauptmenue.boundingBox();
  expect(box!.y + box!.height).toBe(844);
  const breite = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(breite).toBe(390);
});

test('Fußzeile zeigt den Systemstatus', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('contentinfo')).toContainText('© Björn Bochmann');
  await expect(page.getByRole('status', { name: 'Systemstatus' })).toContainText('Datenbank');
});
