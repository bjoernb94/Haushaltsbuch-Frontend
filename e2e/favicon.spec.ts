import { expect, test } from '@playwright/test';
import { backendSimulieren } from './backend-mock';

for (const [selektor, typ] of [
  ['link[rel="icon"][type="image/svg+xml"]', 'image/svg+xml'],
  ['link[rel="icon"][sizes]', 'image/'],
  ['link[rel="apple-touch-icon"]', 'image/png'],
]) {
  test(`${selektor} verweist auf eine vorhandene Datei`, async ({ page }) => {
    await backendSimulieren(page);
    await page.goto('/login');

    const href = await page.locator(selektor).getAttribute('href');
    const antwort = await page.request.get(href!);
    expect(antwort.ok()).toBe(true);
    expect(antwort.headers()['content-type']).toContain(typ);
  });
}
