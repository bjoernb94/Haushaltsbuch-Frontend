import { expect, test } from '@playwright/test';
import { abmelden, backendSimulieren, GESPERRT, nutzerKnopf, UNVOLLSTAENDIG } from './backend-mock';

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
  await expect(nutzerKnopf(page)).toBeVisible();
});

test('falsches Passwort zeigt eine Fehlermeldung', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill('max@beispiel.de');
  await page.getByLabel('Passwort').fill('falsch');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'E-Mail-Adresse oder Passwort ist falsch. Bitte versuche es erneut.',
  );
  await expect(page.getByLabel('Passwort')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/login$/);
});

test('gesperrtes Konto zeigt einen eigenen Text', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill(GESPERRT);
  await page.getByLabel('Passwort').fill('geheim123');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'Das Konto ist gesperrt. Bitte versuche es später erneut.',
  );
  await expect(page.getByLabel('Passwort')).toHaveAttribute('aria-invalid', 'false');
});

test('unvollständiges Konto verweist auf den Support im Impressum', async ({ page }) => {
  await page.goto('/login?returnUrl=%2Fvertraege');
  await page.getByLabel('E-Mail-Adresse').fill(UNVOLLSTAENDIG);
  await page.getByLabel('Passwort', { exact: true }).fill('geheim123');
  await page.getByRole('button', { name: 'Login' }).click();

  const hinweis = page.getByRole('alert');
  await expect(hinweis).toHaveText(
    'Dein Konto wurde nicht vollständig angelegt. Bitte wende dich an den Support, er kann es ' +
      'entfernen. Danach kannst du dich neu registrieren.',
  );
  await expect(page.getByLabel('Passwort', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'false',
  );

  await hinweis.getByRole('link', { name: 'Support' }).click();
  await expect(page).toHaveURL(/\/impressum#kontakt$/);
  await expect(page.getByRole('heading', { name: 'Kontakt' })).toBeInViewport();

  await page.getByRole('link', { name: 'Zurück zu Login' }).first().click();
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fvertraege$/);
});

test('Abmelden führt zurück zum Login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill('max@beispiel.de');
  await page.getByLabel('Passwort').fill('geheim123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/start$/);

  await abmelden(page);
  await expect(page).toHaveURL(/\/login$/);
});

test('ohne Datenbank sind Login und Registrierung gesperrt', async ({ page }) => {
  await page.unrouteAll();
  await backendSimulieren(page, { datenbank: false });
  await page.goto('/login');

  await expect(page.getByRole('alert')).toHaveText('Login gerade nicht möglich.');
  await expect(page.getByRole('button', { name: 'Login' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Registrieren' })).toBeDisabled();
  await expect(page.getByRole('status', { name: 'Systemstatus' })).toContainText(
    'Datenbank nicht erreichbar',
  );
});
