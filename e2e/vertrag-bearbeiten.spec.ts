import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, BEISPIEL_VERTRAEGE } from './backend-mock';

const KFZ = 'Kfz-Versicherung';

function zeile(page: Page, name: string) {
  return page.locator('app-vertrag-zeile').filter({ hasText: name });
}

async function bearbeiten(page: Page, name = KFZ) {
  await page.getByRole('button', { name: `${name} bearbeiten` }).click();
  const formular = page.getByRole('form', { name: `${name} bearbeiten` });
  await expect(formular).toBeVisible();
  return formular;
}

async function speichernUndAnfrageLesen(page: Page) {
  const anfrage = page.waitForRequest((r) => r.method() === 'PUT');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  return (await anfrage).postDataJSON();
}

test.describe('Vertrag bearbeiten', () => {
  test.beforeEach(async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');
  });

  test('öffnet in der Zeile mit den gespeicherten Werten', async ({ page }) => {
    const knopf = page.getByRole('button', { name: `${KFZ} bearbeiten` });
    await expect(knopf).toHaveAttribute('aria-expanded', 'false');
    const formular = await bearbeiten(page);
    await expect(knopf).toHaveAttribute('aria-expanded', 'true');

    await expect(formular.getByLabel('Anbieter *')).toHaveValue('Musterversicherung AG');
    await expect(formular.getByLabel('Anbieter *')).toBeFocused();
    await expect(formular.getByLabel('Bezeichnung')).toHaveValue(KFZ);
    await expect(formular.getByLabel('Betrag in € *')).toHaveValue('586,80');
    await expect(formular.getByLabel('Zahlweise *')).toHaveValue('JAEHRLICH');
    await expect(formular.getByLabel('Nächste Abbuchung *')).toHaveValue('2027-01-01');
    await expect(formular.getByLabel('Zahlungsweg')).toHaveValue('LASTSCHRIFT');
    await expect(formular.getByLabel('Verlängerung')).toHaveValue('ZWOELF_MONATE');
    await expect(formular.getByLabel('Kündigungsfrist')).toHaveValue('1');
  });

  test('ohne Änderung bleiben alle Felder und der Anker gleich, Meldung an der Zeile', async ({
    page,
  }) => {
    await bearbeiten(page);
    expect(await speichernUndAnfrageLesen(page)).toEqual({
      version: 0,
      anbieter: 'Musterversicherung AG',
      bezeichnung: KFZ,
      kategorieId: 'kategorie-2',
      vertragsnummer: 'KFZ-4711-23',
      betrag: { wert: 586.8, waehrung: 'EUR' },
      zahlweise: 'JAEHRLICH',
      abbuchungAb: '2024-01-01',
      zahlungsweg: 'LASTSCHRIFT',
      kuendbar: true,
      beginn: '2023-01-01',
      laufzeitende: '2023-12-31',
      verlaengerung: 'ZWOELF_MONATE',
      kuendigungsfristMonate: 1,
      gekuendigtZum: null,
      notiz: null,
    });

    const meldung = zeile(page, KFZ).getByText(`„${KFZ}“ wurde gespeichert.`);
    await expect(meldung).toBeVisible();
    await expect(meldung).toBeInViewport();
    await expect(page.getByRole('form')).toHaveCount(0);
  });

  test('ein neues Datum wird Anker, die Zahlweise zeigt den Hinweis', async ({ page }) => {
    const formular = await bearbeiten(page);
    const hinweis = formular.getByText(
      'Bitte Datum der nächsten Abbuchung im neuen Rhythmus prüfen.',
    );
    await expect(hinweis).toHaveCount(0);

    await formular.getByLabel('Zahlweise *').selectOption('MONATLICH');
    await expect(hinweis).toBeVisible();
    await expect(formular.getByLabel('Nächste Abbuchung *')).toHaveAccessibleDescription(
      'Bitte Datum der nächsten Abbuchung im neuen Rhythmus prüfen.',
    );

    const anfrage = await speichernUndAnfrageLesen(page);
    expect(anfrage).toMatchObject({ zahlweise: 'MONATLICH', abbuchungAb: '2027-01-01' });
  });

  test('„Nicht kündbar“ und „Gekündigt“ lassen sich setzen und zurücknehmen', async ({ page }) => {
    const formular = await bearbeiten(page, 'Rundfunkbeitrag');
    await expect(formular.getByLabel('Nicht kündbar')).toBeChecked();
    await expect(formular.getByLabel('Verlängerung')).toHaveCount(0);
    await formular.getByLabel('Nicht kündbar').uncheck();
    await expect(formular.getByLabel('Verlängerung')).toBeVisible();
    expect((await speichernUndAnfrageLesen(page)).kuendbar).toBe(true);

    await expect(page.getByRole('form')).toHaveCount(0);
    const gekuendigt = await bearbeiten(page, 'Zeitschriften-Abo');
    await expect(gekuendigt.getByLabel('Gekündigt', { exact: true })).toBeChecked();
    await expect(gekuendigt.getByLabel('Gekündigt zum')).toHaveValue('2026-12-31');
    await gekuendigt.getByLabel('Gekündigt', { exact: true }).uncheck();
    expect((await speichernUndAnfrageLesen(page)).gekuendigtZum).toBeNull();
  });

  test('die Vorschau schickt den gespeicherten Anker und folgt einer Änderung', async ({
    page,
  }) => {
    const vorschau = page.waitForRequest((r) => r.url().endsWith('/vorschau'));
    const formular = await bearbeiten(page);
    const gespeichert = BEISPIEL_VERTRAEGE.find((v) => v.bezeichnung === KFZ)!;
    expect((await vorschau).postDataJSON().abbuchungAb).toBe(gespeichert.abbuchungAb);
    const zeile = formular.getByRole('status').filter({ hasText: 'Nächster Kündigungstermin:' });
    await expect(zeile).toContainText('Kündbar bis');
    await formular.getByLabel('Gekündigt', { exact: true }).check();
    await formular.getByLabel('Gekündigt zum').fill('2027-06-30');
    await expect(zeile).toContainText('Gekündigt zum 30.06.2027');
  });

  test('Feldfehler: Formular bleibt offen und zeigt sie am Feld', async ({ page }) => {
    const formular = await bearbeiten(page);
    await formular.getByLabel('Betrag in € *').fill('19,999');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(formular.getByRole('alert')).toHaveText('Bitte prüfe die markierten Felder.');
    await expect(formular.getByLabel('Betrag in € *')).toHaveAccessibleDescription(
      'Höchstens 2 Nachkommastellen.',
    );
    await expect(formular.getByLabel('Betrag in € *')).toBeFocused();
  });

  test('409: Hinweis an der Zeile, Formular zu, Stand neu geladen', async ({ page }) => {
    const formular = await bearbeiten(page);
    await formular.getByLabel('Notiz').fill('Meine Eingabe');
    await page.route('/api/vertraege/kfz', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/problem+json',
        json: { status: 409, code: 'KONFLIKT', detail: 'Changed' },
      }),
    );
    const neu = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/vertraege');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await neu;

    await expect(
      zeile(page, KFZ).getByText(
        'Der Vertrag wurde inzwischen geändert. Bitte prüfen und erneut bearbeiten.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('form')).toHaveCount(0);
  });

  test('404: Hinweis oben, Zeile fehlt nach dem Neuladen', async ({ page }) => {
    await bearbeiten(page);
    await page.route('/api/vertraege/kfz', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        json: { status: 404, code: 'NICHT_GEFUNDEN', detail: 'Gone' },
      }),
    );
    await page.route('/api/vertraege', (route) =>
      route.fulfill({ json: BEISPIEL_VERTRAEGE.filter((v) => v.id !== 'kfz') }),
    );
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();

    await expect(page.locator('app-vertrag-zeile')).toHaveCount(BEISPIEL_VERTRAEGE.length - 1);
    const meldung = page
      .getByRole('alert')
      .filter({ hasText: 'Diesen Vertrag gibt es nicht mehr.' });
    await expect(meldung).toBeVisible();
    await expect(page.locator('app-vertrag-zeile').getByRole('alert')).toHaveCount(0);
  });

  test.describe('Änderungen verwerfen', () => {
    const dialog = (page: Page) => page.getByRole('dialog', { name: 'Änderungen verwerfen?' });

    async function mitAenderung(page: Page) {
      const formular = await bearbeiten(page);
      await formular.getByLabel('Notiz').fill('Meine Eingabe');
      return formular;
    }

    test('ohne Änderung kein Dialog: anderes „Bearbeiten“, Details, Abbrechen und Menü', async ({
      page,
    }) => {
      const formular = await bearbeiten(page);
      await formular.getByLabel('Notiz').fill('x');
      await formular.getByLabel('Notiz').fill('');
      await bearbeiten(page, 'Rundfunkbeitrag');
      await page.getByRole('button', { name: `Details zu ${KFZ} anzeigen` }).click();
      await expect(page.getByRole('form')).toHaveCount(0);

      const zweites = await bearbeiten(page);
      await zweites.getByRole('button', { name: 'Abbrechen' }).click();
      await expect(page.getByRole('form')).toHaveCount(0);
      await expect(page.getByRole('button', { name: `${KFZ} bearbeiten` })).toBeFocused();

      await bearbeiten(page);
      await page.getByRole('link', { name: 'Zur Übersicht' }).click();
      await expect(page).toHaveURL(/\/start$/);
      await expect(dialog(page)).toHaveCount(0);
    });

    test('„Weiter bearbeiten“ behält alles und hat den ersten Fokus, Esc wirkt genauso', async ({
      page,
    }) => {
      const formular = await mitAenderung(page);
      await page.getByRole('button', { name: 'Rundfunkbeitrag bearbeiten' }).click();
      await expect(dialog(page)).toBeVisible();
      const weiter = dialog(page).getByRole('button', { name: 'Weiter bearbeiten' });
      await expect(weiter).toBeFocused();

      await weiter.click();
      await expect(dialog(page)).toHaveCount(0);
      await expect(formular.getByLabel('Notiz')).toHaveValue('Meine Eingabe');

      await page.getByRole('button', { name: 'Rundfunkbeitrag bearbeiten' }).click();
      await expect(dialog(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
      await expect(formular.getByLabel('Notiz')).toHaveValue('Meine Eingabe');
    });

    test('„Verwerfen“ führt die Aktion aus: Details', async ({ page }) => {
      await mitAenderung(page);
      await page.getByRole('button', { name: `Details zu ${KFZ} anzeigen` }).click();
      await dialog(page).getByRole('button', { name: 'Verwerfen' }).click();
      await expect(page.getByRole('form')).toHaveCount(0);
      await expect(page.getByRole('region', { name: `Details zu ${KFZ}` })).toBeVisible();

      const wieder = await bearbeiten(page);
      await expect(wieder.getByLabel('Notiz')).toHaveValue('');
    });

    test('„Abbrechen“ fragt bei Änderungen nach', async ({ page }) => {
      const formular = await mitAenderung(page);
      await formular.getByRole('button', { name: 'Abbrechen' }).click();
      await expect(dialog(page)).toBeVisible();
      await dialog(page).getByRole('button', { name: 'Verwerfen' }).click();
      await expect(page.getByRole('form')).toHaveCount(0);
      await expect(page.getByRole('button', { name: `${KFZ} bearbeiten` })).toBeFocused();
    });

    test('das Menü fragt nach, „Weiter bearbeiten“ bleibt auf der Seite', async ({ page }) => {
      const formular = await mitAenderung(page);
      await page
        .getByRole('navigation', { name: 'Hauptmenü' })
        .getByRole('link', { name: 'Übersicht' })
        .click();
      await expect(dialog(page)).toBeVisible();
      await dialog(page).getByRole('button', { name: 'Weiter bearbeiten' }).click();
      await expect(page).toHaveURL(/\/vertraege$/);
      await expect(formular.getByLabel('Notiz')).toHaveValue('Meine Eingabe');

      await page.getByRole('link', { name: 'Neuer Vertrag' }).click();
      await dialog(page).getByRole('button', { name: 'Verwerfen' }).click();
      await expect(page).toHaveURL(/\/vertraege\/neu$/);
    });

    test('der Zurück-Button fragt nach und der Verlauf bleibt stimmig', async ({ page }) => {
      await page.goto('/start');
      await page.getByRole('link', { name: 'Alle Verträge' }).click();
      await expect(page).toHaveURL(/\/vertraege$/);
      const formular = await mitAenderung(page);

      await page.evaluate(() => history.back());
      await expect(dialog(page)).toBeVisible();
      await dialog(page).getByRole('button', { name: 'Weiter bearbeiten' }).click();
      await expect(page).toHaveURL(/\/vertraege$/);
      await expect(formular.getByLabel('Notiz')).toHaveValue('Meine Eingabe');

      // Direkt nach der Wiederherstellung des Verlaufs schluckt der Browser ein weiteres Zurück.
      // Genau einmal zurück: Ein zweites Mal ginge bis auf die per goto geladene Seite.
      await page.waitForTimeout(500);
      await page.evaluate(() => history.back());
      await expect(dialog(page)).toBeVisible();
      await dialog(page).getByRole('button', { name: 'Verwerfen' }).click();
      await expect(page).toHaveURL(/\/start$/);
    });

    test('Abmelden fragt vor dem Abmelden nach', async ({ page }) => {
      let abgemeldet = false;
      page.on('request', (r) => {
        if (new URL(r.url()).pathname === '/api/abmeldung') abgemeldet = true;
      });
      const formular = await mitAenderung(page);
      await page.getByRole('button', { name: 'Abmelden' }).click();
      await expect(dialog(page)).toBeVisible();
      await dialog(page).getByRole('button', { name: 'Weiter bearbeiten' }).click();
      await expect(formular.getByLabel('Notiz')).toHaveValue('Meine Eingabe');
      expect(abgemeldet).toBe(false);

      await page.getByRole('button', { name: 'Abmelden' }).click();
      await dialog(page).getByRole('button', { name: 'Verwerfen' }).click();
      await expect(page).toHaveURL(/\/login/);
      await expect(dialog(page)).toHaveCount(0);
      expect(abgemeldet).toBe(true);
    });

    test('abgelaufene Sitzung leitet ohne Dialog zum Login', async ({ page }) => {
      await mitAenderung(page);
      await page.route('/api/vertraege/kfz', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/problem+json',
          json: { status: 401, code: 'NICHT_ANGEMELDET', detail: 'Authentication required.' },
        }),
      );
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await expect(page).toHaveURL(/\/login\?returnUrl=/);
      await expect(dialog(page)).toHaveCount(0);
    });

    test('abbestellte Komponente leitet ohne Dialog zur Startseite', async ({ page }) => {
      await mitAenderung(page);
      await page.route('/api/vertraege/kfz', (route) =>
        route.fulfill({
          status: 403,
          contentType: 'application/problem+json',
          json: { status: 403, code: 'KEIN_ZUGRIFF', detail: 'Access denied.' },
        }),
      );
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await expect(page).toHaveURL(/\/start$/);
      await expect(dialog(page)).toHaveCount(0);
    });

    test('nach dem Speichern kein Dialog beim Weitergehen', async ({ page }) => {
      await mitAenderung(page);
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await expect(zeile(page, KFZ).getByText('wurde gespeichert')).toBeVisible();
      await page.getByRole('link', { name: 'Zur Übersicht' }).click();
      await expect(page).toHaveURL(/\/start$/);
      await expect(dialog(page)).toHaveCount(0);
    });

    test('Neu laden zeigt den Standarddialog des Browsers nur bei Änderungen', async ({ page }) => {
      const dialoge: string[] = [];
      page.on('dialog', (d) => {
        dialoge.push(d.type());
        void d.dismiss();
      });
      await bearbeiten(page);
      await page.reload();
      expect(dialoge).toEqual([]);

      const formular = await mitAenderung(page);
      await formular.getByLabel('Notiz').click();
      await page.reload({ timeout: 1000 }).catch(() => undefined);
      expect(dialoge).toEqual(['beforeunload']);
    });

    test('der Dialog passt auf ein schmales Display', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await mitAenderung(page);
      await page.getByRole('button', { name: 'Rundfunkbeitrag bearbeiten' }).click();
      await expect(dialog(page)).toBeInViewport({ ratio: 1 });
      const breite = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(breite).toBeLessThanOrEqual(320);
    });
  });

  test.describe('scrollt die geöffnete Zeile ins Bild', () => {
    const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
    const LETZTE = 'Mobilfunk GmbH';

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1280, height: 600 });
    });

    test('Details: die ganze Zeile ist danach sichtbar, oben wie unten', async ({ page }) => {
      await page.getByRole('button', { name: `Details zu ${LETZTE} anzeigen` }).click();
      await expect(page.getByRole('region', { name: `Details zu ${LETZTE}` })).toBeInViewport({
        ratio: 1,
      });
      await expect(zeile(page, LETZTE)).toBeInViewport({ ratio: 1 });
    });

    test('schon vollständig sichtbar: Die Seite bleibt stehen', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 2400 });
      const vorher = await scrollY(page);
      await page.getByRole('button', { name: `Details zu ${KFZ} anzeigen` }).click();
      await expect(page.getByRole('region', { name: `Details zu ${KFZ}` })).toBeVisible();
      expect(await scrollY(page)).toBe(vorher);
    });

    test('schließen scrollt nicht', async ({ page }) => {
      const knopf = page.getByRole('button', { name: `Details zu ${LETZTE} anzeigen` });
      await knopf.click();
      await expect(zeile(page, LETZTE)).toBeInViewport({ ratio: 1 });
      await page.evaluate(() => window.scrollBy(0, -40));
      const vorher = await scrollY(page);
      await page.getByRole('button', { name: `Details zu ${LETZTE} ausblenden` }).click();
      await expect(page.getByRole('region', { name: `Details zu ${LETZTE}` })).toHaveCount(0);
      expect(await scrollY(page)).toBeLessThanOrEqual(vorher);
      await expect(zeile(page, LETZTE)).toBeInViewport();
    });

    test('Formular zu hoch: Die Zeile beginnt oben, das erste Feld hat den Fokus', async ({
      page,
    }) => {
      const formular = await bearbeiten(page, LETZTE);
      await expect(formular.getByLabel('Anbieter *')).toBeFocused();
      await expect.poll(async () => (await zeile(page, LETZTE).boundingBox())?.y).toBeLessThan(40);
      expect((await zeile(page, LETZTE).boundingBox())?.y).toBeGreaterThanOrEqual(0);
      await expect(formular.getByLabel('Anbieter *')).toBeInViewport();
    });

    test('klappt oben etwas zu, bleibt die angeklickte Zeile im Bild', async ({ page }) => {
      await page.getByRole('button', { name: `Details zu ${KFZ} anzeigen` }).click();
      await page.getByRole('button', { name: `Details zu ${LETZTE} anzeigen` }).click();
      await expect(page.getByRole('region', { name: `Details zu ${KFZ}` })).toHaveCount(0);
      await expect(zeile(page, LETZTE)).toBeInViewport({ ratio: 1 });
    });

    test('nach „Verwerfen“ kommt die neue Zeile ins Bild', async ({ page }) => {
      const formular = await bearbeiten(page);
      await formular.getByLabel('Notiz').fill('Meine Eingabe');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.getByRole('button', { name: `${LETZTE} bearbeiten` }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Verwerfen' }).click();
      const neu = page.getByRole('form', { name: `${LETZTE} bearbeiten` });
      await expect(neu.getByLabel('Anbieter *')).toBeInViewport();
    });

    test('Handy: Die feste Navigation verdeckt nichts', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.getByRole('button', { name: `Details zu ${LETZTE} anzeigen` }).click();
      const details = page.getByRole('region', { name: `Details zu ${LETZTE}` });
      await expect(details).toBeVisible();
      const box = await zeile(page, LETZTE).boundingBox();
      const navigation = await page.getByRole('navigation', { name: 'Hauptmenü' }).boundingBox();
      if (box!.height <= 900 - navigation!.height) {
        await expect
          .poll(async () => {
            const aktuell = await zeile(page, LETZTE).boundingBox();
            return aktuell!.y + aktuell!.height;
          })
          .toBeLessThanOrEqual(navigation!.y);
      } else {
        await expect
          .poll(async () => (await zeile(page, LETZTE).boundingBox())!.y)
          .toBeLessThan(40);
      }
    });
  });

  test('ohne Einstellung scrollt die Seite weich und kommt trotzdem an', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.getByRole('button', { name: 'Details zu Mobilfunk GmbH anzeigen' }).click();
    await expect(zeile(page, 'Mobilfunk GmbH')).toBeInViewport({ ratio: 1 });
  });

  test('passt auf ein schmales Display ohne seitliches Scrollen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await bearbeiten(page);
    const breite = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(breite).toBeLessThanOrEqual(320);
  });
});
