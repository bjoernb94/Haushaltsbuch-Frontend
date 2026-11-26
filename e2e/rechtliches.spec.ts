import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, INSTANZ, nutzerKnopf } from './backend-mock';

const zurueck = (page: Page) => page.getByRole('link', { name: /^Zurück/ });
const recht = (page: Page, name: 'Impressum' | 'Datenschutz') =>
  page.getByRole('navigation', { name: 'Rechtliches' }).getByRole('link', { name });

test('vom Login zu Impressum und Datenschutz und zurück', async ({ page }) => {
  await backendSimulieren(page);
  await page.goto('/login');
  await recht(page, 'Impressum').click();
  await expect(page).toHaveURL(/\/impressum$/);
  await expect(page).toHaveTitle('Impressum – Haushaltsbuch');
  await expect(recht(page, 'Impressum')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText(INSTANZ.betreiber.name)).toBeVisible();
  await expect(nutzerKnopf(page)).toHaveCount(0);

  await recht(page, 'Datenschutz').click();
  await expect(page).toHaveURL(/\/datenschutz$/);
  await expect(recht(page, 'Datenschutz')).toHaveAttribute('aria-current', 'page');
  await expect(zurueck(page)).toHaveAccessibleName('Zurück zu Login');
  await zurueck(page).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('von der Registrierung zurück zur Registrierung', async ({ page }) => {
  await backendSimulieren(page);
  await page.goto('/registrierung');
  await recht(page, 'Datenschutz').click();
  await zurueck(page).click();
  await expect(page).toHaveURL(/\/registrierung$/);
});

test('mit Session: Nutzermenü, zurück zur Herkunft, Abmelden', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/vertraege');
  await recht(page, 'Impressum').click();
  await expect(nutzerKnopf(page)).toBeVisible();
  await expect(zurueck(page)).toHaveAccessibleName('Zurück zu Verträge');
  await zurueck(page).click();
  await expect(page).toHaveURL(/\/vertraege$/);

  await recht(page, 'Datenschutz').click();
  await nutzerKnopf(page).click();
  await page
    .getByRole('dialog', { name: 'Dein Konto' })
    .getByRole('button', { name: 'Abmelden' })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});

test('direkt aufgerufen: ohne Session zum Login, mit Session zur Startseite', async ({ page }) => {
  await backendSimulieren(page);
  await page.goto('/impressum');
  await expect(zurueck(page)).toHaveAccessibleName('Zurück zu Login');

  await page.unrouteAll();
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/datenschutz');
  await expect(nutzerKnopf(page)).toBeVisible();
  await expect(zurueck(page)).toHaveAccessibleName('Zurück zu Startseite');
  await zurueck(page).click();
  await expect(page).toHaveURL(/\/start$/);
});

test('nach dem Neuladen bleibt die Herkunft', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/vertraege/neu');
  await recht(page, 'Impressum').click();
  await expect(page).toHaveURL(/\/impressum$/);
  await page.reload();
  await expect(zurueck(page)).toHaveAccessibleName('Zurück zu Neuer Vertrag');
});

test('Logo und Nutzer-Button stehen wie in der Shell', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/start');
  const logo = await page
    .getByRole('banner')
    .getByText('Haushaltsbuch', { exact: true })
    .boundingBox();
  const knopf = await nutzerKnopf(page).boundingBox();
  await recht(page, 'Impressum').click();
  await expect(page).toHaveURL(/\/impressum$/);
  expect(
    await page.getByRole('banner').getByText('Haushaltsbuch', { exact: true }).boundingBox(),
  ).toEqual(logo);
  expect(await nutzerKnopf(page).boundingBox()).toEqual(knopf);
});

test('„Zurück“ steht am Rand der Startseite, der Text mittig', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/start');
  const start = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
  for (const pfad of ['/impressum', '/datenschutz']) {
    await page.goto(pfad);
    expect((await zurueck(page).boundingBox())!.x, pfad).toBe(start.x);
    const text = (await page.locator('main section').first().boundingBox())!;
    expect(text.width, pfad).toBeLessThanOrEqual(768);
    expect(Math.abs(text.x + text.width / 2 - 800), pfad).toBeLessThan(2);
  }
});

test('das Impressum nennt Frontend- und Backend-Version getrennt', async ({ page }) => {
  await backendSimulieren(page);
  await page.goto('/impressum');
  await expect(page.getByText('Version Frontend')).toBeVisible();
  await expect(page.getByText('v0.1.0 · Commit 48eaea5 · Build')).toBeVisible();
});

test('Lizenz und Quellcode stehen auch ohne instanz.json im Impressum', async ({ page }) => {
  await backendSimulieren(page, { instanz: null });
  await page.goto('/impressum');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'GNU Affero General Public License v3.0 oder später' }),
  ).toHaveAttribute('href', 'https://www.gnu.org/licenses/agpl-3.0.html');
  // Der Dev-Server kennt keinen Commit des Frontends, das Backend liefert einen.
  await expect(
    page.getByRole('link', { name: 'github.com/bjoernb94/Haushaltsbuch-Frontend' }),
  ).toHaveAttribute('href', 'https://github.com/bjoernb94/Haushaltsbuch-Frontend');
  await expect(
    page.getByRole('link', { name: 'github.com/bjoernb94/Haushaltsbuch-Backend' }),
  ).toHaveAttribute('href', 'https://github.com/bjoernb94/Haushaltsbuch-Backend/tree/48eaea5');
});

test('ein Fork ersetzt die Links zum Quellcode in der instanz.json', async ({ page }) => {
  await backendSimulieren(page, {
    instanz: { ...INSTANZ, quellcode: { backend: 'https://example.org/fork/backend' } },
  });
  await page.goto('/impressum');
  await expect(page.getByRole('link', { name: 'example.org/fork/backend' })).toHaveAttribute(
    'href',
    'https://example.org/fork/backend',
  );
  await expect(
    page.getByRole('link', { name: 'github.com/bjoernb94/Haushaltsbuch-Frontend' }),
  ).toBeVisible();
});

test('ohne instanz.json ein Hinweis statt der Angaben', async ({ page }) => {
  await backendSimulieren(page, { instanz: null });
  await page.goto('/datenschutz');
  await expect(page.getByRole('alert')).toHaveText(
    'Für diese Instanz sind keine Angaben zum Betreiber hinterlegt.',
  );
  await expect(page.getByRole('heading', { name: '1. Verantwortlicher' })).toHaveCount(0);
});

test('Handy: alles passt in die Breite', { tag: '@mobil' }, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await backendSimulieren(page, { angemeldet: true });
  for (const pfad of ['/impressum', '/datenschutz']) {
    await page.goto(pfad);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const [scroll, breite] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scroll, pfad).toBe(breite);
  }
});

test('Impressum: Links mittig unter dem Systemstatus', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/impressum');
  const status = (await page.getByRole('status', { name: 'Systemstatus' }).boundingBox())!;
  const links = (await page.getByRole('navigation', { name: 'Rechtliches' }).boundingBox())!;
  expect(links.y).toBeGreaterThan(status.y);
  expect(Math.abs(links.x + links.width / 2 - (status.x + status.width / 2))).toBeLessThan(2);
});
