import { expect, test } from '@playwright/test';
import { backendSimulieren } from './backend-mock';

test.beforeEach(async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true });
});

test('Wurzel leitet auf die Startseite um', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/start$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Willkommen, Max!');
});

test('Startseite hat am Desktop keine Navigation, auf dem Handy die Tab-Leiste', async ({
  page,
}) => {
  await page.goto('/start');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Hauptmenü' })).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  const hauptmenue = page.getByRole('navigation', { name: 'Hauptmenü' });
  await expect(hauptmenue).toBeVisible();
  await expect(hauptmenue.getByRole('link', { name: 'Übersicht' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('Navigation führt zur Übersicht und markiert den aktiven Bereich', async ({ page }) => {
  await page.goto('/vertraege');
  await expect(page).toHaveTitle('Verträge – Haushaltsbuch');
  const hauptmenue = page.getByRole('navigation', { name: 'Hauptmenü' });
  await expect(hauptmenue.getByRole('link', { name: 'Verträge' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await hauptmenue.getByRole('link', { name: 'Übersicht' }).click();

  await expect(page).toHaveURL(/\/start$/);
  await expect(page.getByRole('navigation', { name: 'Hauptmenü' })).toBeHidden();
});

test('auf dem Desktop: Seitenleiste mit Logo statt Kopfzeile, Copyright in der Fußzeile', async ({
  page,
}) => {
  await page.goto('/vertraege');
  const hauptmenue = page.getByRole('navigation', { name: 'Hauptmenü' });
  await expect(hauptmenue.getByText('Haushaltsbuch')).toBeVisible();
  await expect(page.getByRole('banner').getByText('Haushaltsbuch')).toBeHidden();
  await expect(page.getByRole('contentinfo').getByText('© Björn Bochmann')).toBeVisible();
  await expect(hauptmenue.getByText('Finanzübersicht')).toBeVisible();
  await expect(hauptmenue.getByText('Demnächst verfügbar').first()).toBeVisible();

  expect(await page.locator('app-hauptmenue').boundingBox()).toMatchObject({ x: 0, width: 232 });
  const leiste = (await hauptmenue.boundingBox())!;
  expect(leiste.y).toBe(0);
  expect(Math.round(leiste.height)).toBe(720);
  const eintrag = (await hauptmenue.getByRole('link', { name: 'Verträge' }).boundingBox())!;
  expect(eintrag.height).toBe(34);

  // Bleibt beim Scrollen stehen.
  await page.mouse.wheel(0, 2000);
  await expect.poll(async () => (await hauptmenue.boundingBox())!.y).toBe(0);
});

test('die Startseite behält am Desktop die Kopfzeile', async ({ page }) => {
  await page.goto('/start');
  await expect(page.getByRole('banner').getByText('Haushaltsbuch')).toBeVisible();
});

test('auf dem Handy wird die Navigation zur Leiste mit Kurzbezeichnungen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/vertraege');
  const hauptmenue = page.getByRole('navigation', { name: 'Hauptmenü' });

  await expect(hauptmenue.getByText('Finanzen')).toBeVisible();
  await expect(hauptmenue.getByText('Finanzübersicht')).toBeHidden();
  await expect(hauptmenue.getByText('Komponenten')).toBeHidden();
  await expect(hauptmenue.getByText('© Björn Bochmann')).toBeHidden();
  // Ohne Fußzeile; Impressum und Datenschutz über die Einstellungen.
  await expect(page.getByRole('contentinfo')).toBeHidden();
  // Nur für Screenreader: Der Text bleibt im Zugriffsbaum, sichtbar ist nur der graue Eintrag.
  await expect(hauptmenue).toContainText('Demnächst verfügbar');

  const box = await hauptmenue.boundingBox();
  expect(box!.y + box!.height).toBe(844);
  const breite = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(breite).toBe(390);
});

test('Fußzeile der Shell ohne Systemstatus, als flache Zeile', async ({ page }) => {
  for (const pfad of ['/start', '/vertraege']) {
    await page.goto(pfad);
    const fusszeile = page.getByRole('contentinfo');
    await expect(fusszeile, pfad).toContainText('© Björn Bochmann');
    await expect(fusszeile, pfad).toContainText('Impressum');
    await expect(page.getByRole('status', { name: 'Systemstatus' }), pfad).toHaveCount(0);
    // Copyright, Links und Version in einer Zeile.
    const hoehen = await Promise.all(
      [
        fusszeile.getByText('© Björn Bochmann'),
        fusszeile.getByRole('link', { name: 'Impressum' }),
      ].map(async (l) => (await l.boundingBox())!.y),
    );
    expect(Math.abs(hoehen[0] - hoehen[1]), pfad).toBeLessThan(4);
  }
});

test('alle Seiten haben dieselben Ränder wie die Übersicht', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  for (const pfad of ['/start', '/vertraege', '/vertraege/neu']) {
    await page.goto(pfad);
    const box = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(box.x, pfad).toBe(384);
    const inhalt = await page.locator('main').evaluate((main) => {
      const { right } = main.getBoundingClientRect();
      return right - parseFloat(getComputedStyle(main).paddingRight);
    });
    expect(inhalt, pfad).toBe(1536);
  }
});

test('auf schmaleren Fenstern bleibt der rechte Rand gleich, die Navigation begrenzt links', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const raender = async (pfad: string) => {
    await page.goto(pfad);
    await page.getByRole('heading', { level: 1 }).waitFor();
    return page.locator('main').evaluate((main) => {
      const { left, right } = main.getBoundingClientRect();
      const stil = getComputedStyle(main);
      return [left + parseFloat(stil.paddingLeft), right - parseFloat(stil.paddingRight)];
    });
  };
  expect(await raender('/start')).toEqual([64, 1216]);
  expect(await raender('/vertraege')).toEqual([256, 1216]);
  expect(await raender('/vertraege/neu')).toEqual([256, 1216]);
});
