import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, BEISPIEL_VERTRAEGE } from './backend-mock';

const KFZ = 'Kfz-Versicherung';

const zeile = (page: Page, name: string) =>
  page.locator('app-vertrag-zeile').filter({ hasText: name });
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Vertrag bearbeiten' });
const details = (page: Page, name: string) => page.getByRole('complementary', { name });

/** Aus der Liste über das Menü der Zeile. */
async function bearbeiten(page: Page, name = KFZ) {
  await page.getByRole('button', { name: `Aktionen für ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Bearbeiten …' }).click();
  const formular = sheet(page).getByRole('form', { name: `${name} bearbeiten` });
  await expect(formular).toBeVisible();
  return formular;
}

async function tab(page: Page, name: 'Allgemein' | 'Kosten' | 'Laufzeit') {
  await sheet(page)
    .getByRole('tab', { name: new RegExp(`^${name}`) })
    .click();
}

async function speichernUndAnfrageLesen(page: Page) {
  const anfrage = page.waitForRequest((r) => r.method() === 'PUT');
  await sheet(page).getByRole('button', { name: 'Sichern' }).click();
  return (await anfrage).postDataJSON();
}

test.describe('Vertrag bearbeiten', () => {
  test.beforeEach(async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');
  });

  test('öffnet als Sheet in der Fenstermitte mit den gespeicherten Werten', async ({ page }) => {
    const formular = await bearbeiten(page);
    await expect(page).toHaveURL(/\/vertraege\/kfz\/bearbeiten$/);
    await expect(sheet(page)).toContainText(KFZ);

    await expect(formular.getByLabel('Anbieter *')).toHaveValue('Musterversicherung AG');
    await expect(formular.getByLabel('Anbieter *')).toBeFocused();
    await expect(formular.getByLabel('Bezeichnung')).toHaveValue(KFZ);
    await expect(formular.getByLabel('Betrag in € *')).toHaveValue('586,80');
    await expect(formular.getByLabel('Zahlweise *')).toHaveValue('JAEHRLICH');
    await expect(formular.getByLabel('Nächste Abbuchung *')).toHaveValue('2027-01-01');
    await expect(formular.getByLabel('Zahlungsweg')).toHaveValue('LASTSCHRIFT');
    await expect(formular.getByLabel('Verlängerung')).toHaveValue('ZWOELF_MONATE');
    await expect(formular.getByLabel('Kündigungsfrist')).toHaveValue('1');
    await expect(
      sheet(page)
        .getByRole('tablist', { name: 'Bereiche des Vertrags bearbeiten' })
        .getByRole('tab'),
    ).toHaveText(['Allgemein', 'Kosten', 'Laufzeit']);
    await expect(sheet(page).getByRole('complementary')).toHaveCount(0);
    // Abbrechen und Sichern stehen nur in der Leiste.
    await expect(formular.getByRole('button', { name: 'Speichern' })).toBeHidden();

    const box = (await sheet(page).boundingBox())!;
    expect(box.width).toBe(800);
    expect(Math.round(box.x + box.width / 2)).toBe(640);
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

    // Aus der Liste geöffnet, geht es zur Liste zurück.
    await expect(page).toHaveURL(/\/vertraege$/);
    await expect(sheet(page)).toHaveCount(0);
    const meldung = zeile(page, KFZ).getByText(`„${KFZ}“ wurde gespeichert.`);
    await expect(meldung).toBeVisible();
    await expect(meldung).toBeInViewport();
  });

  test('aus den Details geöffnet, geht es zu den Details zurück, mit der Meldung dort', async ({
    page,
  }) => {
    await page.getByRole('button', { name: `Details zu ${KFZ} anzeigen` }).click();
    await details(page, KFZ).getByRole('button', { name: 'Bearbeiten' }).click();
    await expect(page).toHaveURL(/\/vertraege\/kfz\/bearbeiten$/);
    await sheet(page).getByLabel('Notiz').fill('Neu');
    await speichernUndAnfrageLesen(page);

    await expect(page).toHaveURL(/\/vertraege\/kfz$/);
    await expect(details(page, KFZ).getByRole('status')).toHaveText(`„${KFZ}“ wurde gespeichert.`);
    await expect(zeile(page, KFZ).getByRole('status')).toHaveCount(0);

    // Bearbeiten liegt nicht mehr im Verlauf.
    await page.goBack();
    await expect(page).toHaveURL(/\/vertraege$/);
  });

  test('ein geteilter Link öffnet das Sheet über den Details', async ({ page }) => {
    await page.goto('/vertraege/kfz/bearbeiten');
    await expect(sheet(page)).toBeVisible();
    await expect(details(page, KFZ)).toBeAttached();
    await sheet(page).getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page).toHaveURL(/\/vertraege\/kfz$/);
    await expect(details(page, KFZ)).toBeVisible();
  });

  test('ein neues Datum wird Anker, die Zahlweise zeigt den Hinweis', async ({ page }) => {
    const formular = await bearbeiten(page);
    await tab(page, 'Kosten');
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
    await tab(page, 'Laufzeit');
    await expect(formular.getByLabel('Nicht kündbar')).toBeChecked();
    await expect(formular.getByLabel('Verlängerung')).toHaveCount(0);
    await formular.getByLabel('Nicht kündbar').uncheck();
    await expect(formular.getByLabel('Verlängerung')).toBeVisible();
    expect((await speichernUndAnfrageLesen(page)).kuendbar).toBe(true);

    await expect(sheet(page)).toHaveCount(0);
    const gekuendigt = await bearbeiten(page, 'Zeitschriften-Abo');
    await tab(page, 'Laufzeit');
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
    await tab(page, 'Laufzeit');
    const gespeichert = BEISPIEL_VERTRAEGE.find((v) => v.bezeichnung === KFZ)!;
    expect((await vorschau).postDataJSON().abbuchungAb).toBe(gespeichert.abbuchungAb);
    const termin = formular.getByRole('status').filter({ hasText: 'Nächster Kündigungstermin:' });
    await expect(termin).toContainText('Kündbar bis');
    await formular.getByLabel('Gekündigt', { exact: true }).check();
    await formular.getByLabel('Gekündigt zum').fill('2027-06-30');
    await expect(termin).toContainText('Gekündigt zum 30.06.2027');
  });

  test('Feldfehler: Sheet bleibt offen und zeigt sie am Feld', async ({ page }) => {
    const formular = await bearbeiten(page);
    await tab(page, 'Kosten');
    await formular.getByLabel('Betrag in € *').fill('19,999');
    await sheet(page).getByRole('button', { name: 'Sichern' }).click();
    await expect(formular.getByRole('alert')).toHaveText('Bitte prüfe die markierten Felder.');
    await expect(formular.getByLabel('Betrag in € *')).toHaveAccessibleDescription(
      'Höchstens 2 Nachkommastellen.',
    );
    await expect(formular.getByLabel('Betrag in € *')).toBeFocused();
    await expect(page).toHaveURL(/\/bearbeiten$/);
  });

  test('409: Hinweis an der Zeile, Sheet zu, Stand neu geladen', async ({ page }) => {
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
    await sheet(page).getByRole('button', { name: 'Sichern' }).click();
    await neu;

    await expect(
      zeile(page, KFZ).getByText(
        'Der Vertrag wurde inzwischen geändert. Bitte prüfen und erneut bearbeiten.',
      ),
    ).toBeVisible();
    await expect(sheet(page)).toHaveCount(0);
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
    await sheet(page).getByRole('button', { name: 'Sichern' }).click();

    await expect(page).toHaveURL(/\/vertraege$/);
    await expect(page.locator('app-vertrag-zeile')).toHaveCount(BEISPIEL_VERTRAEGE.length - 1);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Diesen Vertrag gibt es nicht mehr.' }),
    ).toBeVisible();
    await expect(page.locator('app-vertrag-zeile').getByRole('alert')).toHaveCount(0);
  });

  test.describe('Änderungen verwerfen', () => {
    const dialog = (page: Page) => page.getByRole('dialog', { name: 'Änderungen verwerfen?' });

    async function mitAenderung(page: Page) {
      const formular = await bearbeiten(page);
      await formular.getByLabel('Notiz').fill('Meine Eingabe');
      return formular;
    }

    test('ohne Änderung kein Dialog: Abbrechen, Esc und Klick daneben', async ({ page }) => {
      const formular = await bearbeiten(page);
      await formular.getByLabel('Notiz').fill('x');
      await formular.getByLabel('Notiz').fill('');
      await sheet(page).getByRole('button', { name: 'Abbrechen' }).click();
      await expect(sheet(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: `Aktionen für ${KFZ}` })).toBeFocused();

      await bearbeiten(page);
      await page.keyboard.press('Escape');
      await expect(sheet(page)).toHaveCount(0);

      await bearbeiten(page);
      await page.mouse.click(5, 300);
      await expect(sheet(page)).toHaveCount(0);
      await expect(dialog(page)).toHaveCount(0);
    });

    test('„Weiter bearbeiten“ behält alles und hat den ersten Fokus, Esc wirkt genauso', async ({
      page,
    }) => {
      const formular = await mitAenderung(page);
      await sheet(page).getByRole('button', { name: 'Abbrechen' }).click();
      await expect(dialog(page)).toBeVisible();
      const weiter = dialog(page).getByRole('button', { name: 'Weiter bearbeiten' });
      await expect(weiter).toBeFocused();

      await weiter.click();
      await expect(dialog(page)).toHaveCount(0);
      await expect(formular.getByLabel('Notiz')).toHaveValue('Meine Eingabe');
      await expect(page).toHaveURL(/\/bearbeiten$/);

      // Abbrechen geht im Verlauf zurück; direkt nach dessen Wiederherstellung schluckt der Browser das.
      await page.waitForTimeout(500);
      await page.mouse.click(5, 300);
      await expect(dialog(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
      await expect(formular.getByLabel('Notiz')).toHaveValue('Meine Eingabe');
    });

    test('Esc im Sheet fragt, „Verwerfen“ schließt', async ({ page }) => {
      const formular = await mitAenderung(page);
      await formular.getByLabel('Notiz').press('Escape');
      await expect(dialog(page)).toBeVisible();
      await dialog(page).getByRole('button', { name: 'Verwerfen' }).click();
      await expect(sheet(page)).toHaveCount(0);
      await expect(page).toHaveURL(/\/vertraege$/);

      const wieder = await bearbeiten(page);
      await expect(wieder.getByLabel('Notiz')).toHaveValue('');
    });

    test('der Zurück-Button fragt nach und der Verlauf bleibt stimmig', async ({ page }) => {
      const formular = await mitAenderung(page);

      await page.evaluate(() => history.back());
      await expect(dialog(page)).toBeVisible();
      await dialog(page).getByRole('button', { name: 'Weiter bearbeiten' }).click();
      await expect(page).toHaveURL(/\/vertraege\/kfz\/bearbeiten$/);
      await expect(formular.getByLabel('Notiz')).toHaveValue('Meine Eingabe');

      // Direkt nach der Wiederherstellung des Verlaufs schluckt der Browser ein weiteres Zurück.
      await page.waitForTimeout(500);
      await page.evaluate(() => history.back());
      await expect(dialog(page)).toBeVisible();
      await dialog(page).getByRole('button', { name: 'Verwerfen' }).click();
      await expect(page).toHaveURL(/\/vertraege$/);
      await expect(sheet(page)).toHaveCount(0);
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
      await sheet(page).getByRole('button', { name: 'Sichern' }).click();
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
      await sheet(page).getByRole('button', { name: 'Sichern' }).click();
      await expect(page).toHaveURL(/\/start$/);
      await expect(dialog(page)).toHaveCount(0);
    });

    test('nach dem Speichern kein Dialog beim Weitergehen', async ({ page }) => {
      await mitAenderung(page);
      await sheet(page).getByRole('button', { name: 'Sichern' }).click();
      await expect(zeile(page, KFZ).getByText('wurde gespeichert')).toBeVisible();
      await page
        .getByRole('navigation', { name: 'Hauptmenü' })
        .getByRole('link', { name: 'Übersicht' })
        .click();
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
      await expect(sheet(page)).toBeVisible();

      const formular = sheet(page).getByRole('form');
      await formular.getByLabel('Notiz').fill('Meine Eingabe');
      await formular.getByLabel('Notiz').click();
      await page.reload({ timeout: 1000 }).catch(() => undefined);
      expect(dialoge).toEqual(['beforeunload']);
    });

    test('der Dialog passt auf ein schmales Display', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.goto('/vertraege/kfz/bearbeiten');
      await sheet(page).getByLabel('Notiz').fill('Meine Eingabe');
      await sheet(page).getByRole('button', { name: 'Abbrechen' }).click();
      await expect(dialog(page)).toBeInViewport({ ratio: 1 });
      const breite = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(breite).toBeLessThanOrEqual(320);
    });
  });

  test('auf dem Handy: Vollbild aus den Details, Sichern in der Leiste', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: `Details zu ${KFZ} anzeigen` }).click();
    await details(page, KFZ).getByRole('button', { name: 'Bearbeiten' }).click();
    await expect(sheet(page)).toBeVisible();
    expect(await sheet(page).boundingBox()).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );

    await sheet(page).getByLabel('Notiz').fill('Vom Handy');
    const anfrage = await speichernUndAnfrageLesen(page);
    expect(anfrage.notiz).toBe('Vom Handy');
    await expect(details(page, KFZ).getByRole('status')).toContainText('wurde gespeichert');
  });
});
