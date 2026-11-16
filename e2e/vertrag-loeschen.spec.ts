import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, BEISPIEL_VERTRAEGE } from './backend-mock';

const KFZ = 'Kfz-Versicherung';
const ERSTE_NACH_KFZ = 'Fitnessstudio am Park';
const LETZTE = 'Mobilfunk GmbH';

const zeile = (page: Page, name: string) =>
  page.locator('app-vertrag-zeile').filter({ hasText: name });
const dialog = (page: Page, name: string) =>
  page.getByRole('dialog', { name: `„${name}“ löschen?` });
const mehr = (page: Page, name: string) =>
  page.getByRole('button', { name: `Aktionen für ${name}` });

/** Über das Menü der Zeile. */
async function loeschenFragen(page: Page, name: string) {
  await mehr(page, name).click();
  await page.getByRole('menuitem', { name: 'Löschen …' }).click();
}

async function loeschenBestaetigen(page: Page, name = KFZ) {
  await loeschenFragen(page, name);
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
    await loeschenFragen(page, KFZ);
    await expect(dialog(page, KFZ)).toBeVisible();
    await expect(dialog(page, KFZ)).toContainText('Das lässt sich nicht rückgängig machen.');
    const abbrechen = dialog(page, KFZ).getByRole('button', { name: 'Abbrechen' });
    await expect(abbrechen).toBeFocused();

    await abbrechen.click();
    await expect(dialog(page, KFZ)).toHaveCount(0);
    await expect(mehr(page, KFZ)).toBeFocused();

    await loeschenFragen(page, KFZ);
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
    await mehr(page, 'Rundfunkbeitrag').scrollIntoViewIfNeeded();
    await loeschenBestaetigen(page, 'Rundfunkbeitrag');

    const meldung = page
      .getByRole('status')
      .filter({ hasText: '„Rundfunkbeitrag“ wurde gelöscht.' });
    await expect(meldung).toBeInViewport();
    await expect(zeile(page, 'Sprachschule').getByRole('status')).toContainText('wurde gelöscht');
    // Die Werkzeugleiste steht am Desktop immer oben, die Kennzahlen nicht.
    await expect(page.getByText('Laufende Verträge')).not.toBeInViewport();
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

    await mehr(page, KFZ).click();
    await page.getByRole('menuitem', { name: 'Bearbeiten …' }).click();
    await page
      .getByRole('dialog', { name: 'Vertrag bearbeiten' })
      .getByRole('button', { name: 'Sichern' })
      .click();
    await expect(zeile(page, KFZ).getByRole('status')).toBeVisible();
    expect(await rand(KFZ, 'Bottom')).toBe('0px');
  });

  test('der letzte verbleibende Vertrag: Meldung oben und Leerzustand', async ({ page }) => {
    for (const name of [
      KFZ,
      ERSTE_NACH_KFZ,
      'Rundfunkbeitrag',
      'Sprachschule',
      'Internet',
      'Streamingdienst',
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
    await expect(mehr(page, KFZ)).toBeVisible();
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

  test('aus den Details: fragt, löscht und schließt sie', async ({ page }) => {
    await page.getByRole('button', { name: `Details zu ${KFZ} anzeigen` }).click();
    const details = page.getByRole('complementary', { name: KFZ });
    await details.getByRole('button', { name: 'Vertrag löschen' }).click();
    await dialog(page, KFZ).getByRole('button', { name: 'Ja, löschen' }).click();
    await expect(page).toHaveURL(/\/vertraege$/);
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await expect(page.getByText(`„${KFZ}“ wurde gelöscht.`)).toBeVisible();
    await expect(page.getByText('Diesen Vertrag gibt es nicht mehr.')).toHaveCount(0);
  });

  test('„Abbrechen“ in den Details lässt sie offen', async ({ page }) => {
    await page.goto('/vertraege/kfz');
    const details = page.getByRole('complementary', { name: KFZ });
    await details.getByRole('button', { name: 'Vertrag löschen' }).click();
    await dialog(page, KFZ).getByRole('button', { name: 'Abbrechen' }).click();
    await expect(details).toBeVisible();
    await expect(details.getByRole('button', { name: 'Vertrag löschen' })).toBeFocused();
  });

  test('auf dem Handy passt alles in die Breite', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/vertraege/kfz');
    await page
      .getByRole('complementary', { name: KFZ })
      .getByRole('button', { name: 'Vertrag löschen' })
      .click();
    await expect(dialog(page, KFZ)).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
  });
});
