import { expect, Page, test } from '@playwright/test';
import { VertragAntwort } from '../src/app/core/api/api';
import { backendSimulieren, BEISPIEL_VERTRAEGE, tabsEinzeilig } from './backend-mock';

const KFZ = 'Kfz-Versicherung';
const FITNESS = 'Fitnessstudio am Park';

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

async function tab(page: Page, name: 'Allgemein' | 'Kosten' | 'Preisverlauf' | 'Laufzeit') {
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

  test('Preise: erster unter „Betrag“, alle in der Liste; ändern, entfernen, hinzufügen', async ({
    page,
  }) => {
    const formular = await bearbeiten(page, FITNESS);
    await tab(page, 'Kosten');
    await expect(formular.getByLabel('Betrag ab Vertragsbeginn in € *')).toHaveValue('29,90');
    await expect(formular.getByText(/Aktuell: 34,90\s€ seit 01\.01\.2026/)).toBeVisible();

    await tab(page, 'Preisverlauf');
    const erste = formular.locator('.preis.erster');
    await expect(erste.getByLabel('Gilt ab')).toHaveValue('01.05.2025');
    await expect(erste.getByLabel('Betrag in € *')).toHaveValue('29,90');
    const zeilen = formular.locator('.preis:not(.erster)');
    await expect(zeilen).toHaveCount(2);
    await expect(zeilen.nth(0).getByLabel('Gilt ab *')).toHaveValue('2026-01-01');
    await expect(zeilen.nth(0).getByLabel('Betrag in € *')).toHaveValue('34,90');
    await expect(zeilen.nth(1).getByLabel('Gilt ab *')).toHaveValue('2027-03-01');
    // „aktuell“ und „angekündigt“ an der Zeile, keine Infobox „Preisverlauf“.
    await expect(erste.locator('.etikett')).toHaveCount(0);
    await expect(zeilen.nth(0).locator('.etikett')).toHaveText('aktuell');
    await expect(zeilen.nth(1).locator('.etikett')).toHaveText('angekündigt');
    await expect(formular.getByRole('status').filter({ hasText: 'Preisverlauf' })).toHaveCount(0);

    await formular.getByRole('button', { name: 'Preis ab 01.03.2027 entfernen' }).click();
    await expect(zeilen).toHaveCount(1);
    await formular.getByRole('button', { name: 'Preis hinzufügen' }).click();
    await expect(zeilen.nth(1).getByLabel('Gilt ab *')).toBeFocused();
    await zeilen.nth(1).getByLabel('Gilt ab *').fill('2027-06-01');
    await zeilen.nth(1).getByLabel('Betrag in € *').fill('42');
    await expect(zeilen.nth(1).locator('.etikett')).toHaveText('angekündigt');

    expect((await speichernUndAnfrageLesen(page)).preise).toEqual([
      { gueltigAb: '2025-05-01', betrag: { wert: 29.9, waehrung: 'EUR' } },
      { gueltigAb: '2026-01-01', betrag: { wert: 34.9, waehrung: 'EUR' } },
      { gueltigAb: '2027-06-01', betrag: { wert: 42, waehrung: 'EUR' } },
    ]);
    await expect(zeile(page, FITNESS).getByText('Preis ↑ ab 01.06.2027')).toBeVisible();
  });

  test('Anteil: vorbelegt, geändert gespeichert, Chip folgt', async ({ page }) => {
    const formular = await bearbeiten(page, 'Software GmbH');
    await tab(page, 'Kosten');
    await expect(formular.getByLabel('Mein Anteil in %')).toHaveValue('50');
    await expect(formular.getByRole('status').filter({ hasText: 'Dein Anteil' })).toHaveText(
      /50 % von 5,00\s€ = 2,50\s€ monatlich/,
    );
    await formular.getByLabel('Mein Anteil in %').fill('');
    expect((await speichernUndAnfrageLesen(page)).anteilProzent).toBeNull();
    await expect(zeile(page, 'Software GmbH').getByText('Anteil 50 %')).toHaveCount(0);
  });

  test('Einmalkosten: vorbelegt, Summe aus der Vorschau; ändern, entfernen, hinzufügen', async ({
    page,
  }) => {
    const formular = await bearbeiten(page, 'Software GmbH');
    await tab(page, 'Kosten');
    const zeilen = formular.locator('app-vertrag-einmalkosten-zeilen .zeile');
    await expect(zeilen).toHaveCount(2);
    await expect(zeilen.nth(0).getByLabel('Wofür *')).toHaveValue('Lizenzschlüssel');
    await expect(zeilen.nth(1).getByLabel('Betrag in € *')).toHaveValue('30,00');
    await expect(zeilen.nth(1).getByLabel('Fällig am *')).toHaveValue('2026-02-01');
    const summe = formular.getByRole('status').filter({ hasText: 'Einmalkosten gesamt' });
    await expect(summe).toHaveText(/Einmalkosten gesamt: 50,00\s€/);

    await formular.getByRole('button', { name: 'Lizenzschlüssel entfernen' }).click();
    await expect(zeilen).toHaveCount(1);
    await expect(zeilen.nth(0).getByLabel('Wofür *')).toBeFocused();
    await expect(summe).toHaveText(/Einmalkosten gesamt: 30,00\s€/);

    await formular.getByRole('button', { name: 'Einmalkosten hinzufügen' }).click();
    await expect(zeilen.nth(1).getByLabel('Wofür *')).toBeFocused();
    await tab(page, 'Allgemein');
    await sheet(page).getByRole('button', { name: 'Sichern' }).click();
    await expect(sheet(page).getByRole('tab', { name: /^Kosten.*3 Fehler$/ })).toBeVisible();
    await expect(zeilen.nth(1).getByLabel('Wofür *')).toBeFocused();
    await expect(zeilen.nth(1).getByLabel('Wofür *')).toHaveAccessibleDescription(
      'Bitte gib an, wofür die Kosten anfallen.',
    );

    await zeilen.nth(1).getByLabel('Wofür *').fill('Hardware');
    await zeilen.nth(1).getByLabel('Betrag in € *').fill('99,50');
    await zeilen.nth(1).getByLabel('Fällig am *').fill('2026-01-10');
    await expect(summe).toHaveText(/Einmalkosten gesamt: 129,50\s€/);
    expect((await speichernUndAnfrageLesen(page)).einmalkosten).toEqual([
      {
        bezeichnung: 'Einrichtung',
        betrag: { wert: 30, waehrung: 'EUR' },
        faelligAm: '2026-02-01',
      },
      { bezeichnung: 'Hardware', betrag: { wert: 99.5, waehrung: 'EUR' }, faelligAm: '2026-01-10' },
    ]);

    await expect(sheet(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Details zu Software GmbH anzeigen' }).click();
    await details(page, 'Software GmbH').getByRole('tab', { name: 'Kosten' }).click();
    await expect(page.locator('app-vertrag-einmalkosten').getByRole('listitem')).toHaveText([
      /Hardware · fällig am 10\.01\.2026/,
      /Einrichtung · fällig am 01\.02\.2026/,
    ]);
    await expect(page.getByText('Gesamt 129,50 €')).toBeVisible();
    await expect(page.locator('.kennzahl').filter({ hasText: 'Einmalkosten 2026' })).toContainText(
      /64,75\s€/,
    );
  });

  test('Preissteigerung: vorbelegt, Prognose aus der Vorschau, geändert gespeichert', async ({
    page,
  }) => {
    const formular = await bearbeiten(page, 'Software GmbH');
    await tab(page, 'Preisverlauf');
    await expect(formular.getByRole('switch', { name: 'Preis steigt regelmäßig' })).toBeChecked();
    await expect(formular.getByLabel('Einheit der Erhöhung')).toHaveValue('BETRAG');
    await expect(formular.getByLabel('Erhöhung um *')).toHaveValue('1,00');
    await expect(formular.getByLabel('Preisgarantie bis')).toBeVisible();
    const prognose = formular.locator('.prognose > [role="status"]');
    await expect(prognose).toContainText(/ab 01\.01\.2027 voraussichtlich 6,00\s€/);

    await formular.getByLabel('Einheit der Erhöhung').selectOption({ label: '%' });
    await formular.getByLabel('Erhöhung um *').fill('10');
    await formular.getByLabel('Rhythmus').selectOption({ label: 'alle 2 Jahre' });
    await formular.getByLabel('Erste Erhöhung am *').fill('2027-01-01');
    await expect(prognose).toContainText(/ab 01\.01\.2029 voraussichtlich 6,05\s€/);
    await formular.getByLabel('Preisgarantie bis').fill('2028-12-31');
    await expect(prognose).not.toContainText('01.01.2027');
    await expect(formular.getByText('Sonderkündigungsrecht')).toBeHidden();
    await tab(page, 'Laufzeit');
    await formular.getByRole('switch', { name: 'An das Sonderkündigungsrecht erinnern' }).uncheck();

    expect(await speichernUndAnfrageLesen(page)).toMatchObject({
      preisgarantieBis: '2028-12-31',
      erinnerungSonderkuendigung: false,
      preissteigerung: {
        art: 'PROZENT',
        prozent: 10,
        betrag: null,
        rhythmus: 'ZWEIJAEHRLICH',
        naechsteAm: '2027-01-01',
      },
    });
    await expect(
      zeile(page, 'Software GmbH').getByText('Preis ↑ ab 01.01.2029 (Prognose)'),
    ).toBeVisible();
  });

  test('Preissteigerung ausschalten schickt keine Regel, Fehler stehen am Feld', async ({
    page,
  }) => {
    const formular = await bearbeiten(page, KFZ);
    const erinnerung = formular.getByRole('switch', {
      name: 'An das Sonderkündigungsrecht erinnern',
    });
    await tab(page, 'Laufzeit');
    await expect(erinnerung).toHaveCount(0);
    await tab(page, 'Preisverlauf');
    await expect(formular.getByLabel('Preisgarantie bis')).toBeVisible();
    await formular.getByRole('switch', { name: 'Preis steigt regelmäßig' }).check();
    await tab(page, 'Laufzeit');
    await expect(erinnerung).toBeVisible();
    await expect(erinnerung).toHaveAccessibleDescription(
      'Vor jeder Preiserhöhung. Ob es gilt, steht meist im Ankündigungsschreiben.',
    );
    await sheet(page).getByRole('button', { name: 'Sichern' }).click();
    await expect(sheet(page).getByRole('tab', { name: /^Preisverlauf.*2 Fehler$/ })).toBeVisible();
    await expect(formular.getByLabel('Erhöhung um *')).toBeFocused();
    await expect(formular.getByLabel('Erhöhung um *')).toHaveAccessibleDescription(
      'Bitte gib an, um wie viel der Preis steigt.',
    );

    await formular.getByRole('switch', { name: 'Preis steigt regelmäßig' }).uncheck();
    expect((await speichernUndAnfrageLesen(page)).preissteigerung).toBeNull();
  });

  test('Fehler einer Preiszeile stehen an der Zeile, der Tab zählt sie', async ({ page }) => {
    const formular = await bearbeiten(page, FITNESS);
    await tab(page, 'Preisverlauf');
    await formular.getByRole('button', { name: 'Preis hinzufügen' }).click();
    await formular.locator('.preis:not(.erster)').nth(2).getByLabel('Gilt ab *').fill('2027-03-01');
    await formular.locator('.preis:not(.erster)').nth(2).getByLabel('Betrag in € *').fill('45');
    await sheet(page).getByRole('button', { name: 'Sichern' }).click();

    await expect(sheet(page).getByRole('tab', { name: /^Preisverlauf.*1 Fehler$/ })).toBeVisible();
    const datum = formular.locator('.preis:not(.erster)').nth(2).getByLabel('Gilt ab *');
    await expect(datum).toBeFocused();
    await expect(datum).toHaveAccessibleDescription('Für dieses Datum gibt es schon einen Preis.');
  });

  test('„Preis hinzufügen“ in den Details öffnet den Tab Preisverlauf mit leerer Zeile', async ({
    page,
  }) => {
    await page.getByRole('button', { name: `Details zu ${KFZ} anzeigen` }).click();
    const panel = details(page, KFZ);
    await panel.getByRole('tab', { name: 'Preisverlauf' }).click();
    await expect(panel.getByText('Noch keine Preisänderungen hinterlegt.')).toBeVisible();
    await panel.getByRole('button', { name: 'Preis hinzufügen' }).click();

    await expect(sheet(page).getByRole('tab', { name: 'Preisverlauf' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(sheet(page).locator('.preis').getByLabel('Gilt ab *')).toBeFocused();
    // Die leere Zeile allein ist keine Änderung: Abbrechen fragt nicht.
    await sheet(page).getByRole('button', { name: 'Abbrechen' }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/vertraege\/kfz\?tab=preise$/);
  });

  test('öffnet als Sheet in der Fenstermitte mit den gespeicherten Werten', async ({ page }) => {
    const formular = await bearbeiten(page);
    await expect(page).toHaveURL(/\/vertraege\/kfz\/bearbeiten$/);
    await expect(sheet(page)).toContainText(KFZ);

    await expect(formular.getByLabel('Anbieter *')).toHaveValue('Musterversicherung AG');
    await expect(formular.getByLabel('Anbieter *')).toBeFocused();
    await expect(formular.getByLabel('Bezeichnung')).toHaveValue(KFZ);
    await expect(formular.getByLabel('Betrag ab Vertragsbeginn in € *')).toHaveValue('586,80');
    await expect(formular.getByLabel('Zahlweise *')).toHaveValue('JAEHRLICH');
    await expect(formular.getByLabel('Vertragsbeginn *')).toHaveValue('2023-01-01');
    await expect(formular.getByLabel('Zahlungsweg')).toHaveValue('LASTSCHRIFT');
    await expect(formular.getByLabel('Verlängerung')).toHaveValue('ZWOELF_MONATE');
    await expect(formular.getByLabel('Kündigungsfrist')).toHaveValue('1');
    await expect(
      sheet(page)
        .getByRole('tablist', { name: 'Bereiche des Vertrags bearbeiten' })
        .getByRole('tab'),
    ).toHaveText(['Allgemein', 'Kosten', 'Preisverlauf', 'Laufzeit']);
    await expect(sheet(page).getByRole('complementary')).toHaveCount(0);
    // Abbrechen und Sichern stehen nur in der Leiste.
    await expect(formular.getByRole('button', { name: 'Speichern' })).toBeHidden();

    const box = (await sheet(page).boundingBox())!;
    expect(box.width).toBe(800);
    expect(Math.round(box.x + box.width / 2)).toBe(640);
  });

  test('ohne Änderung bleiben alle Felder gleich, Meldung an der Zeile', async ({ page }) => {
    await bearbeiten(page);
    expect(await speichernUndAnfrageLesen(page)).toEqual({
      version: 0,
      anbieter: 'Musterversicherung AG',
      bezeichnung: KFZ,
      kategorieId: 'kategorie-2',
      vertragsnummer: 'KFZ-4711-23',
      preise: [{ gueltigAb: '2023-01-01', betrag: { wert: 586.8, waehrung: 'EUR' } }],
      zahlweise: 'JAEHRLICH',
      zahlungsweg: 'LASTSCHRIFT',
      kuendbar: true,
      beginn: '2023-01-01',
      laufzeitende: '2023-12-31',
      verlaengerung: 'ZWOELF_MONATE',
      kuendigungsfristMonate: 1,
      gekuendigtZum: null,
      notiz: null,
      anteilProzent: null,
      einmalkosten: [],
      preissteigerung: null,
      preisgarantieBis: null,
      erinnerungSonderkuendigung: true,
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
    await expect(details(page, KFZ).locator('.meldung').getByRole('status')).toHaveText(
      `„${KFZ}“ wurde gespeichert.`,
    );
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

  test('Vertragsbeginn und Zahlweise im Tab Kosten gehen mit, ohne Hinweis', async ({ page }) => {
    const formular = await bearbeiten(page);
    await tab(page, 'Kosten');
    await formular.getByLabel('Zahlweise *').selectOption('MONATLICH');
    await formular.getByLabel('Vertragsbeginn *').fill('2023-02-01');
    await expect(formular.getByText('Nächste Abbuchung')).toHaveCount(0);

    const anfrage = await speichernUndAnfrageLesen(page);
    expect(anfrage).toMatchObject({ zahlweise: 'MONATLICH', beginn: '2023-02-01' });
    expect(anfrage).not.toHaveProperty('abbuchungAb');
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

  test('die Vorschau schickt den gespeicherten Beginn und folgt einer Änderung', async ({
    page,
  }) => {
    const vorschau = page.waitForRequest((r) => r.url().endsWith('/vorschau'));
    const formular = await bearbeiten(page);
    await tab(page, 'Laufzeit');
    const gespeichert = BEISPIEL_VERTRAEGE.find((v) => v.bezeichnung === KFZ)!;
    expect((await vorschau).postDataJSON().beginn).toBe(gespeichert.beginn);
    const termin = formular.getByRole('status').filter({ hasText: 'Nächster Kündigungstermin:' });
    await expect(termin).toContainText('Kündbar bis');
    await formular.getByLabel('Gekündigt', { exact: true }).check();
    await formular.getByLabel('Gekündigt zum').fill('2027-06-30');
    await expect(termin).toContainText('Gekündigt zum 30.06.2027');
  });

  test('Feldfehler: Sheet bleibt offen und zeigt sie am Feld', async ({ page }) => {
    const formular = await bearbeiten(page);
    await tab(page, 'Kosten');
    await formular.getByLabel('Betrag ab Vertragsbeginn in € *').fill('19,999');
    await sheet(page).getByRole('button', { name: 'Sichern' }).click();
    await expect(formular.getByRole('alert')).toHaveText('Bitte prüfe die markierten Felder.');
    await expect(
      formular.getByLabel('Betrag ab Vertragsbeginn in € *'),
    ).toHaveAccessibleDescription(
      'Höchstens 2 Nachkommastellen. Spätere Preise trägst du unter „Preisverlauf“ ein.',
    );
    await expect(formular.getByLabel('Betrag ab Vertragsbeginn in € *')).toBeFocused();
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

  test('am Desktop so hoch wie der Inhalt, mindestens 600 px, lange Tabs scrollen', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 1000 });
    const formular = await bearbeiten(page, 'Software GmbH');
    const hoehe = async () => (await sheet(page).boundingBox())!.height;
    // Allgemein ist kurz: so hoch wie der Inhalt statt 92 % des Fensters, nicht unter der Mindesthöhe.
    const allgemein = await hoehe();
    expect(allgemein).toBeGreaterThanOrEqual(600);
    expect(allgemein).toBeLessThan(920);
    expect(
      await sheet(page)
        .locator('.inhalt')
        .evaluate((e) => e.scrollHeight > e.clientHeight),
    ).toBe(false);

    // Preisverlauf mit Erhöhung ist länger als das Fenster: höchstens 92vh, das Formular scrollt.
    await tab(page, 'Preisverlauf');
    await expect(formular.getByLabel('Erhöhung um *')).toBeVisible();
    await expect.poll(hoehe).toBe(920);
    const inhalt = sheet(page).locator('.inhalt');
    expect(await inhalt.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
    await inhalt.evaluate((e) => e.scrollTo(0, e.scrollHeight));
    await expect(sheet(page).getByRole('button', { name: 'Sichern' })).toBeInViewport();
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
    await tabsEinzeilig(sheet(page).getByRole('tablist'));

    await sheet(page).getByLabel('Notiz').fill('Vom Handy');
    const anfrage = await speichernUndAnfrageLesen(page);
    expect(anfrage.notiz).toBe('Vom Handy');
    await expect(details(page, KFZ).locator('.meldung').getByRole('status')).toContainText(
      'wurde gespeichert',
    );
  });
});

test.describe('Vertrag mit automatischen Preisen bearbeiten', () => {
  const jahr = new Date().getFullYear();
  const heute = new Date().toISOString().slice(0, 10);
  const EUR = (wert: number) => ({ wert, waehrung: 'EUR' });
  const stufe = (j: number, wert: number) => ({
    gueltigAb: `${j}-01-01`,
    betrag: EUR(wert),
    art: 'FRUEHER' as const,
    automatisch: true,
  });
  const vorlage = BEISPIEL_VERTRAEGE[0];
  const AUTOMATISCH: VertragAntwort = {
    ...vorlage,
    id: 'auto',
    anbieter: 'Automatisch AG',
    bezeichnung: null,
    beginn: `${jahr - 5}-01-01`,
    zahlweise: 'MONATLICH',
    betrag: EUR(110.4),
    preise: [
      { gueltigAb: `${jahr - 5}-01-01`, betrag: EUR(100), art: 'FRUEHER', automatisch: false },
      stufe(jahr - 4, 102),
      stufe(jahr - 3, 104.04),
      stufe(jahr - 2, 106.12),
      stufe(jahr - 1, 108.24),
      { ...stufe(jahr, 110.4), art: 'AKTUELL' },
    ],
    preissteigerung: {
      art: 'PROZENT',
      prozent: 2,
      betrag: null,
      rhythmus: 'JAEHRLICH',
      naechsteAm: `${jahr - 4}-01-01`,
    },
    preissteigerungBetrachtetBis: heute,
  };

  test.beforeEach(async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: [AUTOMATISCH] });
    await page.goto('/vertraege');
  });

  test('Beginn geändert: Hinweis am Termin, „Vorschlag übernehmen“ setzt ihn', async ({ page }) => {
    const formular = await bearbeiten(page, 'Automatisch AG');
    await tab(page, 'Kosten');
    await formular.getByLabel('Vertragsbeginn *').fill(`${jahr - 5}-02-01`);
    await tab(page, 'Preisverlauf');
    const termin = formular.getByLabel('Erste Erhöhung am *');
    await expect(termin).toHaveValue(`${jahr - 4}-01-01`);
    await expect(
      formular.getByText(
        'Der Vertragsbeginn hat sich geändert. Prüfe, ob die erste Erhöhung noch stimmt.',
      ),
    ).toBeVisible();
    await formular
      .getByRole('button', { name: `Vorschlag übernehmen (01.02.${jahr - 4})` })
      .click();
    await expect(termin).toHaveValue(`${jahr - 4}-02-01`);
    await expect(formular.locator('.termin-hinweis')).toHaveCount(0);
    await expect(
      formular.getByText(
        'Gilt für künftige Erhöhungen. Bereits angelegte Preise bleiben unverändert.',
      ),
    ).toBeVisible();
  });

  test('geänderter automatischer Preis: Kennzeichen weg, Hinweis, gespeichert als eingetragener', async ({
    page,
  }) => {
    const formular = await bearbeiten(page, 'Automatisch AG');
    await tab(page, 'Preisverlauf');
    const gruppe = formular.getByRole('button', {
      name: `5 automatische Preise, ${jahr - 4}–${jahr}`,
    });
    await gruppe.click();
    await expect(formular.locator('.preis .etikett', { hasText: 'automatisch' })).toHaveCount(5);
    const zweite = formular.locator('.preis:not(.erster)').nth(1);
    await zweite.getByLabel('Betrag in € *').fill('105,00');
    await expect(formular.locator('.preis .etikett', { hasText: 'automatisch' })).toHaveCount(4);
    await expect(
      zweite.getByText('Spätere automatische Preise bleiben unverändert.'),
    ).toBeVisible();

    const anfrage = await speichernUndAnfrageLesen(page);
    expect(anfrage.preise[2]).toEqual({
      gueltigAb: `${jahr - 3}-01-01`,
      betrag: EUR(105),
      automatisch: true,
    });

    // Gespeichert: Die geänderte Stufe ist eingetragen, der Rest zu kurz für eine Gruppe.
    const wieder = await bearbeiten(page, 'Automatisch AG');
    await tab(page, 'Preisverlauf');
    await expect(wieder.getByRole('button', { name: /automatische Preise/ })).toHaveCount(0);
    await expect(wieder.locator('.preis .etikett', { hasText: 'automatisch' })).toHaveCount(4);
  });
});
