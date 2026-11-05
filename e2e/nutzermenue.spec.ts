import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, MAX, nutzerKnopf } from './backend-mock';

function panel(page: Page) {
  return page.getByRole('dialog', { name: 'Dein Konto' });
}

test.beforeEach(async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/start');
});

test('zeigt Initialen und Vorname, das Panel Name und E-Mail', async ({ page }) => {
  await expect(nutzerKnopf(page)).toContainText('MM');
  await expect(nutzerKnopf(page)).toContainText(MAX.vorname);
  await expect(nutzerKnopf(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(panel(page)).toHaveCount(0);

  await nutzerKnopf(page).click();

  await expect(nutzerKnopf(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(panel(page)).toContainText(`${MAX.vorname} ${MAX.name}`);
  await expect(panel(page)).toContainText(MAX.email);
});

test('per Tastatur bedienbar', async ({ page }) => {
  await nutzerKnopf(page).focus();
  await page.keyboard.press('Enter');
  await expect(panel(page)).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
  await expect(nutzerKnopf(page)).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(panel(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(panel(page).getByRole('button', { name: 'Abmelden' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(panel(page)).toHaveCount(0);
});

test('Klick daneben schließt das Panel', async ({ page }) => {
  await nutzerKnopf(page).click();
  await expect(panel(page)).toBeFocused();
  await page.mouse.click(10, 400);
  await expect(panel(page)).toHaveCount(0);
  await expect(nutzerKnopf(page)).toBeFocused();
});

test('über 640 px hängt das Panel am Knopf, mit Vorname und Pfeil', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(nutzerKnopf(page).locator('.vorname')).toBeVisible();
  await expect(nutzerKnopf(page).locator('.pfeil')).toBeVisible();

  await nutzerKnopf(page).click();

  const knopf = (await nutzerKnopf(page).boundingBox())!;
  const box = (await panel(page).boundingBox())!;
  expect(box.width).toBe(300);
  expect(box.y).toBeGreaterThanOrEqual(knopf.y + knopf.height);
  expect(Math.round(box.x + box.width)).toBe(Math.round(knopf.x + knopf.width));
  await expect(panel(page).locator('.griff')).toBeHidden();
});

test('der Knopf steht auf allen Seiten an derselben Stelle', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 800 });
  const start = (await nutzerKnopf(page).boundingBox())!;
  expect(1600 - (start.x + start.width)).toBeGreaterThan(24);

  await page.goto('/vertraege');
  await expect(page.getByRole('navigation', { name: 'Hauptmenü' })).toBeVisible();

  expect(await nutzerKnopf(page).boundingBox()).toEqual(start);
});

test('bis 640 px nur Initialen, das Panel als Bottom-Sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(nutzerKnopf(page).locator('.vorname')).toBeHidden();
  await expect(nutzerKnopf(page).locator('.pfeil')).toBeHidden();
  const knopf = (await nutzerKnopf(page).boundingBox())!;
  expect(knopf.width).toBeGreaterThanOrEqual(44);
  expect(knopf.height).toBeGreaterThanOrEqual(44);

  await nutzerKnopf(page).click();

  const box = (await panel(page).boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.width).toBe(390);
  expect(Math.round(box.y + box.height)).toBe(800);
  await expect(panel(page).locator('.griff')).toBeVisible();
});

test('lange E-Mail-Adressen brechen um', async ({ page }) => {
  await page.unrouteAll();
  await backendSimulieren(page, { angemeldet: true });
  const email = `${'sehr.lange.adresse.'.repeat(6)}@beispiel.de`;
  await page.route('/api/nutzer/ich', (route) => route.fulfill({ json: { ...MAX, email } }));
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/start');

  await nutzerKnopf(page).click();

  await expect(panel(page)).toContainText(email);
  const breiten = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(breiten[0]).toBe(breiten[1]);
});
