import { expect, Page, test } from '@playwright/test';
import { abmelden, backendSimulieren, BEISPIEL_VERTRAEGE } from './backend-mock';

/** Der Name des Tabs kann einen Fehlerzähler tragen, z. B. „Kosten 3, 3 Fehler“. */
async function tab(page: Page, name: 'Allgemein' | 'Kosten' | 'Laufzeit' | 'Preise') {
  await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
}

/** Endet im Tab „Kosten“. */
async function pflichtfelderFuellen(page: Page, anbieter = 'Neuer Anbieter') {
  await tab(page, 'Allgemein');
  await page.getByLabel('Anbieter *').fill(anbieter);
  await page.getByLabel('Kategorie *').selectOption({ label: 'Versicherung' });
  await tab(page, 'Kosten');
  await page.getByLabel('Betrag in € *').fill('19,99');
  await page.getByLabel('Zahlweise *').selectOption({ label: 'monatlich' });
  await page.getByLabel('Nächste Abbuchung *').fill('2027-01-01');
}

/** Bis 900 px heißt der Knopf in der Leiste oben „Sichern“. */
async function speichernUndAnfrageLesen(page: Page, knopf = 'Vertrag speichern') {
  const anfrage = page.waitForRequest(
    (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/vertraege',
  );
  await page.getByRole('button', { name: knopf }).click();
  return (await anfrage).postDataJSON();
}

test.describe('Neuer Vertrag', () => {
  test('„Neuer Vertrag“ in der Liste führt zum Formular, der Bereich bleibt markiert', async ({
    page,
  }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege');
    await expect(page.getByText('Noch keine Verträge')).toBeVisible();

    await page.getByRole('link', { name: 'Neuer Vertrag' }).click();
    await expect(page).toHaveURL(/\/vertraege\/neu$/);
    await expect(page).toHaveTitle('Neuer Vertrag – Haushaltsbuch');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Neuer Vertrag');
    await expect(
      page.getByRole('navigation', { name: 'Hauptmenü' }).getByRole('link', { name: 'Verträge' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test.describe('ungespeicherte Eingaben', () => {
    const dialog = (page: Page) => page.getByRole('dialog', { name: 'Änderungen verwerfen?' });

    test('Abmelden fragt vor dem Abmelden nach', async ({ page }) => {
      let abgemeldet = false;
      page.on('request', (r) => {
        if (new URL(r.url()).pathname === '/api/abmeldung') abgemeldet = true;
      });
      await backendSimulieren(page, { angemeldet: true });
      await page.goto('/vertraege/neu');
      await page.getByLabel('Anbieter *').fill('Halb getippt');
      await abmelden(page);
      await expect(dialog(page)).toBeVisible();
      await dialog(page).getByRole('button', { name: 'Weiter bearbeiten' }).click();
      await expect(page.getByLabel('Anbieter *')).toHaveValue('Halb getippt');
      expect(abgemeldet).toBe(false);

      await abmelden(page);
      await dialog(page).getByRole('button', { name: 'Verwerfen' }).click();
      await expect(page).toHaveURL(/\/login/);
      await expect(dialog(page)).toHaveCount(0);
      expect(abgemeldet).toBe(true);
    });

    for (const [name, rolle] of [
      ['Abbrechen', 'button'],
      ['Zurück zu Verträgen', 'link'],
    ] as const) {
      test(`${name} fragt nach, „Weiter bearbeiten“ bleibt`, async ({ page }) => {
        await backendSimulieren(page, { angemeldet: true });
        await page.goto('/vertraege/neu');
        await page.getByLabel('Anbieter *').fill('Halb getippt');

        await page.getByRole(rolle, { name }).click();
        await dialog(page).getByRole('button', { name: 'Weiter bearbeiten' }).click();
        await expect(page).toHaveURL(/\/vertraege\/neu$/);
        await expect(page.getByLabel('Anbieter *')).toHaveValue('Halb getippt');

        await page.getByRole(rolle, { name }).click();
        await dialog(page).getByRole('button', { name: 'Verwerfen' }).click();
        await expect(page).toHaveURL(/\/vertraege$/);
      });
    }

    test('nach dem Speichern kein Dialog', async ({ page }) => {
      await backendSimulieren(page, { angemeldet: true });
      await page.goto('/vertraege/neu');
      await pflichtfelderFuellen(page);
      await speichernUndAnfrageLesen(page);
      await expect(page).toHaveURL(/\/vertraege$/);
      await expect(dialog(page)).toHaveCount(0);
    });
  });

  test.describe('verlässt das Formular ohne Anfrage', () => {
    for (const [name, rolle] of [
      ['Abbrechen', 'button'],
      ['Zurück zu Verträgen', 'link'],
    ] as const) {
      test(name, async ({ page }) => {
        await backendSimulieren(page, { angemeldet: true });
        await page.goto('/vertraege/neu');
        await page.getByRole(rolle, { name }).click();
        await expect(page).toHaveURL(/\/vertraege$/);
        await expect(page.getByText('Noch keine Verträge')).toBeVisible();
      });
    }
  });

  test('legt einen vollständigen Vertrag an; Liste und Kennzahlen sind neu geladen', async ({
    page,
  }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege/neu');

    await pflichtfelderFuellen(page, ' Neuer Anbieter ');
    await page.getByLabel('Zahlungsweg').selectOption({ label: 'PayPal' });
    await tab(page, 'Allgemein');
    await page.getByLabel('Bezeichnung').fill('Mein Vertrag');
    await page.getByLabel('Vertrags- oder Kundennummer').fill('V-1');
    await page.getByLabel('Notiz').fill('Familien-Abo');
    await tab(page, 'Laufzeit');
    await page.getByLabel('Vertragsbeginn').fill('2026-01-01');
    await page.getByLabel('Laufzeitende').fill('2027-12-31');
    await page.getByLabel('Verlängerung').selectOption({ label: 'Nach Laufzeitende um 12 Monate' });
    await page.getByLabel('Kündigungsfrist').selectOption({ label: '3 Monate' });

    expect(await speichernUndAnfrageLesen(page)).toEqual({
      anbieter: 'Neuer Anbieter',
      bezeichnung: 'Mein Vertrag',
      kategorieId: 'kategorie-2',
      vertragsnummer: 'V-1',
      preise: [{ gueltigAb: null, betrag: { wert: 19.99, waehrung: 'EUR' } }],
      zahlweise: 'MONATLICH',
      abbuchungAb: '2027-01-01',
      zahlungsweg: 'PAYPAL',
      kuendbar: true,
      beginn: '2026-01-01',
      laufzeitende: '2027-12-31',
      verlaengerung: 'ZWOELF_MONATE',
      kuendigungsfristMonate: 3,
      gekuendigtZum: null,
      notiz: 'Familien-Abo',
      anteilProzent: null,
      einmalkosten: [],
      preissteigerung: null,
      preisgarantieBis: null,
      erinnerungSonderkuendigung: true,
    });

    await expect(page).toHaveURL(/\/vertraege$/);
    await expect(
      page.getByRole('status').getByText('„Mein Vertrag“ wurde gespeichert.'),
    ).toBeVisible();
    await expect(page.getByText('Laufende Verträge7')).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Vertragsliste' })
        .getByText('Mein Vertrag', { exact: true }),
    ).toBeVisible();
  });

  test('zeigt die Erfolgsmeldung im sichtbaren Bereich, auch vom Ende des Formulars aus', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege/neu');
    await pflichtfelderFuellen(page);
    await speichernUndAnfrageLesen(page, 'Sichern');
    await expect(page.getByText('„Neuer Anbieter“ wurde gespeichert.')).toBeInViewport();
  });

  test.describe('holt den neuen Vertrag in einer langen Liste ins Bild', () => {
    const VIELE = Array.from({ length: 40 }, (_, i) => ({
      ...BEISPIEL_VERTRAEGE[0],
      id: `lang-${i}`,
      anbieter: `Anbieter ${i}`,
      bezeichnung: null,
    }));
    const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
    const meldung = (page: Page) => page.getByText('„Neuer Anbieter“ wurde gespeichert.');

    async function anlegen(page: Page, knopf?: string) {
      await backendSimulieren(page, { angemeldet: true, vertraege: VIELE });
      await page.goto('/vertraege/neu');
      await pflichtfelderFuellen(page);
      await speichernUndAnfrageLesen(page, knopf);
      await expect(page).toHaveURL(/\/vertraege$/);
    }

    test('Meldung an der Zeile im Bild, fokussiert, und das Router-Scrollen stört nicht', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 700 });
      await anlegen(page);
      await expect(meldung(page)).toBeInViewport();
      const zeile = page.locator('app-vertrag-zeile').last();
      await expect(zeile.getByText('Neuer Anbieter', { exact: true })).toBeInViewport();
      await expect(zeile.locator('.meldung')).toBeFocused();
      await expect.poll(() => scrollY(page)).toBeGreaterThan(500);
      // Bleibt stehen, auch wenn der Router seine Position zuletzt gesetzt hätte.
      await page.waitForTimeout(500);
      await expect(zeile).toBeInViewport({ ratio: 1 });
    });

    test('mit reduzierter Bewegung ebenso', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1280, height: 700 });
      await anlegen(page);
      await expect(page.locator('app-vertrag-zeile').last()).toBeInViewport({ ratio: 1 });
    });

    test('Handy: Die feste Navigation verdeckt die Zeile nicht', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 900 });
      await anlegen(page, 'Sichern');
      const zeile = page.locator('app-vertrag-zeile').last();
      await expect(zeile.locator('.meldung')).toBeFocused();
      const navigation = await page.getByRole('navigation', { name: 'Hauptmenü' }).boundingBox();
      await expect
        .poll(async () => {
          const box = await zeile.boundingBox();
          return box!.y + box!.height;
        })
        .toBeLessThanOrEqual(navigation!.y);
      await expect(meldung(page)).toBeInViewport();
    });

    test('Zurückblättern scrollt nicht erneut', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1280, height: 700 });
      await anlegen(page);
      await expect(meldung(page)).toBeInViewport();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page
        .getByRole('navigation', { name: 'Hauptmenü' })
        .getByRole('link', { name: 'Übersicht' })
        .click();
      await expect(page).toHaveURL(/\/start$/);
      await page.goBack();
      await expect(page.locator('app-vertrag-zeile').last()).toBeAttached();
      await page.waitForTimeout(300);
      expect(await scrollY(page)).toBe(0);
      await expect(meldung(page)).toHaveCount(0);
    });

    test('Neuladen scrollt nicht erneut', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1280, height: 700 });
      await anlegen(page);
      await expect(meldung(page)).toBeInViewport();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.reload();
      await expect(page.locator('app-vertrag-zeile').last()).toBeAttached();
      await page.waitForTimeout(300);
      expect(await scrollY(page)).toBe(0);
      await expect(meldung(page)).toHaveCount(0);
    });

    test('Liste nicht ladbar: Meldung oben, der neue Versuch holt die Zeile ins Bild', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 700 });
      await backendSimulieren(page, { angemeldet: true, vertraege: VIELE });
      await page.goto('/vertraege/neu');
      await pflichtfelderFuellen(page);
      let sperren = true;
      await page.route('**/api/vertraege/uebersicht', (route) =>
        sperren ? route.fulfill({ status: 500, json: {} }) : route.fallback(),
      );
      await speichernUndAnfrageLesen(page);
      await expect(page.getByText('Die Verträge konnten nicht geladen werden.')).toBeVisible();
      await expect(meldung(page)).toBeInViewport();
      expect(await scrollY(page)).toBe(0);

      sperren = false;
      await page.getByRole('button', { name: 'Erneut versuchen' }).click();
      await expect(page.locator('app-vertrag-zeile').last()).toBeInViewport({ ratio: 1 });
      await expect(meldung(page)).toBeInViewport();
    });
  });

  test('die Meldung erscheint beim Zurückblättern nicht wieder', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege/neu');
    await pflichtfelderFuellen(page);
    await speichernUndAnfrageLesen(page);
    const meldung = page.getByText('„Neuer Anbieter“ wurde gespeichert.');
    await expect(meldung).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Hauptmenü' })
      .getByRole('link', { name: 'Übersicht' })
      .click();
    await expect(page).toHaveURL(/\/start$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/vertraege$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Verträge');
    await expect(meldung).toHaveCount(0);
  });

  test('legt einen nicht kündbaren Vertrag an: Beginn und Laufzeitende bleiben', async ({
    page,
  }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege/neu');
    await pflichtfelderFuellen(page);
    await tab(page, 'Laufzeit');
    await page.getByLabel('Verlängerung').selectOption({ label: 'Nach Laufzeitende monatlich' });
    await page.getByLabel('Kündigungsfrist').selectOption({ label: '3 Monate' });

    await page.getByLabel('Nicht kündbar').check();
    await expect(page.getByLabel('Verlängerung')).toHaveCount(0);
    await expect(page.getByLabel('Kündigungsfrist')).toHaveCount(0);
    await page.getByLabel('Vertragsbeginn').fill('2013-01-01');

    expect(await speichernUndAnfrageLesen(page)).toMatchObject({
      kuendbar: false,
      beginn: '2013-01-01',
      verlaengerung: null,
      kuendigungsfristMonate: null,
    });
    await expect(
      page
        .getByRole('region', { name: 'Vertragsliste' })
        .getByText('Nicht kündbar', { exact: true }),
    ).toBeVisible();
  });

  test('legt einen gekündigten Vertrag an', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege/neu');
    await pflichtfelderFuellen(page);
    await tab(page, 'Laufzeit');
    await expect(page.getByLabel('Gekündigt zum')).toHaveCount(0);

    await page.getByLabel('Gekündigt', { exact: true }).check();
    await page.getByRole('button', { name: 'Vertrag speichern' }).click();
    await expect(page.getByLabel('Gekündigt zum')).toBeFocused();
    await expect(page.getByText('Bitte gib an, zu wann der Vertrag gekündigt ist.')).toBeVisible();

    await page.getByLabel('Gekündigt zum').fill('2027-06-30');
    expect((await speichernUndAnfrageLesen(page)).gekuendigtZum).toBe('2027-06-30');
    await expect(page.getByText('Gekündigt zum 30.06.2027')).toBeVisible();
  });

  test('fehlende Pflichtfelder: Hinweis, Fokus und keine Anfrage', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    let anfragen = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/vertraege') anfragen++;
    });
    await page.goto('/vertraege/neu');
    await page.getByRole('button', { name: 'Vertrag speichern' }).click();

    await expect(page.getByRole('alert')).toHaveText('Bitte prüfe die markierten Felder.');
    await expect(page.getByLabel('Anbieter *')).toBeFocused();
    await expect(page.getByLabel('Anbieter *')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Anbieter *')).toHaveAccessibleDescription(
      'Bitte gib den Anbieter ein.',
    );

    await page.getByLabel('Anbieter *').fill('A');
    await expect(page.getByLabel('Anbieter *')).toHaveAttribute('aria-invalid', 'false');
    await expect(page.getByLabel('Kategorie *')).toHaveAttribute('aria-invalid', 'true');
    expect(anfragen).toBe(0);
  });

  test.describe('Feldfehler des Backends erscheinen am Feld', () => {
    const faelle = [
      ['19,999', 'Höchstens 2 Nachkommastellen.', { wert: 19.999, waehrung: 'EUR' }],
      ['-5', 'Der Betrag muss größer als 0 sein.', { wert: -5, waehrung: 'EUR' }],
      ['0', 'Der Betrag muss größer als 0 sein.', { wert: 0, waehrung: 'EUR' }],
      ['abc', 'Bitte gib einen gültigen Betrag ein, z. B. 19,99.', null],
      ['12.50', 'Bitte gib einen gültigen Betrag ein, z. B. 19,99.', null],
    ] as const;
    for (const [eingabe, text, betrag] of faelle) {
      test(`Betrag „${eingabe}“`, async ({ page }) => {
        await backendSimulieren(page, { angemeldet: true });
        await page.goto('/vertraege/neu');
        await pflichtfelderFuellen(page);
        await page.getByLabel('Betrag in € *').fill(eingabe);

        expect((await speichernUndAnfrageLesen(page)).preise[0].betrag).toEqual(betrag);
        await expect(page.getByRole('alert')).toHaveText('Bitte prüfe die markierten Felder.');
        await expect(page.getByLabel('Betrag in € *')).toHaveAccessibleDescription(text);
        await expect(page.getByLabel('Betrag in € *')).toBeFocused();
        await expect(page).toHaveURL(/\/vertraege\/neu$/);
      });
    }

    test('Laufzeitende vor Beginn', async ({ page }) => {
      await backendSimulieren(page, { angemeldet: true });
      await page.goto('/vertraege/neu');
      await pflichtfelderFuellen(page);
      await tab(page, 'Laufzeit');
      await page.getByLabel('Vertragsbeginn').fill('2027-01-01');
      await page.getByLabel('Laufzeitende').fill('2026-01-01');
      await page.getByRole('button', { name: 'Vertrag speichern' }).click();

      await expect(page.getByLabel('Laufzeitende')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByLabel('Laufzeitende')).toHaveAccessibleDescription(
        'Das Laufzeitende liegt vor dem Vertragsbeginn.',
      );
    });
  });

  test('Serverfehler: allgemeiner Hinweis, Eingaben bleiben, erneutes Speichern klappt', async ({
    page,
  }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege/neu');
    await pflichtfelderFuellen(page);

    await page.route(
      '/api/vertraege',
      (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({
              status: 500,
              contentType: 'application/problem+json',
              json: { status: 500, code: 'INTERNER_FEHLER', detail: 'Boom in English' },
            })
          : route.fallback(),
      { times: 1 },
    );
    await page.getByRole('button', { name: 'Vertrag speichern' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Der Vertrag konnte nicht gespeichert werden. Bitte versuche es später erneut.',
    );
    await expect(page.getByText('Boom in English')).toHaveCount(0);
    await expect(page.getByLabel('Anbieter *')).toHaveValue('Neuer Anbieter');

    await page.getByRole('button', { name: 'Vertrag speichern' }).click();
    await expect(page).toHaveURL(/\/vertraege$/);
  });

  test('Kategorien nicht ladbar: Hinweis und erneuter Versuch', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.route('/api/vertraege/kategorien', (route) => route.abort(), { times: 1 });
    await page.goto('/vertraege/neu');

    await expect(page.getByRole('alert')).toHaveText(
      'Die Kategorien konnten nicht geladen werden.',
    );
    await expect(page.getByLabel('Anbieter *')).toHaveCount(0);
    await page.getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect(page.getByLabel('Kategorie *')).toBeVisible();
  });

  test.describe('Vorschau des Kündigungstermins', () => {
    const zeile = (page: Page) =>
      page.getByRole('status').filter({ hasText: 'Nächster Kündigungstermin:' });
    const VORSCHAU = '**/api/vertraege/vorschau';

    test.beforeEach(async ({ page }) => {
      await backendSimulieren(page, { angemeldet: true });
    });

    test('startet ohne Termin und folgt den Eingaben', async ({ page }) => {
      await page.goto('/vertraege/neu');
      await tab(page, 'Laufzeit');
      await expect(zeile(page)).toContainText('Kein Termin bekannt');
      await page.getByLabel('Laufzeitende').fill('2027-12-31');
      await expect(zeile(page)).toContainText('Kündbar bis 31.12.2027');
      await page
        .getByLabel('Verlängerung')
        .selectOption({ label: 'Keine – Vertrag endet zum Laufzeitende' });
      await expect(zeile(page)).toContainText('Endet am 31.12.2027. Verlängert sich nicht');
    });

    test('fragt je Pause einmal und nicht bei Feldern ohne Einfluss', async ({ page }) => {
      await page.goto('/vertraege/neu');
      await tab(page, 'Laufzeit');
      await expect(zeile(page)).toContainText('Kein Termin bekannt');
      let anfragen = 0;
      page.on('request', (r) => {
        anfragen += new URL(r.url()).pathname.endsWith('/vorschau') ? 1 : 0;
      });
      await tab(page, 'Allgemein');
      await page.getByLabel('Anbieter *').pressSequentially('Tippt lange', { delay: 10 });
      await tab(page, 'Laufzeit');
      await page.getByLabel('Laufzeitende').fill('2027-12-31');
      await page.getByLabel('Laufzeitende').fill('2028-12-31');
      await expect(zeile(page)).toContainText('31.12.2028');
      expect(anfragen).toBe(1);
    });

    test('„Nicht kündbar“ blendet die Zeile aus', async ({ page }) => {
      await page.goto('/vertraege/neu');
      await tab(page, 'Laufzeit');
      await expect(zeile(page)).toBeVisible();
      await page.getByLabel('Nicht kündbar').check();
      await expect(zeile(page)).toHaveCount(0);
      await page.getByLabel('Nicht kündbar').uncheck();
      await expect(zeile(page)).toContainText('Kein Termin bekannt');
    });

    for (const [name, status, json] of [
      ['400', 400, { code: 'VALIDIERUNG', felder: [] }],
      ['500', 500, {}],
    ] as const) {
      test(`${name}: „–“ ohne Fehlerbox, Speichern bleibt möglich`, async ({ page }) => {
        await page.route(VORSCHAU, (route) =>
          route.fulfill({ status, contentType: 'application/problem+json', json }),
        );
        await page.goto('/vertraege/neu');
        await tab(page, 'Laufzeit');
        await expect(zeile(page)).toHaveText(/Nächster Kündigungstermin:\s*–/);
        await expect(page.getByRole('alert')).toHaveCount(0);
        await pflichtfelderFuellen(page);
        await speichernUndAnfrageLesen(page);
        await expect(page).toHaveURL(/\/vertraege$/);
      });
    }

    test('401: Es geht zum Login, wie bei jeder anderen Anfrage', async ({ page }) => {
      await page.goto('/vertraege/neu');
      await tab(page, 'Laufzeit');
      await expect(zeile(page)).toBeVisible();
      await page.route(VORSCHAU, (route) =>
        route.fulfill({ status: 401, contentType: 'application/problem+json', json: {} }),
      );
      await page.getByLabel('Laufzeitende').fill('2027-12-31');
      await expect(page).toHaveURL(/\/login\?returnUrl=/);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  });

  test('Preise: ohne Vertragsbeginn braucht „Betrag gilt seit“ ein Datum, danach geht alles mit', async ({
    page,
  }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege/neu');
    await pflichtfelderFuellen(page);
    await tab(page, 'Preise');
    await page.getByRole('button', { name: 'Preis hinzufügen' }).click();
    const zeile = page.locator('.preis');
    await zeile.getByLabel('Gilt ab *').fill('2027-06-01');
    await zeile.getByLabel('Betrag in € *').fill('24,99');
    await page.getByRole('button', { name: 'Vertrag speichern' }).click();

    await expect(page.getByRole('tab', { name: /^Kosten.*1 Fehler$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByLabel('Betrag gilt seit')).toBeFocused();
    await expect(page.getByLabel('Betrag gilt seit')).toHaveAccessibleDescription(
      /^Bitte gib an, seit wann der Betrag oben gilt\./,
    );
    await page.getByLabel('Betrag gilt seit').fill('2026-01-01');
    expect((await speichernUndAnfrageLesen(page)).preise).toEqual([
      { gueltigAb: '2026-01-01', betrag: { wert: 19.99, waehrung: 'EUR' } },
      { gueltigAb: '2027-06-01', betrag: { wert: 24.99, waehrung: 'EUR' } },
    ]);
  });

  test.describe('Tabs und Zusammenfassung', () => {
    test.beforeEach(async ({ page }) => {
      await backendSimulieren(page, { angemeldet: true });
      await page.goto('/vertraege/neu');
    });

    test('nennt, wo die Pflichtfelder stehen; Pfeiltasten wechseln den Tab', async ({ page }) => {
      await expect(
        page.getByText('Pflichtfelder (*) findest du unter „Allgemein“ und „Kosten“.'),
      ).toBeVisible();
      const tabs = page.getByRole('tablist', { name: 'Bereiche des Vertrags' }).getByRole('tab');
      await expect(tabs).toHaveText(['Allgemein', 'Kosten', 'Laufzeit', 'Preise']);
      await expect(page.getByLabel('Betrag in € *')).toBeHidden();

      await tabs.first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(tabs.nth(1)).toBeFocused();
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByLabel('Betrag in € *')).toBeVisible();
      await expect(page.getByLabel('Anbieter *')).toBeHidden();
    });

    test('zählt Fehler je Tab und springt zum ersten Tab mit Fehler', async ({ page }) => {
      await tab(page, 'Laufzeit');
      await page.getByRole('button', { name: 'Vertrag speichern' }).click();
      await expect(page.getByRole('tab', { name: /^Allgemein.*2 Fehler$/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(page.getByRole('tab', { name: /^Kosten.*3 Fehler$/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Laufzeit', exact: true })).toBeVisible();
      await expect(page.getByLabel('Anbieter *')).toBeFocused();

      await page.getByLabel('Anbieter *').fill('A');
      await page.getByLabel('Kategorie *').selectOption({ label: 'Versicherung' });
      await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Vertrag speichern' }).click();
      await expect(page.getByRole('tab', { name: /^Kosten.*3 Fehler$/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(page.getByLabel('Betrag in € *')).toBeFocused();
    });

    test('die Zusammenfassung folgt den Eingaben', async ({ page }) => {
      const zusammenfassung = page.getByRole('complementary', { name: 'Zusammenfassung' });
      await expect(zusammenfassung).toContainText('Neuer Vertrag');
      await expect(zusammenfassung).toContainText('Noch keine Angaben');
      await expect(zusammenfassung).toContainText('BetragNoch offen');

      await pflichtfelderFuellen(page, 'Musterversicherung AG');
      await expect(zusammenfassung).toContainText('Musterversicherung AG');
      await expect(zusammenfassung).toContainText('Versicherung');
      await expect(zusammenfassung).toContainText('Betrag19,99 € monatlich');
      await expect(zusammenfassung).toContainText('KündigungKein Termin bekannt');

      const formular = (await page.locator('form').boundingBox())!;
      expect((await zusammenfassung.boundingBox())!.x).toBeGreaterThan(formular.x + formular.width);
    });

    test('bis 900 px ohne Zusammenfassung', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByLabel('Anbieter *')).toBeVisible();
      await expect(page.getByRole('complementary', { name: 'Zusammenfassung' })).toBeHidden();
    });
  });

  test('ohne gebuchte Komponente führt die Route zur Startseite', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, komponenten: ['PORTFOLIO'] });
    await page.goto('/vertraege/neu');
    await expect(page).toHaveURL(/\/start$/);
  });

  test('passt auf ein schmales Display ohne seitliches Scrollen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege/neu');
    await expect(page.getByLabel('Anbieter *')).toBeVisible();
    const breite = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(breite).toBeLessThanOrEqual(320);
  });
});
