import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, BEISPIEL_VERTRAEGE, nutzerKnopf } from './backend-mock';

const kopf = (page: Page) => page.getByRole('banner');
const hauptmenue = (page: Page) => page.getByRole('navigation', { name: 'Hauptmenü' });

test.describe('bis 900 px', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('Kopf durchscheinend ohne Logo, bleibt beim Scrollen oben', async ({ page }) => {
    const viele = Array.from({ length: 30 }, (_, i) => ({
      ...BEISPIEL_VERTRAEGE[0],
      id: `v-${i}`,
      anbieter: `Anbieter ${i}`,
    }));
    await backendSimulieren(page, { angemeldet: true, vertraege: viele });
    await page.goto('/vertraege');
    await expect(kopf(page)).toBeVisible();
    await expect(kopf(page).getByText('Haushaltsbuch')).toBeHidden();

    const stil = await kopf(page).evaluate((el) => {
      const ebene = getComputedStyle(el, '::before');
      return {
        grund: getComputedStyle(el).backgroundColor,
        // Firefox kennt nur die Eigenschaft ohne Präfix.
        unschaerfe: ebene.backdropFilter || ebene.getPropertyValue('-webkit-backdrop-filter'),
      };
    });
    expect(stil.grund).toBe('rgba(0, 0, 0, 0)');
    expect(stil.unschaerfe).toContain('blur(20px)');

    await page.mouse.wheel(0, 1500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    await expect.poll(async () => (await kopf(page).boundingBox())!.y).toBe(0);
  });

  test('ohne Fußzeile, mit Tab-Leiste auch auf der Startseite', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    for (const pfad of ['/start', '/vertraege', '/einstellungen']) {
      await page.goto(pfad);
      await expect(hauptmenue(page), pfad).toBeVisible();
      await expect(page.getByRole('contentinfo'), pfad).toBeHidden();
    }
  });

  test('Verträge: „+“ im Kopf statt „Neuer Vertrag“ im Inhalt, kein „Zur Übersicht“', async ({
    page,
  }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege');
    await expect(page.getByRole('link', { name: 'Zur Übersicht' })).toBeHidden();
    await expect(page.getByRole('main').getByRole('link', { name: 'Neuer Vertrag' })).toBeHidden();

    const plus = kopf(page).getByRole('link', { name: 'Neuer Vertrag' });
    const box = (await plus.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    // Links neben dem Nutzer-Button.
    expect(box.x).toBeLessThan((await nutzerKnopf(page).boundingBox())!.x);

    await plus.click();
    await expect(page).toHaveURL(/\/vertraege\/neu$/);
  });

  test('Neuer Vertrag: eigene Leiste statt Kopf und Tab-Leiste', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege');
    await kopf(page).getByRole('link', { name: 'Neuer Vertrag' }).click();
    await expect(page.getByLabel('Anbieter *')).toBeVisible();

    await expect(kopf(page)).toBeHidden();
    await expect(hauptmenue(page)).toBeHidden();
    await expect(page.getByRole('link', { name: 'Zurück zu Verträgen' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Vertrag speichern' })).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Neuer Vertrag');
    const leiste = page.locator('.leiste');
    expect((await leiste.boundingBox())!).toMatchObject({ x: 0, y: 0, width: 390 });

    // Bleibt oben, auch am Ende des Formulars.
    await page.getByLabel('Notiz').scrollIntoViewIfNeeded();
    await expect.poll(async () => (await leiste.boundingBox())!.y).toBe(0);

    await leiste.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page).toHaveURL(/\/vertraege$/);
    await expect(kopf(page)).toBeVisible();
  });

  test('Neuer Vertrag: „Sichern“ prüft die Felder wie „Vertrag speichern“', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege/neu');
    await page.getByRole('button', { name: 'Sichern' }).click();
    await expect(page).toHaveURL(/\/vertraege\/neu$/);
    await expect(page.getByLabel('Anbieter *')).toHaveAttribute('aria-invalid', 'true');
  });

  test('Einstellungen: „Zurück“ im Kopf führt zur Herkunft', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege');
    await nutzerKnopf(page).click();
    await page.getByRole('dialog', { name: 'Dein Konto' }).getByRole('link').click();
    await expect(page).toHaveURL(/\/einstellungen$/);

    await expect(page.getByRole('main').getByRole('link', { name: /Zurück/ })).toBeHidden();
    const zurueck = kopf(page).getByRole('link', { name: 'Zurück zu Verträge' });
    await expect(zurueck).toHaveText('Zurück');
    await zurueck.click();
    await expect(page).toHaveURL(/\/vertraege$/);
  });

  test('Impressum: „Zurück“ im Kopf, die Fußzeile bleibt', async ({ page }) => {
    await backendSimulieren(page);
    await page.goto('/impressum');
    await expect(nutzerKnopf(page)).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: /Zurück/ })).toBeHidden();

    await kopf(page).getByRole('link', { name: 'Zurück zu Login' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('offenes Kontomenü liegt über der Tab-Leiste', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege');
    await nutzerKnopf(page).click();

    const panel = page.getByRole('dialog', { name: 'Dein Konto' });
    await expect(panel).toBeVisible();
    const oben = await page.evaluate(() => {
      const el = document.elementFromPoint(195, 830);
      return el?.closest('[role="dialog"]') ? 'panel' : el?.closest('nav') ? 'tab-leiste' : '?';
    });
    expect(oben).toBe('panel');
  });
});

test('zwischen 641 und 900 px: Klick auf die Tab-Leiste schließt nur das Kontomenü', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/vertraege');
  await nutzerKnopf(page).click();
  await expect(page.getByRole('dialog', { name: 'Dein Konto' })).toBeVisible();

  const eintrag = (await hauptmenue(page).getByRole('link', { name: 'Übersicht' }).boundingBox())!;
  await page.mouse.click(eintrag.x + eintrag.width / 2, eintrag.y + eintrag.height / 2);

  await expect(page.getByRole('dialog', { name: 'Dein Konto' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/vertraege$/);
});

test('ab 901 px keine Aktionen im Kopf, „Zurück“ steht im Inhalt', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/einstellungen');
  await expect(page.getByRole('main').getByRole('link', { name: /Zurück/ })).toBeVisible();
  await expect(kopf(page).getByRole('link')).toBeHidden();

  await page.goto('/vertraege');
  await expect(page.getByRole('main').getByRole('link', { name: 'Neuer Vertrag' })).toBeVisible();
  await expect(kopf(page).getByRole('link', { name: 'Neuer Vertrag' })).toBeHidden();
});
