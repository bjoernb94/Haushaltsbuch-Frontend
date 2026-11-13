import { readFileSync } from 'node:fs';
import { expect, Page, test } from '@playwright/test';
import { backendSimulieren } from './backend-mock';

const { version } = JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string };

const streifen = (page: Page) => page.getByText('-Umgebung · keine echten Daten eingeben');

test('Login zeigt die Frontend-Version und die Umgebung, in PROD ohne Streifen', async ({
  page,
}) => {
  await backendSimulieren(page);
  await page.goto('/login');
  const anzeige = page.locator('app-version-anzeige');
  await expect(anzeige).toHaveText(`v${version}Umgebung PROD`);
  await expect(streifen(page)).toHaveCount(0);
});

test('außerhalb von PROD steht der Streifen über der Seite, ohne dass sie scrollt', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await backendSimulieren(page, { stage: 'DEV' });
  await page.goto('/login');
  await expect(streifen(page)).toHaveText('DEV-Umgebung · keine echten Daten eingeben');
  await expect(page.locator('app-version-anzeige')).toContainText('DEV');
  const box = (await streifen(page).boundingBox())!;
  expect(box.y).toBe(0);
  expect(box.height).toBe(24);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(900);
});

test('die Shell zeigt Version und Streifen', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true, stage: 'DEV' });
  await page.goto('/vertraege');
  await expect(page.locator('footer app-version-anzeige')).toContainText(`v${version}`);
  await expect(streifen(page)).toBeVisible();
});

test('die Seitenleiste beginnt unter dem Streifen und passt ins Fenster', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await backendSimulieren(page, { angemeldet: true, stage: 'DEV' });
  await page.goto('/vertraege');
  await expect(streifen(page)).toBeVisible();
  const leiste = (await page.getByRole('navigation', { name: 'Hauptmenü' }).boundingBox())!;
  expect(leiste.y).toBe(24);
  expect(leiste.y + leiste.height).toBe(720);
});

test('ohne Antwort des Backends steht die Version trotzdem, ohne Badge und Streifen', async ({
  page,
}) => {
  await backendSimulieren(page, { stage: 'DEV' });
  await page.route('/actuator/info', (route) => route.abort());
  await page.goto('/login');
  await expect(page.locator('app-version-anzeige')).toHaveText(`v${version}`);
  await expect(streifen(page)).toHaveCount(0);
});

test('Handy: der Streifen bleibt einzeilig', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await backendSimulieren(page, { stage: 'DEV' });
  await page.goto('/login');
  expect((await streifen(page).boundingBox())!.height).toBe(24);
  const breiten = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(breiten[0]).toBe(breiten[1]);
});
