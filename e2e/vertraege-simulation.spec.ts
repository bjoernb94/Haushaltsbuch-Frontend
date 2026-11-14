import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, BEISPIEL_VERTRAEGE, KATEGORIEN } from './backend-mock';

/** Noch ohne Seite: Die Anfragen laufen direkt im Browser, damit die Simulation sie abfängt. */
function api(page: Page, methode: string, pfad: string, body?: unknown) {
  return page.evaluate(
    async ({ methode, pfad, body }) => {
      const antwort = await fetch(`/api/vertraege${pfad}`, {
        method: methode,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await antwort.text();
      return {
        status: antwort.status,
        location: antwort.headers.get('Location'),
        json: text ? JSON.parse(text) : null,
      };
    },
    { methode, pfad, body },
  );
}

const ANFRAGE = {
  anbieter: 'Neuer Anbieter',
  kategorieId: KATEGORIEN[0].id,
  preise: [{ gueltigAb: null, betrag: { wert: 120, waehrung: 'EUR' } }],
  einmalkosten: [],
  erinnerungSonderkuendigung: true,
  zahlweise: 'JAEHRLICH',
  abbuchungAb: '2027-01-01',
  kuendbar: true,
};

test.describe('Simulation der Verträge', () => {
  test.beforeEach(async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/login');
  });

  test('liefert Liste, Vertrag, Kategorien und Übersicht', async ({ page }) => {
    expect((await api(page, 'GET', '')).json).toHaveLength(BEISPIEL_VERTRAEGE.length);
    expect((await api(page, 'GET', '/kfz')).json.anbieter).toBe('Musterversicherung AG');
    expect((await api(page, 'GET', '/gibts-nicht')).json.code).toBe('NICHT_GEFUNDEN');
    expect((await api(page, 'GET', '/kategorien')).json).toEqual(KATEGORIEN);

    const uebersicht = (await api(page, 'GET', '/uebersicht')).json;
    expect(uebersicht.laufendeVertraege).toBe(6);
    // „Software GmbH“ zählt nur zur Hälfte.
    expect(uebersicht.kostenProMonat).toEqual([{ wert: 124.56, waehrung: 'EUR' }]);
    expect(uebersicht.hatAnteile).toBe(true);
    expect(uebersicht.naechsteKuendigungsfristen).toHaveLength(1);
  });

  test('deckt jede Kündigungsart ab', () => {
    expect(new Set(BEISPIEL_VERTRAEGE.map((v) => v.berechnet.kuendigung.art))).toEqual(
      new Set([
        'KUENDIGEN_BIS',
        'MONATLICH_KUENDBAR',
        'ENDET',
        'KEINE_LAUFZEIT',
        'NICHT_KUENDBAR',
        'GEKUENDIGT',
        'BEENDET',
      ]),
    );
  });

  test('Anlegen, Ändern und Löschen ändern den Stand', async ({ page }) => {
    const angelegt = await api(page, 'POST', '', ANFRAGE);
    expect(angelegt.status).toBe(201);
    const { id, version, berechnet } = angelegt.json;
    expect(angelegt.location).toMatch(new RegExp(`^http.*/api/vertraege/${id}$`));
    expect(berechnet.kostenProMonat).toEqual({ wert: 10, waehrung: 'EUR' });
    expect((await api(page, 'GET', '')).json).toHaveLength(BEISPIEL_VERTRAEGE.length + 1);

    const geaendert = await api(page, 'PUT', `/${id}`, { ...ANFRAGE, anbieter: 'Neu', version });
    expect(geaendert.json.anbieter).toBe('Neu');
    expect(geaendert.json.version).toBe(version + 1);

    expect((await api(page, 'DELETE', `/${id}?version=${version + 1}`)).status).toBe(204);
    expect((await api(page, 'GET', `/${id}`)).status).toBe(404);
  });

  test('alte Version führt zu 409', async ({ page }) => {
    const aendern = await api(page, 'PUT', '/kfz', { ...ANFRAGE, version: 99 });
    expect(aendern.status).toBe(409);
    expect(aendern.json.code).toBe('KONFLIKT');
    expect((await api(page, 'DELETE', '/kfz?version=99')).status).toBe(409);
  });

  test('Vorschau folgt den Formularwerten', async ({ page }) => {
    const art = async (anfrage: object) =>
      (await api(page, 'POST', '/vorschau', anfrage)).json.kuendigung.art;
    expect(await art({ kuendbar: false })).toBe('NICHT_KUENDBAR');
    expect(await art({ kuendbar: true })).toBe('KEINE_LAUFZEIT');
    expect(await art({ kuendbar: true, laufzeitende: '2027-06-30', verlaengerung: 'KEINE' })).toBe(
      'ENDET',
    );
    expect(await art({ kuendbar: true, gekuendigtZum: '2026-12-31' })).toBe('GEKUENDIGT');
  });
});

test('ohne gebuchte Komponente antwortet die Simulation mit 403', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true, komponenten: ['PORTFOLIO'] });
  await page.goto('/login');
  const antwort = await api(page, 'GET', '/uebersicht');
  expect(antwort.status).toBe(403);
  expect(antwort.json.code).toBe('KEIN_ZUGRIFF');
});
