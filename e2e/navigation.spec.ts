import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, nutzerKnopf } from './backend-mock';

test.beforeEach(async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true });
});

test('Wurzel leitet auf die Startseite um', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/start$/);
  await expect(page).toHaveTitle('Übersicht – Haushaltsbuch');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Übersicht');
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText('Willkommen, Max!');
});

test('die Startseite hat wie alle Seiten die Seitenleiste, auf dem Handy die Tab-Leiste', async ({
  page,
}) => {
  await page.goto('/start');
  const hauptmenue = page.getByRole('navigation', { name: 'Hauptmenü' });
  await expect(hauptmenue).toBeVisible();
  await expect(hauptmenue.getByRole('link', { name: 'Übersicht' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.setViewportSize({ width: 390, height: 844 });
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
  await expect(hauptmenue.getByRole('link', { name: 'Übersicht' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('auf dem Desktop: Seitenleiste mit Logo, Einstellungen und Copyright, Kopfzeile mit Titel', async ({
  page,
}) => {
  await page.goto('/vertraege');
  const hauptmenue = page.getByRole('navigation', { name: 'Hauptmenü' });
  const kopfzeile = page.getByRole('banner');
  await expect(hauptmenue.getByText('Haushaltsbuch')).toBeVisible();
  await expect(hauptmenue.getByText('© Björn Bochmann')).toBeVisible();
  await expect(kopfzeile.getByText('Haushaltsbuch')).toBeHidden();
  await expect(kopfzeile.getByRole('heading', { level: 1 })).toHaveText('Verträge');
  await expect(kopfzeile.getByRole('button', { name: 'Benachrichtigungen' })).toBeVisible();
  await expect(kopfzeile.getByRole('button', { name: 'Konto von Max Muster' })).toBeVisible();
  await expect(hauptmenue.getByText('Finanzübersicht')).toBeVisible();
  await expect(hauptmenue.getByText('Demnächst verfügbar').first()).toBeVisible();

  expect(await page.locator('app-hauptmenue').boundingBox()).toMatchObject({ x: 0, width: 232 });
  const leiste = (await hauptmenue.boundingBox())!;
  expect(leiste.y).toBe(0);
  expect(Math.round(leiste.height)).toBe(720);
  const eintrag = (await hauptmenue.getByRole('link', { name: 'Verträge' }).boundingBox())!;
  expect(eintrag.height).toBe(34);
  // Einstellungen unten in der Leiste, darunter das Copyright.
  const einstellungen = (await hauptmenue
    .getByRole('link', { name: 'Einstellungen' })
    .boundingBox())!;
  expect(einstellungen.y).toBeGreaterThan(600);

  await hauptmenue.getByRole('link', { name: 'Einstellungen' }).click();
  await expect(page).toHaveURL(/\/einstellungen$/);
  await expect(hauptmenue.getByRole('link', { name: 'Einstellungen' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // Leiste und Kopfzeile bleiben beim Scrollen stehen.
  await page.goto('/vertraege');
  await page.mouse.move(600, 400);
  await page.mouse.wheel(0, 2000);
  await expect.poll(async () => (await hauptmenue.boundingBox())!.y).toBe(0);
  await expect.poll(async () => (await kopfzeile.boundingBox())!.y).toBe(0);
  expect((await kopfzeile.boundingBox())!.height).toBe(60);
});

test('ausgeschaltete Bereiche stehen gedimmt im Hauptmenü, ohne Link', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true, komponenten: ['VERTRAGSUEBERSICHT'] });
  await page.goto('/start');
  const hauptmenue = page.getByRole('navigation', { name: 'Hauptmenü' });
  await expect(hauptmenue.getByText('Ausgeschaltet')).toHaveCount(3);
  await expect(hauptmenue.getByRole('link')).toHaveText(['Übersicht', 'Verträge', 'Einstellungen']);
});

test(
  'auf dem Handy wird die Navigation zur Leiste mit Kurzbezeichnungen',
  { tag: '@mobil' },
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/vertraege');
    const hauptmenue = page.getByRole('navigation', { name: 'Hauptmenü' });

    await expect(hauptmenue.getByText('Finanzen')).toBeVisible();
    await expect(hauptmenue.getByText('Finanzübersicht')).toBeHidden();
    await expect(hauptmenue.getByText('Komponenten')).toBeHidden();
    await expect(hauptmenue.getByText('© Björn Bochmann')).toBeHidden();
    await expect(hauptmenue.getByRole('link', { name: 'Einstellungen' })).toBeHidden();
    // Ohne Fußzeile; Impressum und Datenschutz über die Einstellungen.
    await expect(page.getByRole('contentinfo')).toBeHidden();
    // Nur für Screenreader: Der Text bleibt im Zugriffsbaum, sichtbar ist nur der graue Eintrag.
    await expect(hauptmenue).toContainText('Demnächst verfügbar');

    const box = await hauptmenue.boundingBox();
    expect(box!.y + box!.height).toBe(844);
    const breite = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(breite).toBe(390);
  },
);

test('Fußzeile der Shell: nur die rechtlichen Links, mittig zur ganzen Seite', async ({ page }) => {
  for (const pfad of ['/start', '/vertraege']) {
    await page.goto(pfad);
    const fusszeile = page.getByRole('contentinfo');
    await expect(fusszeile, pfad).toContainText('Impressum');
    await expect(fusszeile, pfad).not.toContainText('©');
    await expect(fusszeile, pfad).not.toContainText('v0.');
    await expect(page.getByRole('status', { name: 'Systemstatus' }), pfad).toHaveCount(0);
    const links = (await fusszeile.getByRole('navigation').boundingBox())!;
    expect(Math.abs(links.x + links.width / 2 - 640), pfad).toBeLessThan(2);
    // Läuft unter der Seitenleiste durch.
    expect((await fusszeile.boundingBox())!.x, pfad).toBe(0);
  }
});

/** Linker und rechter Rand des Inhalts in main. */
async function raender(page: Page, pfad: string) {
  await page.goto(pfad);
  await page.getByRole('heading', { level: 1 }).waitFor();
  return page.locator('main').evaluate((main) => {
    const { left, right } = main.getBoundingClientRect();
    const stil = getComputedStyle(main);
    return [left + parseFloat(stil.paddingLeft), right - parseFloat(stil.paddingRight)];
  });
}

test('Inhalt mit gleichem Abstand links und rechts; Titel und Hauptaktion bündig, Konto am Rand', async ({
  page,
}) => {
  for (const [breite, rand] of [
    [1920, 268], // 1152 px mittig neben der Seitenleiste
    [1280, 24], // mindestens 24 px
  ]) {
    await page.setViewportSize({ width: breite, height: 900 });
    for (const pfad of ['/start', '/vertraege', '/vertraege/neu', '/einstellungen']) {
      const name = `${pfad} ${breite}`;
      expect(await raender(page, pfad), name).toEqual([232 + rand, breite - rand]);
      // Titel, ggf. mit Pfad davor.
      const titel = (await page.locator('app-kopfzeile .titel').boundingBox())!;
      expect(titel.x, name).toBe(232 + rand);
      const knopf = (await nutzerKnopf(page).boundingBox())!;
      expect(Math.round(knopf.x + knopf.width), name).toBe(breite - 24);
    }
  }

  // Die Hauptaktion endet am Inhalt; mit Abstand zur Glocke ohne Trennstrich.
  const neu = (page: Page) => page.getByRole('banner').getByRole('link', { name: 'Neuer Vertrag' });
  const trenner = page.locator('app-kopfzeile .trenner');
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto('/vertraege');
  let box = (await neu(page).boundingBox())!;
  expect(Math.round(box.x + box.width)).toBe(1920 - 268);
  await expect(trenner).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(trenner).toBeVisible();
  box = (await neu(page).boundingBox())!;
  const glocke = (await page
    .getByRole('banner')
    .getByRole('button', { name: 'Benachrichtigungen' })
    .boundingBox())!;
  expect(Math.round(glocke.x - (box.x + box.width))).toBe(25);
});
