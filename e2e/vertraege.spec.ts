import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, BEISPIEL_VERTRAEGE, tabsEinzeilig } from './backend-mock';

const KFZ = 'Kfz-Versicherung';
const LETZTE = 'Mobilfunk GmbH';

const zeile = (page: Page, name: string) =>
  page.locator('app-vertrag-zeile').filter({ hasText: name });
const oeffnen = (page: Page, name: string) =>
  page.getByRole('button', { name: `Details zu ${name} anzeigen` });
const details = (page: Page, name: string) => page.getByRole('complementary', { name });
const menue = (page: Page, name: string) =>
  page.getByRole('menu', { name: `Aktionen für ${name}` });

test.describe('Seite Verträge', () => {
  const liste = '/api/vertraege';

  test('zeigt Kennzahlen, Liste und jede Kündigungsart', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Verträge');
    await expect(page.getByText('Laufende Verträge6')).toBeVisible();
    const zeilen = page.getByRole('region', { name: 'Vertragsliste' }).locator('app-vertrag-zeile');
    await expect(zeilen).toHaveCount(BEISPIEL_VERTRAEGE.length);
    for (const badge of [
      'Kündbar bis 30.11.2026',
      'Monatlich kündbar',
      'Nicht kündbar',
      'Endet am 30.06.2027',
      'Kein Termin bekannt',
      'Gekündigt zum 31.12.2026',
      'Beendet',
      'Storniert',
    ]) {
      await expect(page.getByText(badge, { exact: true })).toBeVisible();
    }
    for (const laufzeit of [
      'Seit 01.01.2023',
      '15.01.2024 – 30.06.2026',
      'Beginnt am 01.01.2027',
      'Storniert, Beginn wäre 01.12.2026',
    ]) {
      await expect(page.getByText(laufzeit, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('Nächste Abbuchung')).toHaveCount(0);
    await expect(page.locator('.kennzahl').filter({ hasText: 'Kosten pro Monat' })).toContainText(
      'Ohne Verträge, die erst später beginnen',
    );
    await expect(
      page.getByText(
        'Umgerechnete Werte und Summen sind gerundet und können um wenige Cent abweichen.',
        {
          exact: false,
        },
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Zur Übersicht' })).toHaveCount(0);
  });

  test('zeigt die nächste Preisänderung in Zeile und Details, alle Preise im Tab Preisverlauf', async ({
    page,
  }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');
    const fitness = page.locator('app-vertrag-zeile').filter({ hasText: 'Fitnessstudio am Park' });
    await expect(fitness.getByText('Preis ↑ ab 01.03.2027')).toBeVisible();
    await expect(page.getByText('Kosten 2026', { exact: true })).toBeVisible();
    await expect(page.getByText('Alle Abbuchungen im Kalenderjahr')).toBeVisible();

    await page.goto('/vertraege/fitness?tab=preise');
    const panel = page.getByRole('complementary', { name: 'Fitnessstudio am Park' });
    await expect(panel.locator('.kachel').filter({ hasText: 'Nächste Preisänderung' })).toHaveText(
      /ab 01\.03\.2027\s*39,90\s€ · angekündigt/,
    );
    await expect(panel.getByRole('tabpanel').getByRole('listitem')).toHaveText([
      'ab Vertragsbeginn: 29,90 €',
      'ab 01.01.2026: 34,90 € · aktuell',
      'ab 01.03.2027: 39,90 € · angekündigt',
    ]);
  });

  test('geteilter Vertrag: Chip, „nur dein Anteil“ an den Kennzahlen, Anteil in den Details', async ({
    page,
  }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');
    const app = page.locator('app-vertrag-zeile').filter({ hasText: 'Software GmbH' });
    await expect(app.getByText('Anteil 50 %')).toBeVisible();
    await expect(page.getByText('Bei geteilten Verträgen nur dein Anteil')).toHaveCount(3);
    await expect(page.locator('.kennzahl').filter({ hasText: 'Einmalkosten 2026' })).toHaveText(
      /Einmalkosten 2026\s*15,00\s€\s*Bei geteilten Verträgen nur dein Anteil/,
    );

    await page.goto('/vertraege/app?tab=kosten');
    const panel = page.getByRole('complementary', { name: 'Software GmbH' });
    await expect(panel.locator('.kachel').first()).toHaveText(
      /Pro Monat\s*5,00\s€\s*Dein Anteil 2,50\s€ \(50 %\)/,
    );
    await expect(panel.getByRole('tabpanel')).toContainText(
      /Dein Anteil\s*50 % = 2,50\s€ pro Monat/,
    );
    // Sortiert vom Backend, „Gesamt“ mit vollem Betrag.
    const einmalkosten = panel.locator('app-vertrag-einmalkosten');
    await expect(einmalkosten.getByRole('heading')).toHaveText('Einmalkosten');
    await expect(einmalkosten.getByRole('listitem')).toHaveText([
      /Lizenzschlüssel · fällig am 15\.12\.2025\s*20,00\s€/,
      /Einrichtung · fällig am 01\.02\.2026\s*30,00\s€/,
    ]);
    await expect(einmalkosten.getByText('Gesamt 50,00 €')).toBeVisible();

    await page.goto('/vertraege/kfz?tab=kosten');
    await expect(page.getByText('Keine Einmalkosten hinterlegt.')).toBeVisible();
  });

  test('Preissteigerung: Chip mit Prognose, Diagramm und Regel im Tab Preisverlauf', async ({
    page,
  }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');
    const app = page.locator('app-vertrag-zeile').filter({ hasText: 'Software GmbH' });
    await expect(app.getByText('Preis ↑ ab 01.01.2027 (Prognose)')).toBeVisible();

    await page.goto('/vertraege/app?tab=preise');
    const panel = page.getByRole('complementary', { name: 'Software GmbH' });
    const diagramm = panel.getByRole('img', { name: /^Preisverlauf:/ });
    await expect(diagramm).toBeVisible();
    await expect(diagramm).toHaveAttribute('aria-label', /ab 01\.01\.2027 6,00\s€ \(Prognose\)/);
    await expect(panel.locator('figcaption')).toHaveText(/Gezahlt\s*Angekündigt oder Prognose/);
    await expect(panel.getByRole('tabpanel')).toContainText(/Preisgarantie bis\s*Keine/);
    await expect(panel.getByRole('tabpanel')).toContainText(
      /Regelmäßige Erhöhung\s*Jährlich um 1,00\s€/,
    );
    await expect(panel.getByRole('tabpanel')).toContainText(
      /Erinnerung Sonderkündigungsrecht\s*An/,
    );
  });

  test('kürzt lange Angaben in der Zeile, die Details zeigen alles', async ({ page }) => {
    const lang = 'Sehr langer Text '.repeat(30).trim();
    await backendSimulieren(page, {
      angemeldet: true,
      vertraege: [{ ...BEISPIEL_VERTRAEGE[0], bezeichnung: lang, anbieter: lang, notiz: lang }],
    });
    await page.goto('/vertraege');

    const eintrag = page.locator('app-vertrag-zeile');
    for (const [klasse, zeilen] of [
      ['.name', 2],
      ['.meta', 1],
      ['.notiz', 1],
    ] as const) {
      const feld = eintrag.locator(klasse);
      await expect(feld).toContainText(lang);
      const { sichtbar, gesamt, zeilenhoehe } = await feld.evaluate((e) => ({
        sichtbar: e.clientHeight,
        gesamt: e.scrollHeight,
        zeilenhoehe: parseFloat(getComputedStyle(e).lineHeight),
      }));
      expect(gesamt).toBeGreaterThan(sichtbar);
      expect(sichtbar).toBeLessThanOrEqual(Math.ceil(zeilenhoehe * zeilen));
    }

    await oeffnen(page, lang).click();
    const werte = details(page, lang).locator('dd');
    await expect(werte.getByText(lang, { exact: true })).toHaveCount(3);
    const notiz = werte.getByText(lang, { exact: true }).last();
    expect(await notiz.evaluate((e) => e.scrollHeight <= e.clientHeight)).toBe(true);
  });

  test('Notiz nimmt in den Details die volle Breite und behält Zeilenumbrüche', async ({
    page,
  }) => {
    await backendSimulieren(page, {
      angemeldet: true,
      vertraege: [{ ...BEISPIEL_VERTRAEGE[0], notiz: 'Erste Zeile\nZweite Zeile' }],
    });
    await page.goto('/vertraege/kfz');

    const raster = details(page, KFZ).locator('dl');
    const notiz = raster.locator('.breit');
    await expect(notiz.locator('dd')).toBeVisible();
    expect((await notiz.boundingBox())!.width).toBe((await raster.boundingBox())!.width);
    expect(await notiz.locator('dd').innerText()).toBe('Erste Zeile\nZweite Zeile');
  });

  test('zeigt den Leerzustand, der Link führt zum ersten Vertrag', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege');
    await expect(page.getByText('Noch keine Verträge')).toBeVisible();
    await expect(page.getByText('Laufende Verträge0')).toBeVisible();
    await page.getByRole('link', { name: 'Ersten Vertrag anlegen' }).click();
    await expect(page).toHaveURL(/\/vertraege\/neu$/);
  });

  test('zeigt den Ladezustand, solange das Backend nicht antwortet', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    let antworten: () => void = () => undefined;
    const antwort = new Promise<void>((erledigt) => (antworten = erledigt));
    await page.route(liste, async (route) => {
      await antwort;
      await route.fallback();
    });
    await page.goto('/vertraege');

    await expect(page.getByRole('status').filter({ hasText: 'Wird geladen' })).toBeVisible();
    antworten();
    await expect(page.getByText('Noch keine Verträge')).toBeVisible();
  });

  test('bietet nach einem Fehler einen neuen Versuch an', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    let scheitert = true;
    await page.route(liste, (route) =>
      scheitert ? route.fulfill({ status: 500 }) : route.fallback(),
    );
    await page.goto('/vertraege');

    await expect(page.getByRole('alert')).toHaveText('Die Verträge konnten nicht geladen werden.');

    scheitert = false;
    await page.getByRole('button', { name: 'Erneut versuchen' }).click();

    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('app-vertrag-zeile')).toHaveCount(BEISPIEL_VERTRAEGE.length);
  });

  test('die Werkzeugleiste bleibt am Desktop beim Scrollen oben', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');
    const neu = page.getByRole('main').getByRole('link', { name: 'Neuer Vertrag' });
    await expect(neu).toHaveAttribute('aria-keyshortcuts', 'n');
    await expect(neu).toHaveAttribute('title', 'Neuer Vertrag (N)');
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    await expect(neu).toBeInViewport();
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
  });

  test('passt auf dem Handy in die Breite', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');

    await expect(page.locator('app-vertrag-zeile')).toHaveCount(BEISPIEL_VERTRAEGE.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });

  test.describe('Details', () => {
    test('auf dem Handy (390 px) stehen alle Tabs in einer Zeile', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
      await page.goto('/vertraege/kfz?tab=preise');
      const tabs = page.getByRole('tablist', { name: 'Bereiche der Details' });
      await expect(tabs.getByRole('tab')).toHaveText([
        'Allgemein',
        'Kosten',
        'Laufzeit',
        'Preisverlauf',
      ]);
      await tabsEinzeilig(tabs);
    });

    test.beforeEach(async ({ page }) => {
      await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
      await page.goto('/vertraege');
    });

    test('ein Klick auf die Zeile öffnet das Panel daneben, mit Tabs in der URL', async ({
      page,
    }) => {
      await oeffnen(page, KFZ).click();
      await expect(page).toHaveURL(/\/vertraege\/kfz$/);
      const panel = details(page, KFZ);
      await expect(panel).toBeVisible();
      await expect(panel).toBeFocused();
      await expect(panel).toContainText('Pro Monat48,90 €');
      await expect(panel.getByRole('tab', { name: 'Allgemein' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(panel.getByRole('tabpanel')).toContainText('Musterversicherung AG');

      const leiste = (await page.getByRole('region', { name: 'Vertragsliste' }).boundingBox())!;
      const box = (await panel.boundingBox())!;
      expect(box.x).toBeGreaterThan(leiste.x + leiste.width);

      await panel.getByRole('tab', { name: 'Kosten' }).click();
      await expect(page).toHaveURL(/\/vertraege\/kfz\?tab=kosten$/);
      await expect(panel.getByRole('tabpanel')).toContainText('Lastschrift');
      await panel.getByRole('tab', { name: 'Kosten' }).press('ArrowRight');
      await expect(panel.getByRole('tab', { name: 'Laufzeit' })).toBeFocused();
      await expect(page).toHaveURL(/\?tab=laufzeit$/);
      await expect(panel.getByRole('tabpanel')).toContainText('Kündigungsfrist');

      // Ein geteilter Link zeigt dasselbe.
      await page.reload();
      await expect(details(page, KFZ).getByRole('tabpanel')).toContainText('Kündigungsfrist');
    });

    test('die Zurück-Taste schließt; der Wechsel zu einem anderen Vertrag kostet keinen Schritt', async ({
      page,
    }) => {
      await oeffnen(page, KFZ).click();
      await details(page, KFZ).getByRole('tab', { name: 'Kosten' }).click();
      await oeffnen(page, 'Rundfunkbeitrag').click();
      await expect(page).toHaveURL(/\/vertraege\/rundfunk$/);
      await expect(details(page, 'Rundfunkbeitrag')).toBeVisible();

      await page.goBack();
      await expect(page).toHaveURL(/\/vertraege$/);
      await expect(page.getByRole('complementary')).toHaveCount(0);
    });

    test('Schließen per Knopf, Esc und zweitem Klick; der Fokus kehrt zur Zeile zurück', async ({
      page,
    }) => {
      await oeffnen(page, KFZ).click();
      await details(page, KFZ).getByRole('button', { name: 'Details schließen' }).click();
      await expect(page).toHaveURL(/\/vertraege$/);
      await expect(oeffnen(page, KFZ)).toBeFocused();

      await oeffnen(page, KFZ).click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('complementary')).toHaveCount(0);

      await oeffnen(page, KFZ).click();
      await page.getByRole('button', { name: `Details zu ${KFZ} schließen` }).click();
      await expect(page.getByRole('complementary')).toHaveCount(0);

      // Geschlossen geht es mit der Zurück-Taste nicht wieder hinein.
      await page.goBack();
      await expect(page).not.toHaveURL(/\/vertraege\/kfz/);
    });

    test('ein geteilter Link holt die Zeile ins Bild, Schließen bleibt in der App', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 600 });
      await page.goto('/vertraege/alt');
      await expect(details(page, LETZTE)).toBeVisible();
      await expect(zeile(page, LETZTE)).toBeInViewport({ ratio: 1 });
      await details(page, LETZTE).getByRole('button', { name: 'Details schließen' }).click();
      await expect(page).toHaveURL(/\/vertraege$/);
    });

    test('ein Link auf einen unbekannten Vertrag zeigt einen Hinweis', async ({ page }) => {
      await page.goto('/vertraege/gibt-es-nicht');
      await expect(page).toHaveURL(/\/vertraege$/);
      await expect(page.getByRole('alert')).toHaveText('Diesen Vertrag gibt es nicht mehr.');
    });

    test('das Panel bleibt beim Scrollen der Liste stehen', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 600 });
      await oeffnen(page, KFZ).click();
      // Holt die Seite die Zeile gerade weich ins Bild, geht das Rad darin unter: erneut drehen.
      await expect
        .poll(async () => {
          await page.mouse.wheel(0, 1500);
          return page.evaluate(() => window.scrollY);
        })
        .toBeGreaterThan(300);
      await expect(details(page, KFZ).getByRole('heading', { name: KFZ })).toBeInViewport();
    });
  });

  test.describe('Kontextmenü', () => {
    test.beforeEach(async ({ page }) => {
      await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
      await page.goto('/vertraege');
    });

    test('„…“ öffnet es, Pfeiltasten wandern, Esc schließt', async ({ page }) => {
      const mehr = page.getByRole('button', { name: `Aktionen für ${KFZ}` });
      await mehr.click();
      await expect(mehr).toHaveAttribute('aria-expanded', 'true');
      const eintraege = menue(page, KFZ).getByRole('menuitem');
      await expect(eintraege).toHaveText(['Details anzeigen', 'Bearbeiten …', 'Löschen …']);
      await expect(eintraege.first()).toBeFocused();

      await page.keyboard.press('ArrowDown');
      await expect(eintraege.nth(1)).toBeFocused();
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowUp');
      await expect(eintraege.last()).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(menue(page, KFZ)).toHaveCount(0);
      await expect(mehr).toBeFocused();

      await mehr.click();
      await expect(eintraege.first()).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/vertraege\/kfz$/);
    });

    test('Rechtsklick auf die Zeile öffnet es, ein Klick daneben schließt', async ({ page }) => {
      await oeffnen(page, 'Rundfunkbeitrag').click({ button: 'right' });
      await expect(menue(page, 'Rundfunkbeitrag')).toBeVisible();
      await page.mouse.click(5, 5);
      await expect(menue(page, 'Rundfunkbeitrag')).toHaveCount(0);
      await expect(page).toHaveURL(/\/vertraege$/);
    });

    test('bis 900 px gibt es kein „…“, Tippen öffnet die Details als Vollbild', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole('button', { name: `Aktionen für ${KFZ}` })).toBeHidden();
      await oeffnen(page, KFZ).click();

      const panel = details(page, KFZ);
      expect(await panel.boundingBox()).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
      // Die Tab-Leiste bleibt darüber.
      await expect(page.getByRole('navigation', { name: 'Hauptmenü' })).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Details schließen' })).toBeHidden();
      await panel.getByRole('button', { name: 'Verträge' }).click();
      await expect(page).toHaveURL(/\/vertraege$/);
      await expect(page.getByRole('complementary')).toHaveCount(0);
    });
  });

  test.describe('Kürzel N', () => {
    test.beforeEach(async ({ page }) => {
      await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
      await page.goto('/vertraege');
      await expect(page.locator('app-vertrag-zeile').first()).toBeVisible();
    });

    test('öffnet „Neuer Vertrag“', async ({ page }) => {
      await page.keyboard.press('n');
      await expect(page).toHaveURL(/\/vertraege\/neu$/);
    });

    test('nicht, solange ein Dialog offen ist', async ({ page }) => {
      await page.getByRole('button', { name: `Aktionen für ${KFZ}` }).click();
      await expect(page.getByRole('menuitem').first()).toBeFocused();
      await page.keyboard.press('n');
      await expect(page).toHaveURL(/\/vertraege$/);
      await page.getByRole('menuitem', { name: 'Löschen …' }).click();
      await expect(page.getByRole('dialog', { name: `„${KFZ}“ löschen?` })).toBeVisible();
      await page.keyboard.press('n');
      await expect(page).toHaveURL(/\/vertraege$/);
    });

    test('nicht mit Alt', async ({ page }) => {
      await page.keyboard.press('Alt+n');
      await page.waitForTimeout(200);
      await expect(page).toHaveURL(/\/vertraege$/);
    });
  });
});
