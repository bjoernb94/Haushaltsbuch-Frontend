import { expect, test } from '@playwright/test';
import { backendSimulieren, BEISPIEL_VERTRAEGE } from './backend-mock';

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
      'Kein Kündigungstermin bestimmbar',
      'Gekündigt zum 31.12.2026',
      'Beendet',
    ]) {
      await expect(page.getByText(badge, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('Keine weiteren Abbuchungen')).toBeVisible();
  });

  test('„Zur Übersicht“ führt zur Startseite', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege');
    await page.getByRole('link', { name: 'Zur Übersicht' }).click();
    await expect(page).toHaveURL(/\/start$/);
  });

  test('Details lassen sich aufklappen, höchstens eine ist offen', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');

    const kfz = page.getByRole('button', { name: 'Details zu Kfz-Versicherung anzeigen' });
    await kfz.click();
    const region = page.getByRole('region', { name: 'Details zu Kfz-Versicherung' });
    await expect(region).toContainText('Lastschrift');
    await expect(
      page.getByRole('button', { name: 'Details zu Kfz-Versicherung ausblenden' }),
    ).toHaveAttribute('aria-expanded', 'true');

    await page.getByRole('button', { name: 'Details zu Rundfunkbeitrag anzeigen' }).click();
    await expect(region).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Details zu Rundfunkbeitrag' })).toBeVisible();
  });

  test('kürzt lange Angaben in der Zeile, die Details zeigen alles', async ({ page }) => {
    const lang = 'Sehr langer Text '.repeat(30).trim();
    await backendSimulieren(page, {
      angemeldet: true,
      vertraege: [{ ...BEISPIEL_VERTRAEGE[0], bezeichnung: lang, anbieter: lang, notiz: lang }],
    });
    await page.goto('/vertraege');

    const zeile = page.locator('app-vertrag-zeile');
    for (const [klasse, zeilen] of [
      ['.name', 2],
      ['.meta', 1],
      ['.notiz', 1],
    ] as const) {
      const feld = zeile.locator(klasse);
      await expect(feld).toContainText(lang);
      const { sichtbar, gesamt, zeilenhoehe } = await feld.evaluate((e) => ({
        sichtbar: e.clientHeight,
        gesamt: e.scrollHeight,
        zeilenhoehe: parseFloat(getComputedStyle(e).lineHeight),
      }));
      expect(gesamt).toBeGreaterThan(sichtbar);
      expect(sichtbar).toBeLessThanOrEqual(Math.ceil(zeilenhoehe * zeilen));
    }

    await zeile.getByRole('button').click();
    const details = zeile.getByRole('region');
    await expect(details.getByText(lang, { exact: true })).toHaveCount(3);
    const notiz = details.getByText(lang, { exact: true }).last();
    expect(await notiz.evaluate((e) => e.scrollHeight <= e.clientHeight)).toBe(true);
  });

  test('Notiz nimmt in den Details die volle Breite und behält Zeilenumbrüche', async ({
    page,
  }) => {
    await backendSimulieren(page, {
      angemeldet: true,
      vertraege: [{ ...BEISPIEL_VERTRAEGE[0], notiz: 'Erste Zeile\nZweite Zeile' }],
    });
    await page.goto('/vertraege');
    const zeile = page.locator('app-vertrag-zeile');
    await zeile.getByRole('button').click();

    const raster = zeile.locator('dl');
    const notiz = zeile.locator('.notiz-eintrag');
    await expect(notiz.locator('dd')).toBeVisible();
    expect((await notiz.boundingBox())!.width).toBe((await raster.boundingBox())!.width);
    expect(await notiz.locator('dd').innerText()).toBe('Erste Zeile\nZweite Zeile');
  });

  test('zeigt den Leerzustand', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege');
    await expect(page.getByText('Noch keine Verträge')).toBeVisible();
    await expect(page.getByText('Laufende Verträge0')).toBeVisible();
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

  test('passt auf dem Handy in die Breite', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');

    await expect(page.locator('app-vertrag-zeile')).toHaveCount(BEISPIEL_VERTRAEGE.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
});
