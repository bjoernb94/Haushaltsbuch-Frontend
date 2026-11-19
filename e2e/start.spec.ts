import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, BEISPIEL_VERTRAEGE } from './backend-mock';

test('zeigt verfügbare Kacheln mit Link und die übrigen ausgegraut', async ({ page }) => {
  const aufrufe: string[] = [];
  page.on('request', (anfrage) => {
    if (anfrage.url().includes('/api/buchungen') || anfrage.url().includes('/api/portfolio')) {
      aufrufe.push(anfrage.url());
    }
  });
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/start');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Willkommen, Max!');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Finanzübersicht',
    'Vertragsübersicht',
    'Versorgungsverträge',
    'Portfolio',
  ]);
  await expect(page.getByRole('main').getByText('Demnächst verfügbar')).toHaveCount(3);
  await expect(page.getByRole('main').getByRole('link')).toHaveCount(1);
  expect(aufrufe).toEqual([]);

  await page.getByRole('link', { name: 'Alle Verträge' }).click();
  await expect(page).toHaveURL(/\/vertraege$/);
});

test('zeigt nur Kacheln gebuchter Komponenten', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true, komponenten: ['PORTFOLIO'] });
  await page.goto('/start');

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Portfolio']);
  await expect(page.getByRole('link', { name: 'Alle Verträge' })).toHaveCount(0);
});

test('ohne geladene Komponenten bleibt nur der Hinweis', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true });
  await page.route('/api/nutzer/ich/komponenten', (route) => route.fulfill({ status: 500 }));
  await page.goto('/start');

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);
});

test.describe('Finanzübersicht', () => {
  const finanzen = (page: Page) => page.getByRole('region', { name: 'Finanzübersicht' });

  test('füllt neben der Vertragskachel den Platz, ohne gestreckte Zeilen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/start');
    await expect(page.getByRole('region', { name: 'Vertragsübersicht' })).toContainText(
      'bis 30.11.2026',
    );

    const zeilen = finanzen(page).locator('.zeile');
    await expect.poll(() => zeilen.count()).toBeGreaterThanOrEqual(3);
    for (const hoehe of await zeilen.evaluateAll((e) => e.map((z) => z.offsetHeight))) {
      expect(hoehe).toBe(45);
    }
    const [finanz, vertrag] = await page
      .locator('app-finanz-kachel section, app-vertrag-kachel section')
      .evaluateAll((e) => e.map((k) => k.getBoundingClientRect().bottom));
    expect(finanz).toBe(vertrag);
    // Keine angeschnittene Zeile (Bruchteile eines Pixels sind Rundung).
    const { platz, letzte } = await finanzen(page).evaluate((e) => ({
      platz: e.querySelector('.platz')!.getBoundingClientRect().bottom,
      letzte: [...e.querySelectorAll('.zeile')].at(-1)!.getBoundingClientRect().bottom,
    }));
    expect(letzte).toBeLessThanOrEqual(platz + 0.5);
  });

  test('zeigt auf dem Handy 5 Buchungen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/start');

    await expect(finanzen(page).locator('.zeile')).toHaveCount(5);
  });
});

test('passt auf dem Handy in die Breite', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/start');

  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(page.getByRole('navigation', { name: 'Hauptmenü' })).toBeVisible();
});

test.describe('Vertragskachel', () => {
  const UEBERSICHT = '/api/vertraege/uebersicht';
  const kachel = (page: Page) => page.getByRole('region', { name: 'Vertragsübersicht' });

  test('zeigt Kennzahlen und Fristen aus dem Backend', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/start');

    await expect(kachel(page)).toContainText('Laufende Verträge6');
    await expect(kachel(page)).toContainText('124,56');
    await expect(kachel(page)).not.toContainText('Verbindlich ist der Betrag je Abbuchung.');
    await expect(kachel(page)).toContainText(/Kfz-Versicherung\s*586,80\s€\/Jahr/);
    await expect(kachel(page)).toContainText('bis 30.11.2026');
  });

  test('erklärt „Kosten pro Monat“ im Info-Knopf, per Tastatur bedienbar', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/start');

    const knopf = kachel(page).getByRole('button', { name: 'Info zu Kosten pro Monat' });
    await knopf.focus();
    await page.keyboard.press('Enter');
    await expect(knopf).toHaveAttribute('aria-expanded', 'true');
    await expect(kachel(page).getByRole('status').getByRole('listitem')).toHaveText([
      'Bei geteilten Verträgen zählt nur dein Anteil.',
      'Verträge, die erst später beginnen, sind noch nicht enthalten.',
      'Gerundet, kann um wenige Cent abweichen. Verbindlich ist der Betrag je Abbuchung.',
    ]);

    await page.keyboard.press('Escape');
    await expect(knopf).toHaveAttribute('aria-expanded', 'false');
    await expect(knopf).toBeFocused();
    await expect(kachel(page).getByRole('listitem')).toHaveCount(0);

    await knopf.click();
    await page.getByRole('heading', { level: 1 }).click();
    await expect(kachel(page).getByRole('listitem')).toHaveCount(0);
  });

  test('beide Kennzahlen gleich hoch, Fristen einzeilig', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/start');

    const kennzahlen = kachel(page).locator('.kennzahl');
    await expect(kennzahlen).toHaveCount(2);
    const [links, rechts] = await kennzahlen.evaluateAll((e) => e.map((k) => k.clientHeight));
    expect(links).toBe(rechts);

    const frist = kachel(page).locator('.frist').first();
    const { name, betrag } = await frist.evaluate((e) => ({
      name: e.querySelector('b')!.getBoundingClientRect().top,
      betrag: e.querySelector('.betrag')!.getBoundingClientRect().top,
    }));
    expect(Math.abs(name - betrag)).toBeLessThan(4);
  });

  test('kürzt lange Namen auf zwei Zeilen', async ({ page }) => {
    const lang = 'Sehr langer Text '.repeat(30).trim();
    await backendSimulieren(page, {
      angemeldet: true,
      vertraege: [{ ...BEISPIEL_VERTRAEGE[0], bezeichnung: lang }],
    });
    await page.goto('/start');

    const name = kachel(page).locator('.vertrag b');
    await expect(name).toHaveText(lang);
    const { sichtbar, gesamt, zeilenhoehe } = await name.evaluate((e) => ({
      sichtbar: e.clientHeight,
      gesamt: e.scrollHeight,
      zeilenhoehe: parseFloat(getComputedStyle(e).lineHeight),
    }));
    expect(gesamt).toBeGreaterThan(sichtbar);
    expect(sichtbar).toBeLessThanOrEqual(Math.ceil(zeilenhoehe * 2));
  });

  test('zeigt den Leerzustand', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/start');

    await expect(kachel(page)).toContainText('Laufende Verträge0');
    await expect(kachel(page)).toContainText(/0,00\s€/);
    await expect(kachel(page)).toContainText('Gerade steht keine Kündigungsfrist an.');
  });

  test('ohne Komponente keine Kachel und kein Aufruf', async ({ page }) => {
    let aufrufe = 0;
    page.on('request', (anfrage) => {
      if (anfrage.url().includes('/api/vertraege')) {
        aufrufe++;
      }
    });
    await backendSimulieren(page, { angemeldet: true, komponenten: ['PORTFOLIO'] });
    await page.goto('/start');

    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Portfolio']);
    expect(aufrufe).toBe(0);
  });

  test('bietet nach einem Fehler einen neuen Versuch an', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    let scheitert = true;
    await page.route(UEBERSICHT, (route) =>
      scheitert ? route.fulfill({ status: 500 }) : route.fallback(),
    );
    await page.goto('/start');

    await expect(kachel(page).getByRole('alert')).toHaveText(
      'Die Vertragsübersicht konnte nicht geladen werden.',
    );

    scheitert = false;
    await kachel(page).getByRole('button', { name: 'Erneut versuchen' }).click();

    await expect(kachel(page).getByRole('alert')).toHaveCount(0);
    await expect(kachel(page)).toContainText('Laufende Verträge6');
  });

  test('abbestellte Komponente: Kachel verschwindet, Komponenten werden neu geladen', async ({
    page,
  }) => {
    await backendSimulieren(page, { angemeldet: true });
    let abbestellt = false;
    await page.route('/api/nutzer/ich/komponenten', (route) =>
      abbestellt
        ? route.fulfill({ json: { komponenten: ['PORTFOLIO'], version: 1 } })
        : route.fallback(),
    );
    await page.route(UEBERSICHT, (route) => {
      abbestellt = true;
      return route.fulfill({
        status: 403,
        contentType: 'application/problem+json',
        json: { status: 403, code: 'KEIN_ZUGRIFF', detail: 'Access denied.' },
      });
    });
    await page.goto('/start');

    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Portfolio']);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page).toHaveURL(/\/start$/);
  });
});
