import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, MAX, nutzerKnopf } from './backend-mock';

const kontomenue = (page: Page) => page.getByRole('dialog', { name: 'Dein Konto' });

/** Von den Verträgen über das Kontomenü und den Abschnitt Konto zum Profil. */
async function zumProfil(page: Page) {
  await page.goto('/vertraege');
  await nutzerKnopf(page).click();
  await kontomenue(page).getByRole('link', { name: 'Einstellungen' }).click();
  await page.getByRole('region', { name: 'Konto' }).getByRole('link', { name: 'Profil' }).click();
  await expect(page).toHaveURL(/\/einstellungen\/profil$/);
}

test('zeigt Name und E-Mail, „Zurück“ führt über die Einstellungen zur Herkunft', async ({
  page,
}) => {
  await backendSimulieren(page, { angemeldet: true });
  await zumProfil(page);

  await expect(page).toHaveTitle('Profil – Haushaltsbuch');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profil');
  const angaben = page.getByRole('region', { name: 'Persönliche Angaben' });
  await expect(angaben.getByRole('term')).toHaveText(['Vorname', 'Name', 'E-Mail-Adresse']);
  await expect(angaben.getByRole('definition')).toHaveText([MAX.vorname, MAX.name, MAX.email]);

  await page.getByRole('link', { name: 'Zurück zu Einstellungen' }).click();
  await expect(page).toHaveURL(/\/einstellungen$/);
  await page.getByRole('link', { name: 'Zurück zu Verträge' }).click();
  await expect(page).toHaveURL(/\/vertraege$/);
});

test('nach dem Neuladen und mit der Zurück-Taste des Browsers bleibt die Herkunft', async ({
  page,
}) => {
  await backendSimulieren(page, { angemeldet: true });
  await zumProfil(page);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profil');

  await page.goBack();
  await expect(page).toHaveURL(/\/einstellungen$/);
  await expect(page.getByRole('link', { name: 'Zurück zu Verträge' })).toBeVisible();
});

test('direkt aufgerufen führt „Zurück“ zu den Einstellungen ohne Herkunft', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/einstellungen/profil');
  await page.getByRole('link', { name: 'Zurück zu Einstellungen' }).click();
  await expect(page).toHaveURL(/\/einstellungen$/);
  await expect(page.getByRole('link', { name: 'Zurück zu Startseite' })).toBeVisible();
});

test('das Kontomenü markiert die Einstellungen, die das Profil als Herkunft bekommen', async ({
  page,
}) => {
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/einstellungen/profil');
  await nutzerKnopf(page).click();
  const einstellungen = kontomenue(page).getByRole('link', { name: 'Einstellungen' });
  await expect(einstellungen).toHaveAttribute('aria-current', 'page');
  await einstellungen.click();
  await expect(page).toHaveURL(/\/einstellungen$/);
  await page.getByRole('link', { name: 'Zurück zu Profil' }).click();
  await expect(page).toHaveURL(/\/einstellungen\/profil$/);
});

test('auf dem Handy: „Einstellungen“ im Kopf, Angaben untereinander, nichts zu breit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await backendSimulieren(page, { angemeldet: true });
  await zumProfil(page);

  const zurueck = page.getByRole('banner').getByRole('link', { name: 'Zurück zu Einstellungen' });
  await expect(zurueck).toHaveText('Einstellungen');
  const feld = page.getByRole('region', { name: 'Persönliche Angaben' }).getByRole('term').last();
  const wert = page
    .getByRole('region', { name: 'Persönliche Angaben' })
    .getByRole('definition')
    .last();
  expect((await wert.boundingBox())!.y).toBeGreaterThan((await feld.boundingBox())!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  await zurueck.click();
  await expect(page).toHaveURL(/\/einstellungen$/);
  await page.getByRole('banner').getByRole('link', { name: 'Zurück zu Verträge' }).click();
  await expect(page).toHaveURL(/\/vertraege$/);
});
