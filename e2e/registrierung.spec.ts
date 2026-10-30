import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, VERGEBEN } from './backend-mock';

async function ausfuellen(page: Page, email: string) {
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill('Geheim12!');
  await page.getByLabel('Name', { exact: true }).fill('Muster');
  await page.getByLabel('Vorname').fill('Max');
  await page.getByLabel(/Portfolio/).check();
}

test('vom Login zur Registrierung und angemeldet zur Startseite', async ({ page }) => {
  await backendSimulieren(page);
  await page.goto('/login');
  await page.getByRole('link', { name: 'Registrieren' }).click();
  await expect(page).toHaveURL(/\/registrierung$/);
  await expect(page).toHaveTitle('Registrieren – Haushaltsbuch');

  await ausfuellen(page, 'neu@beispiel.de');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();

  await expect(page).toHaveURL(/\/start$/);
});

test('unvollständige Angaben werden markiert', async ({ page }) => {
  await backendSimulieren(page);
  await page.goto('/registrierung');
  await page.getByLabel('Passwort', { exact: true }).fill('geheim');

  const regeln = page.getByRole('list', { name: 'Anforderungen an das Passwort' });
  await expect(regeln.getByRole('listitem').filter({ hasText: 'Ein Großbuchstabe' })).toHaveClass(
    'verletzt',
  );

  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page.getByRole('alert')).toHaveText('Bitte fülle alle Felder aus.');
  await expect(page.getByLabel('E-Mail-Adresse')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Passwort', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
});

test('vergebene E-Mail-Adresse wird gemeldet', async ({ page }) => {
  await backendSimulieren(page);
  await page.goto('/registrierung');
  await ausfuellen(page, VERGEBEN);
  await page.getByRole('button', { name: 'Konto erstellen' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'Für diese E-Mail-Adresse gibt es bereits ein Konto.',
  );
  await expect(page.getByLabel('E-Mail-Adresse')).toHaveAttribute('aria-invalid', 'true');
});

test('ohne Anmeldeserver ist die Registrierung gesperrt', async ({ page }) => {
  await backendSimulieren(page, { keycloak: false });
  await page.goto('/registrierung');

  await expect(page.getByRole('alert')).toHaveText('Registrierung gerade nicht möglich.');
  await expect(page.getByRole('button', { name: 'Konto erstellen' })).toBeDisabled();
});
