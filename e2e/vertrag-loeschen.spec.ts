import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, BEISPIEL_VERTRAEGE } from './backend-mock';

const KFZ = 'Kfz-Versicherung';
const ERSTE_NACH_KFZ = 'Fitnessstudio am Park';
const LETZTE = 'Mobilfunk GmbH';

const zeile = (page: Page, name: string) =>
  page.locator('app-vertrag-zeile').filter({ hasText: name });
const dialog = (page: Page, name: string) =>
  page.getByRole('dialog', { name: `„${name}“ löschen?` });
const loeschKnopf = (page: Page, name: string) =>
  page.getByRole('button', { name: `${name} löschen` });

async function loeschenBestaetigen(page: Page, name = KFZ) {
  await loeschKnopf(page, name).click();
  await dialog(page, name).getByRole('button', { name: 'Ja, löschen' }).click();
}

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { status, code, detail: 'English detail' },
  };
}

test.describe('Vertrag löschen', () => {
  test.beforeEach(async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');
  });

  test('der Untertitel nennt jetzt alle drei Aktionen', async ({ page }) => {
    await expect(
      page.getByText('Lege Verträge an, bearbeite sie oder entferne sie.'),
    ).toBeVisible();
  });

  test('der Dialog nennt den Vertrag, „Abbrechen“ hat den ersten Fokus', async ({ page }) => {
    let anfragen = 0;
    page.on('request', (r) => {
      if (r.method() === 'DELETE') anfragen++;
    });
    await loeschKnopf(page, KFZ).click();
    await expect(dialog(page, KFZ)).toBeVisible();
    await expect(dialog(page, KFZ)).toContainText('Das lässt sich nicht rückgängig machen.');
    const abbrechen = dialog(page, KFZ).getByRole('button', { name: 'Abbrechen' });
    await expect(abbrechen).toBeFocused();

    await abbrechen.click();
    await expect(dialog(page, KFZ)).toHaveCount(0);
    await expect(loeschKnopf(page, KFZ)).toBeFocused();

    await loeschKnopf(page, KFZ).click();
    await expect(dialog(page, KFZ)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page, KFZ)).toHaveCount(0);
    expect(anfragen).toBe(0);
    await expect(zeile(page, KFZ)).toBeVisible();
  });

  test('schickt die Version, entfernt die Zeile und lädt die Kennzahlen neu', async ({ page }) => {
    await expect(page.getByText('Laufende Verträge6')).toBeVisible();
    const anfrage = page.waitForRequest((r) => r.method() === 'DELETE');
    await loeschenBestaetigen(page);
    expect(new URL((await anfrage).url()).search).toBe('?version=0');

    await expect(page.locator('app-vertrag-zeile .name', { hasText: KFZ })).toHaveCount(0);
    await expect(page.locator('app-vertrag-zeile')).toHaveCount(BEISPIEL_VERTRAEGE.length - 1);
    await expect(page.getByText('Laufende Verträge5')).toBeVisible();
  });

  test('die Meldung steht über dem nächsten Vertrag, die Position bleibt', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.getByRole('button', { name: 'Rundfunkbeitrag löschen' }).scrollIntoViewIfNeeded();
    await loeschenBestaetigen(page, 'Rundfunkbeitrag');

    const meldung = page
      .getByRole('status')
      .filter({ hasText: '„Rundfunkbeitrag“ wurde gelöscht.' });
    await expect(meldung).toBeInViewport();
    await expect(zeile(page, 'Sprachschule').getByRole('status')).toContainText('wurde gelöscht');
    await expect(page.getByRole('heading', { level: 1 })).not.toBeInViewport();
  });

  test('beim letzten Vertrag steht die Meldung unter dem davor', async ({ page }) => {
    await loeschenBestaetigen(page, LETZTE);
    const davor = zeile(page, 'Zeitschriften-Abo');
    await expect(davor.getByRole('status')).toContainText(`„${LETZTE}“ wurde gelöscht.`);
    const meldung = await davor.getByRole('status').boundingBox();
    const name = await davor.locator('.name').boundingBox();
    expect(meldung!.y).toBeGreaterThan(name!.y);
  });

  test('die Lösch-Meldung ist durch einen Trenner vom Vertrag abgesetzt', async ({ page }) => {
    const rand = (name: string, seite: 'Top' | 'Bottom') =>
      zeile(page, name)
        .locator('.meldung')
        .evaluate((e, s) => getComputedStyle(e)[`border${s}Width` as 'borderTopWidth'], seite);

    await loeschenBestaetigen(page, 'Rundfunkbeitrag');
    await expect(zeile(page, 'Sprachschule').getByRole('status')).toBeVisible();
    expect(await rand('Sprachschule', 'Bottom')).toBe('1px');

    await loeschenBestaetigen(page, LETZTE);
    await expect(zeile(page, 'Zeitschriften-Abo').getByRole('status')).toBeVisible();
    expect(await rand('Zeitschriften-Abo', 'Top')).toBe('1px');

    await page.getByRole('button', { name: `${KFZ} bearbeiten` }).click();
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(zeile(page, KFZ).getByRole('status')).toBeVisible();
    expect(await rand(KFZ, 'Bottom')).toBe('0px');
  });

  test('der letzte verbleibende Vertrag: Meldung oben und Leerzustand', async ({ page }) => {
    for (const name of [
      KFZ,
      ERSTE_NACH_KFZ,
      'Rundfunkbeitrag',
      'Sprachschule',
      'Software GmbH',
      'Zeitschriften-Abo',
    ]) {
      await loeschenBestaetigen(page, name);
      await expect(page.getByText(`„${name}“ wurde gelöscht.`)).toBeVisible();
    }
    await loeschenBestaetigen(page, LETZTE);
    await expect(page.getByText('Noch keine Verträge')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: `„${LETZTE}“` })).toBeInViewport();
  });

  test('404 gilt als gelöscht, ohne Fehlermeldung', async ({ page }) => {
    // Erst wenn die Liste da ist, sonst träfe die Umleitung unten schon das erste Laden.
    await expect(loeschKnopf(page, KFZ)).toBeVisible();
    await page.route('/api/vertraege/kfz?version=0', (route) =>
      route.fulfill(problem(404, 'NICHT_GEFUNDEN')),
    );
    await page.route('/api/vertraege', (route) =>
      route.fulfill({ json: BEISPIEL_VERTRAEGE.filter((v) => v.id !== 'kfz') }),
    );
    await loeschenBestaetigen(page);
    await expect(page.getByText(`„${KFZ}“ wurde gelöscht.`)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('409: Hinweis an der Zeile, der Vertrag bleibt', async ({ page }) => {
    await page.route('/api/vertraege/kfz?version=0', (route) =>
      route.fulfill(problem(409, 'KONFLIKT')),
    );
    await loeschenBestaetigen(page);
    await expect(zeile(page, KFZ).getByRole('alert')).toHaveText(
      'Der Vertrag wurde inzwischen geändert. Bitte prüfen und erneut löschen.',
    );
    await expect(page.locator('app-vertrag-zeile')).toHaveCount(BEISPIEL_VERTRAEGE.length);
  });

  test('Serverfehler: allgemeiner Text, `detail` wird nie gezeigt, erneut möglich', async ({
    page,
  }) => {
    await page.route(
      '/api/vertraege/kfz?version=0',
      (route) => route.fulfill(problem(500, 'INTERNER_FEHLER')),
      { times: 1 },
    );
    await loeschenBestaetigen(page);
    await expect(zeile(page, KFZ).getByRole('alert')).toHaveText(
      'Der Vertrag konnte nicht gelöscht werden. Bitte versuche es später erneut.',
    );
    await expect(page.getByText('English detail')).toHaveCount(0);

    await loeschenBestaetigen(page);
    await expect(page.getByText(`„${KFZ}“ wurde gelöscht.`)).toBeVisible();
  });

  test.describe('bei offenem, geändertem Formular', () => {
    async function formularMitAenderung(page: Page, name: string) {
      await page.getByRole('button', { name: `${name} bearbeiten` }).click();
      const formular = page.getByRole('form', { name: `${name} bearbeiten` });
      await formular.getByLabel('Notiz').fill('Meine Eingabe');
      return formular;
    }

    test('anderer Vertrag: kein „Verwerfen“, Formular und Eingaben bleiben', async ({ page }) => {
      const formular = await formularMitAenderung(page, KFZ);
      await loeschenBestaetigen(page, 'Rundfunkbeitrag');
      await expect(page.getByText('„Rundfunkbeitrag“ wurde gelöscht.')).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(formular.getByLabel('Notiz')).toHaveValue('Meine Eingabe');

      await page.getByRole('link', { name: 'Zur Übersicht' }).click();
      await expect(page.getByRole('dialog', { name: 'Änderungen verwerfen?' })).toBeVisible();
    });

    test('derselbe Vertrag: nur die Lösch-Frage, danach ist nichts mehr offen', async ({
      page,
    }) => {
      await formularMitAenderung(page, KFZ);
      await loeschenBestaetigen(page);
      await expect(page.getByText(`„${KFZ}“ wurde gelöscht.`)).toBeVisible();
      await expect(page.getByRole('form')).toHaveCount(0);

      await page.getByRole('link', { name: 'Zur Übersicht' }).click();
      await expect(page).toHaveURL(/\/start$/);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('derselbe Vertrag, „Abbrechen“: Formular und Eingaben bleiben', async ({ page }) => {
      const formular = await formularMitAenderung(page, KFZ);
      await loeschKnopf(page, KFZ).click();
      await dialog(page, KFZ).getByRole('button', { name: 'Abbrechen' }).click();
      await expect(formular.getByLabel('Notiz')).toHaveValue('Meine Eingabe');
    });

    test('409 am selben Vertrag schließt das Formular', async ({ page }) => {
      await formularMitAenderung(page, KFZ);
      await page.route('/api/vertraege/kfz?version=0', (route) =>
        route.fulfill(problem(409, 'KONFLIKT')),
      );
      await loeschenBestaetigen(page);
      await expect(zeile(page, KFZ).getByRole('alert')).toBeVisible();
      await expect(page.getByRole('form')).toHaveCount(0);
    });
  });

  test('auf dem Handy passt alles in die Breite', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await loeschKnopf(page, KFZ).click();
    await expect(dialog(page, KFZ)).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
  });
});
