import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, BEISPIEL_VERTRAEGE } from './backend-mock';

async function pflichtfelderFuellen(page: Page, anbieter = 'Neuer Anbieter') {
  await page.getByLabel('Anbieter *').fill(anbieter);
  await page.getByLabel('Kategorie *').selectOption({ label: 'Versicherung' });
  await page.getByLabel('Betrag in € *').fill('19,99');
  await page.getByLabel('Zahlweise *').selectOption({ label: 'monatlich' });
  await page.getByLabel('Nächste Abbuchung *').fill('2027-01-01');
}

async function speichernUndAnfrageLesen(page: Page) {
  const anfrage = page.waitForRequest(
    (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/vertraege',
  );
  await page.getByRole('button', { name: 'Vertrag speichern' }).click();
  return (await anfrage).postDataJSON();
}

test.describe('Neuer Vertrag', () => {
  test('„Neuer Vertrag“ in der Liste führt zum Formular, der Bereich bleibt markiert', async ({
    page,
  }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege');
    await expect(
      page.getByText('Lege mit „Neuer Vertrag“ deinen ersten Vertrag an.'),
    ).toBeVisible();

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
    await page.getByLabel('Bezeichnung').fill('Mein Vertrag');
    await page.getByLabel('Vertrags- oder Kundennummer').fill('V-1');
    await page.getByLabel('Zahlungsweg').selectOption({ label: 'PayPal' });
    await page.getByLabel('Vertragsbeginn').fill('2026-01-01');
    await page.getByLabel('Laufzeitende').fill('2027-12-31');
    await page.getByLabel('Verlängerung').selectOption({ label: 'Nach Laufzeitende um 12 Monate' });
    await page.getByLabel('Kündigungsfrist').selectOption({ label: '3 Monate' });
    await page.getByLabel('Notiz').fill('Familien-Abo');

    expect(await speichernUndAnfrageLesen(page)).toEqual({
      anbieter: 'Neuer Anbieter',
      bezeichnung: 'Mein Vertrag',
      kategorieId: 'kategorie-2',
      vertragsnummer: 'V-1',
      betrag: { wert: 19.99, waehrung: 'EUR' },
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
    });

    await expect(page).toHaveURL(/\/vertraege$/);
    await expect(
      page.getByRole('status').getByText('„Mein Vertrag“ wurde gespeichert.'),
    ).toBeVisible();
    await expect(page.getByText('Laufende Verträge7')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Vertragsliste' }).getByText('Mein Vertrag'),
    ).toBeVisible();
  });

  test('zeigt die Erfolgsmeldung im sichtbaren Bereich, auch vom Ende des Formulars aus', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege/neu');
    await pflichtfelderFuellen(page);
    await speichernUndAnfrageLesen(page);
    await expect(page.getByText('„Neuer Anbieter“ wurde gespeichert.')).toBeInViewport();
  });

  test('die Meldung erscheint beim Zurückblättern nicht wieder', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege/neu');
    await pflichtfelderFuellen(page);
    await speichernUndAnfrageLesen(page);
    const meldung = page.getByText('„Neuer Anbieter“ wurde gespeichert.');
    await expect(meldung).toBeVisible();

    await page.getByRole('link', { name: 'Zur Übersicht' }).click();
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
    await expect(page.getByText('Nicht kündbar', { exact: true })).toBeVisible();
  });

  test('legt einen gekündigten Vertrag an', async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true });
    await page.goto('/vertraege/neu');
    await pflichtfelderFuellen(page);
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

        expect((await speichernUndAnfrageLesen(page)).betrag).toEqual(betrag);
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
