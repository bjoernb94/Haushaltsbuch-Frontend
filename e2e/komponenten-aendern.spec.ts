import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, nutzerKnopf } from './backend-mock';

const KOMPONENTEN_URL = '/api/nutzer/ich/komponenten';

const navigation = (page: Page) => page.getByRole('navigation', { name: 'Hauptmenü' });
const schalter = (page: Page, name: string) => page.getByRole('switch', { name });
const speichern = (page: Page) => page.getByRole('button', { name: 'Speichern' });

/** Von den Verträgen über das Kontomenü und den Abschnitt Konto zu den Komponenten. */
async function zuDenKomponenten(page: Page) {
  await page.goto('/vertraege');
  await nutzerKnopf(page).click();
  await page
    .getByRole('dialog', { name: 'Dein Konto' })
    .getByRole('link', { name: 'Einstellungen' })
    .click();
  await page
    .getByRole('region', { name: 'Konto' })
    .getByRole('link', { name: 'Komponenten' })
    .click();
  await expect(page).toHaveURL(/\/einstellungen\/komponenten$/);
}

/** „Einstellungen ›“ vor dem Titel in der Kopfzeile. */
const pfad = (page: Page) =>
  page.getByRole('banner').getByRole('link', { name: 'Einstellungen', exact: true });

test('Komponente ausschalten: Eintrag im Hauptmenü und Kachel verschwinden', async ({ page }) => {
  await backendSimulieren(page, {
    angemeldet: true,
    komponenten: ['VERTRAGSUEBERSICHT', 'PORTFOLIO'],
  });
  await zuDenKomponenten(page);

  await expect(page).toHaveTitle('Komponenten – Haushaltsbuch');
  await expect(page.getByRole('group', { name: '2 von 4 aktiv' })).toBeVisible();
  await expect(speichern(page)).toBeDisabled();
  await expect(navigation(page).getByRole('link', { name: 'Verträge' })).toBeVisible();

  await schalter(page, /Vertragsübersicht/).uncheck();
  await expect(page.getByRole('group', { name: '1 von 4 aktiv' })).toBeVisible();
  await speichern(page).click();

  await expect(page.getByRole('status')).toContainText('Deine Komponenten wurden gespeichert.');
  await expect(speichern(page)).toBeDisabled();
  await expect(navigation(page).getByRole('link', { name: 'Verträge' })).toHaveCount(0);
  await expect(navigation(page)).toContainText(/Verträge\s*Ausgeschaltet/);

  await pfad(page).click();
  await expect(page).toHaveURL(/\/einstellungen$/);
  await page.goto('/start');
  await expect(page.getByRole('region', { name: 'Vertragsübersicht' })).toHaveCount(0);
});

test('ohne Auswahl wird nicht gespeichert', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true, komponenten: ['VERTRAGSUEBERSICHT'] });
  let gesendet = false;
  await page.route(KOMPONENTEN_URL, (route) => {
    gesendet ||= route.request().method() === 'PUT';
    return route.fallback();
  });
  await page.goto('/einstellungen/komponenten');
  await schalter(page, /Vertragsübersicht/).uncheck();
  await speichern(page).click();

  await expect(page.getByRole('alert')).toHaveText('Bitte wähle mindestens eine Komponente aus.');
  expect(gesendet).toBe(false);
  await schalter(page, /Portfolio/).check();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('„Änderungen verwerfen“ stellt den gespeicherten Stand wieder her', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true, komponenten: ['VERTRAGSUEBERSICHT'] });
  await page.goto('/einstellungen/komponenten');
  await schalter(page, /Portfolio/).check();
  await page.getByRole('button', { name: 'Änderungen verwerfen' }).click();
  await expect(schalter(page, /Portfolio/)).not.toBeChecked();
  await expect(speichern(page)).toBeDisabled();
});

test('mit Änderungen fragt das Verlassen nach, „Weiter bearbeiten“ bleibt', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true, komponenten: ['VERTRAGSUEBERSICHT'] });
  await zuDenKomponenten(page);
  await schalter(page, /Portfolio/).check();

  const dialog = page.getByRole('dialog', { name: 'Änderungen verwerfen?' });
  await pfad(page).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Weiter bearbeiten' }).click();
  await expect(page).toHaveURL(/\/einstellungen\/komponenten$/);
  await expect(schalter(page, /Portfolio/)).toBeChecked();

  await pfad(page).click();
  await dialog.getByRole('button', { name: 'Verwerfen' }).click();
  await expect(page).toHaveURL(/\/einstellungen$/);
  // Im Verlauf zurück: Die Einstellungen behalten ihre Herkunft („Zurück“ bis 900 px).
  await expect(page.locator('app-kopfzeile a.zurueck')).toHaveAttribute(
    'aria-label',
    'Zurück zu Verträge',
  );
});

test('bei 409 lädt die Seite den aktuellen Stand und weist darauf hin', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true, komponenten: ['VERTRAGSUEBERSICHT'] });
  let geaendert = false;
  await page.route(KOMPONENTEN_URL, (route) => {
    if (route.request().method() === 'PUT') {
      geaendert = true;
      return route.fulfill({
        status: 409,
        contentType: 'application/problem+json',
        json: { type: 'about:blank', status: 409, code: 'KONFLIKT' },
      });
    }
    return geaendert
      ? route.fulfill({ json: { komponenten: ['FINANZUEBERSICHT'], version: 7 } })
      : route.fallback();
  });
  await page.goto('/einstellungen/komponenten');
  await schalter(page, /Portfolio/).check();
  await speichern(page).click();

  await expect(page.getByRole('status')).toContainText('inzwischen an anderer Stelle geändert');
  await expect(schalter(page, /Finanzübersicht/)).toBeChecked();
  await expect(schalter(page, /Portfolio/)).not.toBeChecked();
  await expect(speichern(page)).toBeDisabled();
});

test(
  'auf dem Handy: „Einstellungen“ im Kopf, Speichern über Verwerfen, nichts zu breit',
  { tag: '@mobil' },
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await backendSimulieren(page, { angemeldet: true, komponenten: ['VERTRAGSUEBERSICHT'] });
    await zuDenKomponenten(page);
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Zurück zu Einstellungen' }),
    ).toHaveText('Einstellungen');

    await schalter(page, /Portfolio/).check();
    const oben = (await speichern(page).boundingBox())!;
    const unten = (await page.getByRole('button', { name: 'Änderungen verwerfen' }).boundingBox())!;
    expect(oben.y).toBeLessThan(unten.y);
    expect(oben.width).toBe(unten.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  },
);
