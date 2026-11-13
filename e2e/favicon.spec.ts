import { expect, Page, test } from '@playwright/test';
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

/** Lädt ein Bild aus `public/`: Maße und Deckkraft der Ecken. */
function bildPruefen(page: Page, src: string) {
  return page.evaluate(async (url) => {
    const bild = new Image();
    bild.src = url;
    await bild.decode();
    const canvas = document.createElement('canvas');
    canvas.width = bild.naturalWidth;
    canvas.height = bild.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bild, 0, 0);
    const deckkraft = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3];
    const r = canvas.width - 1;
    return {
      breite: bild.naturalWidth,
      hoehe: bild.naturalHeight,
      ecken: [deckkraft(0, 0), deckkraft(r, 0), deckkraft(0, r), deckkraft(r, r)],
    };
  }, src);
}

test.describe('App-Icon', () => {
  test.beforeEach(async ({ page }) => {
    await backendSimulieren(page);
    await page.goto('/login');
  });

  test('das SVG hängt von keiner Schrift und keiner fremden Datei ab', async ({ page }) => {
    const svg = await (await page.request.get('favicon.svg')).text();
    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('font');
    expect(svg).not.toMatch(/href=|https?:\/\/(?!www\.w3\.org)/);
  });

  test('das Homescreen-Icon hat eine volle Fläche, iOS rundet selbst ab', async ({ page }) => {
    expect(await bildPruefen(page, 'apple-touch-icon.png')).toEqual({
      breite: 180,
      hoehe: 180,
      ecken: [255, 255, 255, 255],
    });
  });

  test('das ICO enthält 16, 32 und 48 px', async ({ page }) => {
    const ico = await (await page.request.get('favicon.ico')).body();
    expect(ico.readUInt16LE(2)).toBe(1);
    const anzahl = ico.readUInt16LE(4);
    const groessen = Array.from({ length: anzahl }, (_, i) => ico[6 + i * 16]);
    expect(groessen).toEqual([16, 32, 48]);
  });
});

test.describe('Logo', () => {
  // Auf der Startseite steckt ein zweites Logo in der Tab-Leiste, die dort erst bis 900 px erscheint.
  const logo = (page: Page) => page.locator('app-logo svg >> visible=true');

  async function groesse(page: Page) {
    const box = await logo(page).boundingBox();
    return [box!.width, box!.height];
  }

  test('Login und Registrierung: 36 px, schmal 26 px, in der Farbe der Fläche', async ({
    page,
  }) => {
    await backendSimulieren(page);
    for (const pfad of ['/login', '/registrierung']) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(pfad);
      await expect(logo(page)).toBeVisible();
      expect(await groesse(page)).toEqual([36, 36]);
      const farbe = await page.locator('app-logo path').evaluate((p) => getComputedStyle(p).fill);
      expect(farbe).toBe(await page.locator('.logo').evaluate((e) => getComputedStyle(e).color));

      await page.setViewportSize({ width: 390, height: 800 });
      expect(await groesse(page)).toEqual([26, 26]);
    }
  });

  test('Kopfzeile: 30 px, auf Startseite und Impressum', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    for (const pfad of ['/start', '/impressum']) {
      await page.goto(pfad);
      await expect(logo(page)).toBeVisible();
      expect(await groesse(page)).toEqual([30, 30]);
    }
  });

  test('Seitenleiste: 26 px in Grün, die Kopfzeile ohne Logo', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege');
    const inLeiste = page.locator('app-hauptmenue app-logo svg');
    await expect(inLeiste).toBeVisible();
    const box = (await inLeiste.boundingBox())!;
    expect([box.width, box.height]).toEqual([26, 26]);
    const farbe = await inLeiste.locator('path').evaluate((p) => getComputedStyle(p).fill);
    expect(farbe).toBe('rgb(31, 92, 69)');
    await expect(page.locator('app-kopfzeile app-logo svg')).toBeHidden();
  });

  test('das Logo braucht keine Schrift: kein Text und keine Maske', async ({ page }) => {
    await backendSimulieren(page);
    await page.goto('/login');
    await expect(logo(page).locator('text, mask')).toHaveCount(0);
    await expect(logo(page)).toHaveAttribute('aria-hidden', 'true');
  });
});
