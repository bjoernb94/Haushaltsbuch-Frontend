import { readFileSync } from 'node:fs';
import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, nutzerKnopf } from './backend-mock';

const { version } = JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string };

async function ueberKontomenue(page: Page) {
  await nutzerKnopf(page).click();
  await page
    .getByRole('dialog', { name: 'Dein Konto' })
    .getByRole('link', { name: 'Einstellungen' })
    .click();
  await expect(page).toHaveURL(/\/einstellungen$/);
}

const abschnitt = (page: Page, name: string) => page.getByRole('region', { name });

test('über das Kontomenü erreichbar, mit Status, Version und Umgebung, zurück zur Herkunft', async ({
  page,
}) => {
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/vertraege');
  await ueberKontomenue(page);

  await expect(page).toHaveTitle('Einstellungen – Haushaltsbuch');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Einstellungen');
  await expect(page.getByRole('navigation', { name: 'Hauptmenü' })).toBeVisible();
  const status = abschnitt(page, 'Systemstatus').getByRole('listitem');
  await expect(status).toHaveText([
    /Backend\s*Verfügbar/,
    /Datenbank\s*Verfügbar/,
    /Anmeldeserver\s*Verfügbar/,
  ]);
  await expect(abschnitt(page, 'App')).toContainText(version);
  await expect(abschnitt(page, 'App')).toContainText('PROD');

  await nutzerKnopf(page).click();
  await expect(
    page.getByRole('dialog', { name: 'Dein Konto' }).getByRole('link', { name: 'Einstellungen' }),
  ).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');

  const zurueck = page.getByRole('link', { name: 'Zurück zu Verträge' });
  await zurueck.click();
  await expect(page).toHaveURL(/\/vertraege$/);
});

test('zeigt nicht erreichbare Dienste; die Fußzeile der Shell zeigt keinen Status', async ({
  page,
}) => {
  await backendSimulieren(page, { angemeldet: true, datenbank: false });
  await page.goto('/einstellungen');
  await expect(abschnitt(page, 'Systemstatus').getByRole('listitem')).toHaveText([
    /Backend\s*Verfügbar/,
    /Datenbank\s*Nicht erreichbar/,
    /Anmeldeserver\s*Verfügbar/,
  ]);
  await expect(page.getByRole('status', { name: 'Systemstatus' })).toHaveCount(0);
  await expect(page.getByRole('contentinfo')).not.toContainText('Datenbank');
});

test('ohne Herkunft zurück zur Startseite', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/einstellungen');
  await page.getByRole('link', { name: 'Zurück zu Startseite' }).click();
  await expect(page).toHaveURL(/\/start$/);
});

test('von den Einstellungen ins Impressum und zurück', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/einstellungen');
  await abschnitt(page, 'Rechtliches').getByRole('link', { name: 'Impressum' }).click();
  await expect(page).toHaveURL(/\/impressum$/);
  await page.getByRole('link', { name: 'Zurück zu Einstellungen' }).click();
  await expect(page).toHaveURL(/\/einstellungen$/);
});

test('auf dem Handy über das Kontomenü erreichbar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/start');
  await ueberKontomenue(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Einstellungen');
  const breite = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(breite).toBe(390);
});
