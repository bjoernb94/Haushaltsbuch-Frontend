import { APIResponse, expect, Page, test } from '@playwright/test';
import { backendSimulieren, BEISPIEL_VERTRAEGE } from '../e2e/backend-mock';

const SICHERHEITS_HEADER = {
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'permissions-policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
};

function sicherheitsHeaderPruefen(antwort: APIResponse) {
  expect(antwort.headers()).toMatchObject(SICHERHEITS_HEADER);
}

/** Sammelt, was die CSP blockiert und was im Browser sonst schiefgeht. */
async function verstoesseSammeln(page: Page) {
  const fehler: string[] = [];
  page.on('pageerror', (error) => fehler.push(error.message));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP-Verstoß: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  page.on('console', (nachricht) => {
    if (nachricht.type() === 'error' && nachricht.text().includes('CSP-Verstoß')) {
      fehler.push(nachricht.text());
    }
  });
  return fehler;
}

test.describe('CSP', () => {
  test('die App läuft ohne Verstoß: Anmeldung', async ({ page }) => {
    const fehler = await verstoesseSammeln(page);
    await backendSimulieren(page);
    await page.goto('/login');
    await page.getByLabel('E-Mail').fill('max@beispiel.de');
    await page.getByLabel('Passwort', { exact: true }).fill('geheim123');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/start$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Willkommen');
    expect(fehler).toEqual([]);
  });

  test('die App läuft ohne Verstoß: Verträge mit Details und Formular', async ({ page }) => {
    const fehler = await verstoesseSammeln(page);
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');
    await page
      .getByRole('button', { name: /^Details zu/ })
      .first()
      .click();
    await expect(page.getByRole('region', { name: /^Details zu/ })).toBeVisible();
    await page
      .getByRole('button', { name: /bearbeiten$/ })
      .first()
      .click();
    await expect(page.getByRole('form')).toBeVisible();
    await page.goto('/vertraege/neu');
    await expect(page.getByLabel('Anbieter *')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.fonts.check('16px "Manrope Variable"')))
      .toBe(true);
    expect(fehler).toEqual([]);
  });

  test('blockiert ein fremdes Skript', async ({ page }) => {
    const fehler = await verstoesseSammeln(page);
    await backendSimulieren(page);
    await page.goto('/login');
    await page.addScriptTag({ content: 'window.eingeschleust = true' }).catch(() => undefined);
    expect(await page.evaluate(() => 'eingeschleust' in window)).toBe(false);
    await expect.poll(() => fehler.join()).toContain('CSP-Verstoß');
  });
});

test.describe('Auslieferung', () => {
  test('index.html: Header gesetzt, nicht lange gecacht', async ({ request }) => {
    const antwort = await request.get('/');
    expect(antwort.status()).toBe(200);
    sicherheitsHeaderPruefen(antwort);
    expect(antwort.headers()['cache-control']).toBe('no-cache');
  });

  test('ein tiefer Link liefert index.html mit Headern', async ({ request }) => {
    const antwort = await request.get('/vertraege/neu');
    expect(antwort.status()).toBe(200);
    expect(antwort.headers()['content-type']).toContain('text/html');
    expect(await antwort.text()).toContain('<app-root>');
    sicherheitsHeaderPruefen(antwort);
  });

  test('gehashte Bundles: Header gesetzt, lange gecacht', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const bundle = /src="(main-[^"]+\.js)"/.exec(html)?.[1];
    expect(bundle).toBeTruthy();
    const antwort = await request.get(`/${bundle}`);
    expect(antwort.status()).toBe(200);
    sicherheitsHeaderPruefen(antwort);
    expect(antwort.headers()['cache-control']).toContain('immutable');
  });

  test('ein fehlendes Bundle ist 404 und nicht index.html', async ({ request }) => {
    const antwort = await request.get('/chunk-AAAAAAAA.js');
    expect(antwort.status()).toBe(404);
  });
});

test.describe('Weiterleitung ans Backend', () => {
  test('/api geht mit Cookie, CSRF-Header und Herkunft ans Backend', async ({ request }) => {
    const antwort = await request.post('/api/anmeldung?a=1', {
      headers: { Cookie: 'SESSION=abc', 'X-XSRF-TOKEN': 'token' },
    });
    expect(antwort.headers()['x-backend-attrappe']).toBe('ja');
    const { methode, pfad, kopfzeilen } = await antwort.json();
    expect({ methode, pfad }).toEqual({ methode: 'POST', pfad: '/api/anmeldung?a=1' });
    expect(kopfzeilen).toMatchObject({
      cookie: 'SESSION=abc',
      'x-xsrf-token': 'token',
      host: '127.0.0.1',
      'x-forwarded-host': '127.0.0.1',
      'x-forwarded-proto': 'http',
    });
  });

  test('der Systemstatus geht ans Backend', async ({ request }) => {
    const antwort = await request.get('/actuator/health/systemstatus');
    expect(antwort.headers()['x-backend-attrappe']).toBe('ja');
    expect((await antwort.json()).pfad).toBe('/actuator/health/systemstatus');
  });

  for (const pfad of ['/actuator/health', '/actuator/env', '/apifoo', '/v3/api-docs']) {
    test(`${pfad} bleibt beim Frontend`, async ({ request }) => {
      const antwort = await request.get(pfad);
      expect(antwort.headers()['x-backend-attrappe']).toBeUndefined();
      expect(antwort.headers()['content-type']).toContain('text/html');
    });
  }
});
