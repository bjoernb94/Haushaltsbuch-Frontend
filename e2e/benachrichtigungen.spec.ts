import { expect, Page, test } from '@playwright/test';
import {
  abmelden,
  backendSimulieren,
  BEISPIEL_VERTRAEGE,
  glocke,
  MAX,
  toasts,
} from './backend-mock';

const center = (page: Page) => page.getByRole('dialog', { name: 'Benachrichtigungen' });

/** Löscht einen Vertrag über das Menü der Zeile; das erzeugt einen Erfolgs-Toast. */
async function loeschen(page: Page, name: string) {
  await page.getByRole('button', { name: `Aktionen für ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Löschen …' }).click();
  await page
    .getByRole('dialog', { name: `„${name}“ löschen?` })
    .getByRole('button', { name: 'Ja, löschen' })
    .click();
  await expect(toasts(page)).toContainText(`„${name}“ wurde gelöscht.`);
}

/** 401 auf alles unter /api: Die Sitzung ist abgelaufen. */
async function sitzungAbgelaufen(page: Page) {
  await page.route('/api/**', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      json: { status: 401, code: 'NICHT_ANGEMELDET', detail: 'Authentication required.' },
    }),
  );
}

async function anmelden(page: Page) {
  await page.getByLabel('E-Mail-Adresse').fill(MAX.email);
  await page.getByLabel('Passwort', { exact: true }).fill('geheim123');
  await page.getByRole('button', { name: 'Login' }).click();
}

test.describe('Benachrichtigungen', () => {
  test.beforeEach(async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');
    await expect(page.locator('app-vertrag-zeile')).toHaveCount(BEISPIEL_VERTRAEGE.length);
  });

  test('die Live-Region steht vor der ersten Meldung bereit', async ({ page }) => {
    await expect(toasts(page).locator('[aria-live="polite"]')).toBeAttached();
    await expect(toasts(page).getByRole('status')).toHaveCount(0);
    await expect(glocke(page)).toHaveAccessibleName('Benachrichtigungen');
  });

  test('Toast oben rechts unter der Glocke; nach Ablauf ungelesen im Center', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loeschen(page, 'Rundfunkbeitrag');
    const toast = toasts(page).getByRole('status');
    const box = (await toast.boundingBox())!;
    const kopf = (await page.getByRole('banner').boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(kopf.y + kopf.height);
    expect(Math.round(box.x + box.width)).toBe(1280 - 24);
    await expect(toast.locator('.zeit')).toBeVisible();

    // Erfolg steht 5 s.
    await expect(toast).toHaveCount(0, { timeout: 7000 });
    await expect(glocke(page)).toHaveAccessibleName('Benachrichtigungen, 1 ungelesen');
    await expect(glocke(page).locator('.zaehler')).toHaveText('1');

    await glocke(page).click();
    await expect(center(page)).toBeFocused();
    const eintrag = center(page).getByRole('listitem');
    await expect(eintrag).toContainText('Ungelesen, Erfolg: „Rundfunkbeitrag“ wurde gelöscht.');
    await expect(eintrag).toContainText('Gerade eben');
  });

  test('Schließen legt gelesen ab; Maus darauf hält die Zeit an', async ({ page }) => {
    await loeschen(page, 'Rundfunkbeitrag');
    const toast = toasts(page).getByRole('status');
    await toast.hover();
    await page.waitForTimeout(6000);
    await expect(toast).toBeVisible();

    await toast.getByRole('button', { name: 'Meldung schließen' }).click();
    await expect(toast).toHaveCount(0);
    await expect(glocke(page)).toHaveAccessibleName('Benachrichtigungen');
    await glocke(page).click();
    await expect(center(page).getByRole('listitem')).toHaveCount(1);
    await expect(center(page)).toContainText('Alles gelesen');
  });

  test('höchstens drei Toasts; Fehler bleiben, bis man sie schließt', async ({ page }) => {
    await page.route('/api/vertraege/kurs?version=0', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/problem+json',
        json: { status: 500, code: 'INTERNER_FEHLER' },
      }),
    );
    await loeschen(page, 'Kfz-Versicherung');
    await loeschen(page, 'Rundfunkbeitrag');
    await page.getByRole('button', { name: 'Aktionen für Sprachschule' }).click();
    await page.getByRole('menuitem', { name: 'Löschen …' }).click();
    await page.getByRole('button', { name: 'Ja, löschen' }).click();
    await expect(toasts(page).getByRole('alert')).toBeVisible();
    await loeschen(page, 'Internet');

    // Der älteste zeitgesteuerte ist ins Center gewandert.
    await expect(toasts(page).locator('.toast')).toHaveCount(3);
    await expect(toasts(page)).not.toContainText('Kfz-Versicherung');
    await expect(glocke(page)).toHaveAccessibleName(/1 ungelesen/);

    await expect(toasts(page).getByRole('status')).toHaveCount(0, { timeout: 8000 });
    await expect(toasts(page).getByRole('alert')).toBeVisible();
  });

  test('im Center: gelesen markieren, entfernen, alle; Esc schließt zur Glocke', async ({
    page,
  }) => {
    for (const name of ['Kfz-Versicherung', 'Rundfunkbeitrag']) {
      await loeschen(page, name);
      await toasts(page).getByRole('button', { name: 'Meldung schließen' }).first().click();
    }
    await loeschen(page, 'Internet');
    await expect(toasts(page).getByRole('status')).toHaveCount(0, { timeout: 7000 });

    await glocke(page).click();
    const eintraege = center(page).getByRole('listitem');
    await expect(eintraege).toHaveCount(3);
    await expect(eintraege.first()).toContainText('„Internet“');
    await center(page)
      .getByRole('button', { name: '„„Internet“ wurde gelöscht.“ als gelesen markieren' })
      .click();
    await expect(center(page)).toBeFocused();
    await expect(center(page)).toContainText('Alles gelesen');

    await center(page)
      .getByRole('button', { name: '„„Rundfunkbeitrag“ wurde gelöscht.“ entfernen' })
      .click();
    await expect(eintraege).toHaveCount(2);

    await center(page).getByRole('button', { name: 'Alle entfernen' }).click();
    await expect(center(page)).toContainText('Keine Benachrichtigungen');

    await page.keyboard.press('Escape');
    await expect(center(page)).toHaveCount(0);
    await expect(glocke(page)).toBeFocused();
  });

  test('das Center übersteht Neuladen und Seitenwechsel, Abmelden leert es', async ({ page }) => {
    await loeschen(page, 'Rundfunkbeitrag');
    await toasts(page).getByRole('button', { name: 'Meldung schließen' }).click();
    await page.reload();
    await glocke(page).click();
    await expect(center(page).getByRole('listitem')).toHaveCount(1);
    await page.keyboard.press('Escape');

    await page
      .getByRole('navigation', { name: 'Hauptmenü' })
      .getByRole('link', { name: 'Übersicht' })
      .click();
    await glocke(page).click();
    await expect(center(page).getByRole('listitem')).toHaveCount(1);
    await page.keyboard.press('Escape');

    await abmelden(page);
    await expect(page).toHaveURL(/\/login$/);
    await expect(toasts(page).getByRole('status')).toHaveText('Erfolg: Du wurdest abgemeldet.');
    expect(
      await page.evaluate(() => sessionStorage.getItem('haushaltsbuch.benachrichtigungen')),
    ).toBeNull();

    await anmelden(page);
    await expect(page).toHaveURL(/\/start$/);
    await glocke(page).click();
    await expect(center(page)).toContainText('Keine Benachrichtigungen');
  });

  test('ein anderer Nutzer sieht das Center nicht', async ({ page }) => {
    await page.evaluate(() =>
      sessionStorage.setItem(
        'haushaltsbuch.benachrichtigungen',
        JSON.stringify({
          nutzer: 'erika@beispiel.de',
          eintraege: [{ id: 'x', art: 'erfolg', titel: 'Fremd', zeit: Date.now(), gelesen: false }],
        }),
      ),
    );
    await page.reload();
    await expect(glocke(page)).toHaveAccessibleName('Benachrichtigungen');
    await glocke(page).click();
    await expect(center(page)).toContainText('Keine Benachrichtigungen');
  });

  test('abgelaufene Sitzung: Hinweis bleibt auf dem Login, bis die Anmeldung gelingt', async ({
    page,
  }) => {
    await loeschen(page, 'Rundfunkbeitrag');
    await toasts(page).getByRole('button', { name: 'Meldung schließen' }).click();
    await loeschen(page, 'Internet');
    await sitzungAbgelaufen(page);
    await page
      .getByRole('navigation', { name: 'Hauptmenü' })
      .getByRole('link', { name: 'Übersicht' })
      .click();
    await expect(page).toHaveURL(/\/login\?returnUrl=/);

    // Was dem Nutzer gehörte (der Toast zu „Internet“), ist weg; der Hinweis steht, ohne Zeitbalken.
    const hinweis = toasts(page).getByRole('status');
    await expect(hinweis).toHaveCount(1);
    await expect(hinweis).toContainText('Deine Sitzung ist abgelaufen.');
    await expect(hinweis).toContainText('Bitte melde dich erneut an.');
    await expect(hinweis.locator('.zeit')).toHaveCount(0);
    const box = (await hinweis.boundingBox())!;
    expect(box.y).toBeLessThan(60);

    await page.unroute('/api/**');
    await anmelden(page);
    await expect(page).toHaveURL(/\/start$/);
    await expect(toasts(page).getByRole('status')).toHaveCount(0);
    await glocke(page).click();
    // Dasselbe Konto: Sein Center ist wieder da, ohne den Hinweis.
    await expect(center(page).getByRole('listitem')).toHaveCount(1);
    await expect(center(page)).not.toContainText('Sitzung');
  });
});

for (const [breite, abstand] of [
  [1280, 12],
  [390, 8],
] as const) {
  test(
    `mit Streifen der Umgebung: gescrollt derselbe Abstand unter der Kopfzeile wie oben (${breite} px)`,
    { tag: '@mobil' },
    async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: breite, height: 700 });
      await backendSimulieren(page, {
        angemeldet: true,
        stage: 'DEV',
        vertraege: BEISPIEL_VERTRAEGE,
      });
      await page.goto('/vertraege');
      const name = breite > 900 ? 'Internet' : 'Kfz-Versicherung';
      if (breite > 900) {
        await page.getByRole('button', { name: `Aktionen für ${name}` }).scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollBy(0, 200));
        await loeschen(page, name);
      } else {
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.getByRole('button', { name: `Details zu ${name} anzeigen` }).click();
        await page.getByRole('button', { name: 'Vertrag löschen' }).click();
        await page.getByRole('button', { name: 'Ja, löschen' }).click();
      }
      const toast = toasts(page).getByRole('status');
      await expect(toast).toBeVisible();
      const abstandUnterKopf = async () => {
        const t = (await toast.boundingBox())!;
        const k = (await page.getByRole('banner').boundingBox())!;
        return Math.round(t.y - (k.y + k.height));
      };
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(24);
      await expect.poll(abstandUnterKopf).toBe(abstand);

      // Wieder ganz oben: Der Streifen schiebt die Kopfzeile nach unten, der Toast geht mit.
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(abstandUnterKopf).toBe(abstand);
    },
  );
}

test('nach der Registrierung ohne automatische Anmeldung: Toast auf dem Login', async ({
  page,
}) => {
  await backendSimulieren(page);
  await page.goto('/registrierung');
  // Die automatische Anmeldung scheitert.
  await page.route('/api/nutzer/ich', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      json: { status: 401, code: 'NICHT_ANGEMELDET' },
    }),
  );
  await page.getByLabel('E-Mail-Adresse').fill('neu@beispiel.de');
  await page.getByLabel('Passwort', { exact: true }).fill('Geheim12!');
  await page.getByLabel('Name', { exact: true }).fill('Muster');
  await page.getByLabel('Vorname').fill('Max');
  await page.getByLabel(/Portfolio/).check();
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).toHaveURL(/\/login$/);
  const toast = toasts(page).getByRole('status');
  await expect(toast).toContainText('Dein Konto wurde angelegt.');
  await expect(toast).toContainText('Bitte melde dich an.');
});

test(
  'auf dem Handy: Toast über die volle Breite, Center als Blatt von unten',
  { tag: '@mobil' },
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege/kfz');
    await page.getByRole('button', { name: 'Vertrag löschen' }).click();
    await page.getByRole('button', { name: 'Ja, löschen' }).click();
    const toast = toasts(page).getByRole('status');
    await expect(toast).toBeVisible();
    const box = (await toast.boundingBox())!;
    expect([box.x, Math.round(box.width)]).toEqual([16, 358]);

    await glocke(page).click();
    const blatt = (await center(page).boundingBox())!;
    expect([blatt.x, blatt.width, Math.round(blatt.y + blatt.height)]).toEqual([0, 390, 844]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  },
);
