import { Page, Route } from '@playwright/test';
import {
  Betrag,
  Kuendigung,
  VertragAenderung,
  VertragAnfrage,
  VertragAntwort,
  VertragKategorieAntwort,
  VertragsuebersichtAntwort,
  VertragVorschauAnfrage,
} from '../src/app/core/api/api';

export const KATEGORIEN: VertragKategorieAntwort[] = (
  [
    'STREAMING_ABOS',
    'SOFTWARE_APPS',
    'VERSICHERUNG',
    'MOBILFUNK_INTERNET',
    'MITGLIEDSCHAFTEN',
    'GEBUEHREN_BEITRAEGE',
    'SONSTIGES',
  ] as const
).map((schluessel, i) => ({ id: `kategorie-${i}`, schluessel, name: null }));

const KEINE_KUENDIGUNG: Kuendigung = {
  art: 'KEINE_LAUFZEIT',
  dringend: false,
  fristMonate: null,
  kuendigenBis: null,
  zum: null,
};

function kategorie(schluessel: string): VertragKategorieAntwort {
  return KATEGORIEN.find((k) => k.schluessel === schluessel)!;
}

function betrag(wert: number): Betrag {
  return { wert, waehrung: 'EUR' };
}

const VERTRAG_LEER = {
  bezeichnung: null,
  vertragsnummer: null,
  zahlungsweg: null,
  beginn: null,
  laufzeitende: null,
  verlaengerung: null,
  kuendigungsfristMonate: null,
  gekuendigtZum: null,
  notiz: null,
  kuendbar: true,
  version: 0,
} as const;

/** Je eine Kündigungsart; `berechnet` steht fest wie vom Backend geliefert. */
export const BEISPIEL_VERTRAEGE: VertragAntwort[] = [
  {
    ...VERTRAG_LEER,
    id: 'kfz',
    anbieter: 'Musterversicherung AG',
    bezeichnung: 'Kfz-Versicherung',
    kategorie: kategorie('VERSICHERUNG'),
    vertragsnummer: 'KFZ-4711-23',
    betrag: betrag(586.8),
    zahlweise: 'JAEHRLICH',
    abbuchungAb: '2024-01-01',
    zahlungsweg: 'LASTSCHRIFT',
    beginn: '2023-01-01',
    laufzeitende: '2023-12-31',
    verlaengerung: 'ZWOELF_MONATE',
    kuendigungsfristMonate: 1,
    berechnet: {
      status: 'AKTIV',
      kostenProMonat: betrag(48.9),
      kostenProJahr: betrag(586.8),
      naechsteAbbuchung: '2027-01-01',
      kuendigung: {
        art: 'KUENDIGEN_BIS',
        dringend: true,
        fristMonate: 1,
        kuendigenBis: '2026-11-30',
        zum: '2026-12-31',
      },
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'fitness',
    anbieter: 'Fitnessstudio am Park',
    kategorie: kategorie('MITGLIEDSCHAFTEN'),
    betrag: betrag(34.9),
    zahlweise: 'MONATLICH',
    abbuchungAb: '2025-05-01',
    verlaengerung: 'ZAHLUNGSINTERVALL',
    kuendigungsfristMonate: 3,
    berechnet: {
      status: 'AKTIV',
      kostenProMonat: betrag(34.9),
      kostenProJahr: betrag(418.8),
      naechsteAbbuchung: '2026-12-01',
      kuendigung: {
        art: 'MONATLICH_KUENDBAR',
        dringend: false,
        fristMonate: 3,
        kuendigenBis: '2026-11-30',
        zum: '2027-02-28',
      },
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'rundfunk',
    anbieter: 'ARD ZDF Deutschlandradio Beitragsservice',
    bezeichnung: 'Rundfunkbeitrag',
    kategorie: kategorie('GEBUEHREN_BEITRAEGE'),
    betrag: betrag(55.08),
    zahlweise: 'VIERTELJAEHRLICH',
    abbuchungAb: '2013-01-15',
    kuendbar: false,
    berechnet: {
      status: 'AKTIV',
      kostenProMonat: betrag(18.36),
      kostenProJahr: betrag(220.32),
      naechsteAbbuchung: '2027-01-15',
      kuendigung: { ...KEINE_KUENDIGUNG, art: 'NICHT_KUENDBAR' },
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'kurs',
    anbieter: 'Sprachschule',
    kategorie: kategorie('SONSTIGES'),
    betrag: betrag(60),
    zahlweise: 'HALBJAEHRLICH',
    abbuchungAb: '2026-07-01',
    laufzeitende: '2027-06-30',
    verlaengerung: 'KEINE',
    berechnet: {
      status: 'AKTIV',
      kostenProMonat: betrag(10),
      kostenProJahr: betrag(120),
      naechsteAbbuchung: '2027-01-01',
      kuendigung: { ...KEINE_KUENDIGUNG, art: 'ENDET', zum: '2027-06-30' },
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'app',
    anbieter: 'Software GmbH',
    kategorie: kategorie('SOFTWARE_APPS'),
    betrag: betrag(5),
    zahlweise: 'MONATLICH',
    abbuchungAb: '2026-01-05',
    berechnet: {
      status: 'AKTIV',
      kostenProMonat: betrag(5),
      kostenProJahr: betrag(60),
      naechsteAbbuchung: '2026-12-05',
      kuendigung: KEINE_KUENDIGUNG,
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'abo',
    anbieter: 'Musterverlag',
    bezeichnung: 'Zeitschriften-Abo',
    kategorie: kategorie('STREAMING_ABOS'),
    betrag: betrag(9.9),
    zahlweise: 'MONATLICH',
    abbuchungAb: '2024-01-05',
    zahlungsweg: 'PAYPAL',
    verlaengerung: 'ZAHLUNGSINTERVALL',
    kuendigungsfristMonate: 1,
    gekuendigtZum: '2026-12-31',
    notiz: 'Kündigung am 20.10.2026 bestätigt',
    berechnet: {
      status: 'GEKUENDIGT',
      kostenProMonat: betrag(9.9),
      kostenProJahr: betrag(118.8),
      naechsteAbbuchung: '2026-12-05',
      kuendigung: { ...KEINE_KUENDIGUNG, art: 'GEKUENDIGT', fristMonate: 1, zum: '2026-12-31' },
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'alt',
    anbieter: 'Mobilfunk GmbH',
    kategorie: kategorie('MOBILFUNK_INTERNET'),
    betrag: betrag(19.99),
    zahlweise: 'MONATLICH',
    abbuchungAb: '2024-01-15',
    gekuendigtZum: '2026-06-30',
    berechnet: {
      status: 'BEENDET',
      kostenProMonat: betrag(19.99),
      kostenProJahr: betrag(239.88),
      naechsteAbbuchung: null,
      kuendigung: { ...KEINE_KUENDIGUNG, art: 'BEENDET' },
    },
  },
];

function summeJeWaehrung(betraege: Betrag[]): Betrag[] {
  const summen = new Map<string, number>();
  for (const { wert, waehrung } of betraege) {
    summen.set(waehrung, (summen.get(waehrung) ?? 0) + wert);
  }
  return [...summen].map(([waehrung, wert]) => ({ waehrung, wert: Math.round(wert * 100) / 100 }));
}

function uebersicht(vertraege: VertragAntwort[]): VertragsuebersichtAntwort {
  const laufend = vertraege.filter((v) => v.berechnet.status !== 'BEENDET');
  return {
    laufendeVertraege: laufend.length,
    kostenProMonat: summeJeWaehrung(laufend.map((v) => v.berechnet.kostenProMonat)),
    kostenProJahr: summeJeWaehrung(laufend.map((v) => v.berechnet.kostenProJahr)),
    naechsteKuendigungsfristen: laufend
      .flatMap(({ id, anbieter, bezeichnung, betrag, zahlweise, berechnet }) => {
        const { art, kuendigenBis, zum, dringend } = berechnet.kuendigung;
        return art === 'KUENDIGEN_BIS' && kuendigenBis && zum
          ? [{ id, anbieter, bezeichnung, betrag, zahlweise, kuendigenBis, zum, dringend }]
          : [];
      })
      .slice(0, 5),
  };
}

/** Grob wie das Backend; genau genug, damit sich die Vorschau im Test ändert. */
function vorschau(anfrage: VertragVorschauAnfrage): Kuendigung {
  const fristMonate = anfrage.kuendigungsfristMonate ?? null;
  if (anfrage.gekuendigtZum) {
    return { ...KEINE_KUENDIGUNG, art: 'GEKUENDIGT', fristMonate, zum: anfrage.gekuendigtZum };
  }
  if (!anfrage.kuendbar) {
    return { ...KEINE_KUENDIGUNG, art: 'NICHT_KUENDBAR' };
  }
  if (!anfrage.laufzeitende) {
    return { ...KEINE_KUENDIGUNG, fristMonate };
  }
  return anfrage.verlaengerung === 'KEINE'
    ? { ...KEINE_KUENDIGUNG, art: 'ENDET', fristMonate, zum: anfrage.laufzeitende }
    : {
        art: 'KUENDIGEN_BIS',
        dringend: false,
        fristMonate,
        kuendigenBis: anfrage.laufzeitende,
        zum: anfrage.laufzeitende,
      };
}

const MONATE_JE_ZAHLUNG = { MONATLICH: 1, VIERTELJAEHRLICH: 3, HALBJAEHRLICH: 6, JAEHRLICH: 12 };

function ausAnfrage(
  anfrage: VertragAnfrage | VertragAenderung,
  id: string,
  version: number,
): VertragAntwort {
  const { kategorieId, ...felder } = anfrage;
  const { wert, waehrung } = anfrage.betrag;
  const proJahr = Math.round((wert * 1200) / MONATE_JE_ZAHLUNG[anfrage.zahlweise]) / 100;
  return {
    ...VERTRAG_LEER,
    ...felder,
    id,
    version,
    kategorie: KATEGORIEN.find((k) => k.id === kategorieId) ?? KATEGORIEN[0],
    berechnet: {
      status: anfrage.gekuendigtZum ? 'GEKUENDIGT' : 'AKTIV',
      kostenProMonat: { wert: Math.round((proJahr * 100) / 12) / 100, waehrung },
      kostenProJahr: { wert: proJahr, waehrung },
      naechsteAbbuchung: anfrage.abbuchungAb,
      kuendigung: vorschau(anfrage),
    },
  };
}

type FehlerAntwort = (route: Route, status: number, code: string, detail: string) => Promise<void>;

/** Endpunkte unter /api/vertraege; Anlegen, Ändern und Löschen ändern den Stand im Test. */
export async function vertraegeSimulieren(
  page: Page,
  start: VertragAntwort[],
  problem: FehlerAntwort,
  zugriff: () => 'ok' | 'abgemeldet' | 'nicht-gebucht',
) {
  let vertraege = structuredClone(start);
  let naechsteId = 1;

  await page.route(/\/api\/vertraege(\/[^?]*)?(\?.*)?$/, (route) => {
    const stand = zugriff();
    if (stand === 'abgemeldet') {
      return problem(route, 401, 'NICHT_ANGEMELDET', 'Authentication required.');
    }
    if (stand === 'nicht-gebucht') {
      return problem(route, 403, 'KEIN_ZUGRIFF', 'Access denied.');
    }

    const anfrage = route.request();
    const url = new URL(anfrage.url());
    const pfad = url.pathname.replace('/api/vertraege', '').replace('/', '');

    if (pfad === 'kategorien') {
      return route.fulfill({ json: KATEGORIEN });
    }
    if (pfad === 'uebersicht') {
      return route.fulfill({ json: uebersicht(vertraege) });
    }
    if (pfad === 'vorschau') {
      return route.fulfill({ json: { kuendigung: vorschau(anfrage.postDataJSON()) } });
    }
    if (!pfad && anfrage.method() === 'POST') {
      const id = `neu-${naechsteId++}`;
      const neu = ausAnfrage(anfrage.postDataJSON(), id, 0);
      vertraege = [...vertraege, neu];
      return route.fulfill({
        status: 201,
        headers: { Location: `${url.origin}/api/vertraege/${id}` },
        json: neu,
      });
    }
    if (!pfad) {
      return route.fulfill({ json: vertraege });
    }

    const vorhanden = vertraege.find((v) => v.id === pfad);
    if (!vorhanden) {
      return problem(route, 404, 'NICHT_GEFUNDEN', `Contract ${pfad} not found.`);
    }
    if (anfrage.method() === 'GET') {
      return route.fulfill({ json: vorhanden });
    }

    const aenderung: VertragAenderung | null =
      anfrage.method() === 'PUT' ? anfrage.postDataJSON() : null;
    const version = aenderung?.version ?? Number(url.searchParams.get('version'));
    if (version !== vorhanden.version) {
      return problem(route, 409, 'KONFLIKT', 'Contract was changed in the meantime.');
    }
    if (aenderung) {
      const geaendert = ausAnfrage(aenderung, pfad, version + 1);
      vertraege = vertraege.map((v) => (v.id === pfad ? geaendert : v));
      return route.fulfill({ json: geaendert });
    }
    vertraege = vertraege.filter((v) => v.id !== pfad);
    return route.fulfill({ status: 204 });
  });
}
