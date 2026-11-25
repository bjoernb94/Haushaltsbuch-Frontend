import { Page, Route } from '@playwright/test';
import {
  Betrag,
  Feldfehler,
  Kuendigung,
  Preispunkt,
  Prognosepreis,
  VertragAenderung,
  VertragAnfrage,
  VertragAntwort,
  VertragKategorieAntwort,
  VertragPreisAntwort,
  VertragsuebersichtAntwort,
  VertragVorschauAnfrage,
  VertragVorschauAntwort,
  VertragWiederaufnahme,
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
  betragErrechnet: false,
  // Wie zuletzt heute gespeichert: Keine Stufe ist seitdem fällig geworden (ADR 0022).
  preissteigerungBetrachtetBis: new Date().toISOString().slice(0, 10) as string | null,
  bezeichnung: null,
  vertragsnummer: null,
  zahlungsweg: null,
  laufzeitende: null,
  verlaengerung: null,
  kuendigungsfristMonate: null,
  gekuendigtZum: null,
  notiz: null,
  kuendbar: true,
  version: 0,
  anteilProzent: null,
  einmalkosten: [] as VertragAntwort['einmalkosten'],
  preissteigerung: null,
  preisgarantieBis: null,
  erinnerungSonderkuendigung: true,
} as const;

/** Ein Preis seit Vertragsbeginn, wie bei den meisten Verträgen. */
function einPreis(wert: number, beginn: string): VertragPreisAntwort[] {
  return [{ gueltigAb: beginn, betrag: betrag(wert), art: 'AKTUELL', automatisch: false }];
}

const BERECHNET_LEER: Pick<
  VertragAntwort['berechnet'],
  | 'kostenImJahrMitPrognose'
  | 'jahr'
  | 'eigenerAnteil'
  | 'naechstePreisaenderung'
  | 'preisverlauf'
  | 'prognose'
  | 'vertragsende'
> = {
  kostenImJahrMitPrognose: false,
  jahr: 2026,
  eigenerAnteil: null,
  naechstePreisaenderung: null,
  preisverlauf: [],
  prognose: [],
  vertragsende: null,
};

/** Ohne Unterbrechung: `aktuellerBeginn` ist der Beginn, keine Unterbrechungen, keine Wiederaufnahme. */
type BeispielVertrag = Omit<VertragAntwort, 'berechnet' | 'unterbrechungen'> & {
  berechnet: Omit<VertragAntwort['berechnet'], 'aktuellerBeginn' | 'wiederaufnahme'> &
    Partial<Pick<VertragAntwort['berechnet'], 'wiederaufnahme'>>;
};

/** Je eine Kündigungsart und jeder Status; `berechnet` steht fest wie vom Backend geliefert. */
const BEISPIELE: BeispielVertrag[] = [
  {
    ...VERTRAG_LEER,
    id: 'kfz',
    anbieter: 'Musterversicherung AG',
    bezeichnung: 'Kfz-Versicherung',
    kategorie: kategorie('VERSICHERUNG'),
    vertragsnummer: 'KFZ-4711-23',
    betrag: betrag(586.8),
    preise: einPreis(586.8, '2023-01-01'),
    zahlweise: 'JAEHRLICH',
    zahlungsweg: 'LASTSCHRIFT',
    beginn: '2023-01-01',
    laufzeitende: '2023-12-31',
    verlaengerung: 'ZWOELF_MONATE',
    kuendigungsfristMonate: 1,
    berechnet: {
      ...BERECHNET_LEER,
      einmalkosten: betrag(0),
      status: 'AKTIV',
      kostenProMonat: betrag(48.9),
      kostenImJahr: betrag(586.8),
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
    preise: [
      { gueltigAb: '2025-05-01', betrag: betrag(29.9), art: 'FRUEHER', automatisch: false },
      { gueltigAb: '2026-01-01', betrag: betrag(34.9), art: 'AKTUELL', automatisch: false },
      { gueltigAb: '2027-03-01', betrag: betrag(39.9), art: 'ANGEKUENDIGT', automatisch: false },
    ],
    zahlweise: 'MONATLICH',
    beginn: '2025-05-01',
    verlaengerung: 'ZAHLUNGSINTERVALL',
    kuendigungsfristMonate: 3,
    berechnet: {
      ...BERECHNET_LEER,
      einmalkosten: betrag(0),
      status: 'AKTIV',
      naechstePreisaenderung: { ab: '2027-03-01', betrag: betrag(39.9), art: 'ANGEKUENDIGT' },
      kostenProMonat: betrag(34.9),
      kostenImJahr: betrag(418.8),
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
    preise: einPreis(55.08, '2013-01-15'),
    zahlweise: 'VIERTELJAEHRLICH',
    beginn: '2013-01-15',
    kuendbar: false,
    berechnet: {
      ...BERECHNET_LEER,
      einmalkosten: betrag(0),
      status: 'AKTIV',
      kostenProMonat: betrag(18.36),
      kostenImJahr: betrag(220.32),
      kuendigung: { ...KEINE_KUENDIGUNG, art: 'NICHT_KUENDBAR' },
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'kurs',
    anbieter: 'Sprachschule',
    kategorie: kategorie('SONSTIGES'),
    betrag: betrag(60),
    preise: einPreis(60, '2026-07-01'),
    zahlweise: 'HALBJAEHRLICH',
    beginn: '2026-07-01',
    laufzeitende: '2027-06-30',
    verlaengerung: 'KEINE',
    berechnet: {
      ...BERECHNET_LEER,
      einmalkosten: betrag(0),
      status: 'AKTIV',
      kostenProMonat: betrag(10),
      kostenImJahr: betrag(120),
      kuendigung: { ...KEINE_KUENDIGUNG, art: 'ENDET', zum: '2027-06-30' },
      vertragsende: '2027-06-30',
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'glasfaser',
    anbieter: 'Glasfaser Nord',
    bezeichnung: 'Internet',
    kategorie: kategorie('MOBILFUNK_INTERNET'),
    betrag: betrag(39.99),
    preise: einPreis(39.99, '2027-01-01'),
    zahlweise: 'MONATLICH',
    beginn: '2027-01-01',
    laufzeitende: '2028-12-31',
    verlaengerung: 'ZAHLUNGSINTERVALL',
    kuendigungsfristMonate: 1,
    berechnet: {
      ...BERECHNET_LEER,
      einmalkosten: betrag(0),
      status: 'NICHT_BEGONNEN',
      kostenProMonat: betrag(39.99),
      kostenImJahr: betrag(0),
      kuendigung: {
        art: 'KUENDIGEN_BIS',
        dringend: false,
        fristMonate: 1,
        kuendigenBis: '2028-11-30',
        zum: '2028-12-31',
      },
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'storniert',
    anbieter: 'Streamingdienst',
    kategorie: kategorie('STREAMING_ABOS'),
    betrag: betrag(12.99),
    preise: einPreis(12.99, '2026-12-01'),
    zahlweise: 'MONATLICH',
    beginn: '2026-12-01',
    gekuendigtZum: '2026-11-30',
    berechnet: {
      ...BERECHNET_LEER,
      einmalkosten: betrag(0),
      status: 'STORNIERT',
      kostenProMonat: betrag(12.99),
      kostenImJahr: betrag(0),
      kuendigung: { ...KEINE_KUENDIGUNG, art: 'STORNIERT' },
      vertragsende: '2026-11-30',
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'app',
    anbieter: 'Software GmbH',
    kategorie: kategorie('SOFTWARE_APPS'),
    betrag: betrag(5),
    preise: einPreis(5, '2025-11-15'),
    anteilProzent: 50,
    preissteigerung: {
      art: 'BETRAG',
      prozent: null,
      betrag: betrag(1),
      rhythmus: 'JAEHRLICH',
      naechsteAm: '2025-01-01',
    },
    einmalkosten: [
      { bezeichnung: 'Lizenzschlüssel', betrag: betrag(20), faelligAm: '2025-12-15' },
      { bezeichnung: 'Einrichtung', betrag: betrag(30), faelligAm: '2026-02-01' },
    ],
    zahlweise: 'MONATLICH',
    beginn: '2025-11-15',
    berechnet: {
      ...BERECHNET_LEER,
      eigenerAnteil: { betrag: betrag(2.5), kostenProMonat: betrag(2.5), kostenImJahr: betrag(30) },
      einmalkosten: betrag(50),
      naechstePreisaenderung: { ab: '2027-01-01', betrag: betrag(6), art: 'PROGNOSE' },
      prognose: [
        { ab: '2027-01-01', betrag: betrag(6) },
        { ab: '2028-01-01', betrag: betrag(7) },
        { ab: '2029-01-01', betrag: betrag(8) },
      ],
      preisverlauf: [
        { ab: '2025-11-15', betrag: betrag(5), art: 'GEZAHLT' },
        { ab: '2027-01-01', betrag: betrag(6), art: 'PROGNOSE' },
        { ab: '2028-01-01', betrag: betrag(7), art: 'PROGNOSE' },
        { ab: '2029-01-01', betrag: betrag(8), art: 'PROGNOSE' },
      ],
      status: 'AKTIV',
      kostenProMonat: betrag(5),
      kostenImJahr: betrag(60),
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
    preise: einPreis(9.9, '2024-01-05'),
    zahlweise: 'MONATLICH',
    beginn: '2024-01-05',
    zahlungsweg: 'PAYPAL',
    verlaengerung: 'ZAHLUNGSINTERVALL',
    kuendigungsfristMonate: 1,
    gekuendigtZum: '2026-12-31',
    notiz: 'Kündigung am 20.10.2026 bestätigt',
    berechnet: {
      ...BERECHNET_LEER,
      einmalkosten: betrag(0),
      status: 'GEKUENDIGT',
      kostenProMonat: betrag(9.9),
      kostenImJahr: betrag(118.8),
      kuendigung: { ...KEINE_KUENDIGUNG, art: 'GEKUENDIGT', fristMonate: 1, zum: '2026-12-31' },
      vertragsende: '2026-12-31',
      wiederaufnahme: { fruehestens: '2027-01-01', vorschlag: '2027-01-01' },
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'alt',
    anbieter: 'Mobilfunk GmbH',
    kategorie: kategorie('MOBILFUNK_INTERNET'),
    betrag: betrag(19.99),
    preise: einPreis(19.99, '2024-01-15'),
    zahlweise: 'MONATLICH',
    beginn: '2024-01-15',
    gekuendigtZum: '2026-06-30',
    berechnet: {
      ...BERECHNET_LEER,
      einmalkosten: betrag(0),
      status: 'BEENDET',
      kostenProMonat: betrag(19.99),
      kostenImJahr: betrag(239.88),
      kuendigung: { ...KEINE_KUENDIGUNG, art: 'BEENDET' },
      vertragsende: '2026-06-30',
      wiederaufnahme: { fruehestens: '2026-07-01', vorschlag: '2026-09-01' },
    },
  },
];

export const BEISPIEL_VERTRAEGE: VertragAntwort[] = BEISPIELE.map((v) => ({
  ...v,
  unterbrechungen: [],
  berechnet: { wiederaufnahme: null, ...v.berechnet, aktuellerBeginn: v.beginn },
}));

/** Beendet, storniert oder unterbrochen: zählt nicht. */
function vorbei({ berechnet }: VertragAntwort): boolean {
  return ['BEENDET', 'STORNIERT', 'UNTERBROCHEN'].includes(berechnet.status);
}

function summeJeWaehrung(betraege: Betrag[]): Betrag[] {
  const summen = new Map<string, number>();
  for (const { wert, waehrung } of betraege) {
    summen.set(waehrung, (summen.get(waehrung) ?? 0) + wert);
  }
  return [...summen].map(([waehrung, wert]) => ({ waehrung, wert: Math.round(wert * 100) / 100 }));
}

const JAHR = 2026;

/** Im Jahr fällig, je Vertrag nur der eigene Anteil; gerundet erst die Summe, wie das Backend. */
function einmalkostenImJahr(vertraege: VertragAntwort[]): Betrag[] {
  const anteile = vertraege.flatMap((v) =>
    v.einmalkosten
      .filter(({ faelligAm }) => faelligAm.startsWith(`${JAHR}-`))
      .map(({ betrag }) => ({ ...betrag, wert: (betrag.wert * (v.anteilProzent ?? 100)) / 100 })),
  );
  return summeJeWaehrung(anteile);
}

function uebersicht(vertraege: VertragAntwort[]): VertragsuebersichtAntwort {
  const laufend = vertraege.filter(
    (v) => v.berechnet.status === 'AKTIV' || v.berechnet.status === 'GEKUENDIGT',
  );
  return {
    laufendeVertraege: laufend.length,
    kostenProMonat: summeJeWaehrung(
      laufend.map((v) => (v.berechnet.eigenerAnteil ?? v.berechnet).kostenProMonat),
    ),
    kostenImJahr: summeJeWaehrung(
      vertraege.map((v) => (v.berechnet.eigenerAnteil ?? v.berechnet).kostenImJahr),
    ),
    kostenImJahrMitPrognose: vertraege.some((v) => v.berechnet.kostenImJahrMitPrognose),
    einmalkostenImJahr: einmalkostenImJahr(vertraege),
    hatAnteile: vertraege.some((v) => v.anteilProzent !== null && v.anteilProzent < 100),
    hatNichtBegonnene: vertraege.some((v) => v.berechnet.status === 'NICHT_BEGONNEN'),
    jahr: JAHR,
    naechsteKuendigungsfristen: vertraege
      .filter((v) => !vorbei(v))
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
  if (anfrage.gekuendigtZum && anfrage.beginn && anfrage.gekuendigtZum < anfrage.beginn) {
    return { ...KEINE_KUENDIGUNG, art: 'STORNIERT', fristMonate };
  }
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

interface PreisAnfrage {
  gueltigAb?: string | null;
  betrag?: Betrag | null;
  automatisch?: boolean | null;
}

type VorschauPreis = VertragVorschauAntwort['preise'][number];

/** Ohne Datum oder Betrag ignoriert das Backend die Zeile (Vorschau); beim Speichern ist ein Fehler. */
function vollstaendig<T extends PreisAnfrage>(
  p: T,
): p is T & { gueltigAb: string; betrag: Betrag } {
  return !!p.betrag && !!p.gueltigAb;
}

/**
 * Sortiert wie das Backend, „heute“ ist der Tag des Browsers. `neu` sind die Stufen, die erst das
 * Speichern anlegt.
 */
function preiseMitArt(preise: (PreisAnfrage & { neu?: boolean })[]): VorschauPreis[] {
  const heute = new Date().toISOString().slice(0, 10);
  const sortiert = preise
    .filter(vollstaendig)
    .map(({ gueltigAb, betrag, automatisch, neu }) => ({
      gueltigAb,
      betrag,
      automatisch: !!automatisch,
      neu: !!neu,
    }))
    .sort((a, b) => a.gueltigAb.localeCompare(b.gueltigAb));
  const aktuell = Math.max(
    0,
    sortiert.findLastIndex((p) => p.gueltigAb <= heute),
  );
  return sortiert.map((p, i) => ({
    ...p,
    art: i < aktuell ? 'FRUEHER' : i === aktuell ? 'AKTUELL' : 'ANGEKUENDIGT',
  }));
}

/** Anteil eines Betrags, kaufmännisch auf Cent gerundet wie das Backend (19,99 € × 50 % = 10,00 €). */
function anteilVon({ wert, waehrung }: Betrag, prozent: number): Betrag {
  return { wert: Math.round(wert * prozent + 1e-9) / 100, waehrung };
}

interface EinmalkostenAnfrage {
  bezeichnung?: string | null;
  betrag?: Betrag | null;
  faelligAm?: string | null;
}

/** Nur vollständige Zeilen, sortiert nach Fälligkeit, dann Bezeichnung. */
function vollstaendigeEinmalkosten(zeilen: EinmalkostenAnfrage[]): VertragAntwort['einmalkosten'] {
  return zeilen
    .filter((z): z is VertragAntwort['einmalkosten'][number] =>
      Boolean(z.bezeichnung?.trim() && z.betrag && z.faelligAm),
    )
    .map(({ bezeichnung, betrag, faelligAm }) => ({ bezeichnung, betrag, faelligAm }))
    .sort(
      (a, b) =>
        a.faelligAm.localeCompare(b.faelligAm) || a.bezeichnung.localeCompare(b.bezeichnung),
    );
}

/** Voller Betrag, ohne Anteil; ohne vollständige Zeile `null`. */
function einmalkostenSumme(zeilen: VertragAntwort['einmalkosten']): Betrag | null {
  return summeJeWaehrung(zeilen.map(({ betrag }) => betrag))[0] ?? null;
}

const RHYTHMUS_MONATE = {
  VIERTELJAEHRLICH: 3,
  HALBJAEHRLICH: 6,
  JAEHRLICH: 12,
  ZWEIJAEHRLICH: 24,
  DREIJAEHRLICH: 36,
};

function plusTage(iso: string, tage: number): string {
  const [jahr, monat, tag] = iso.split('-').map(Number);
  return new Date(Date.UTC(jahr, monat - 1, tag + tage)).toISOString().slice(0, 10);
}

function plusMonate(iso: string, monate: number): string {
  const [jahr, monat, tag] = iso.split('-').map(Number);
  return new Date(Date.UTC(jahr, monat - 1 + monate, tag)).toISOString().slice(0, 10);
}

/** Beginn plus ein Rhythmus, wie `vorschlagNaechsteAm` des Backends (ohne dessen Monatsende-Regel). */
function vorschlagFuer(anfrage: VertragVorschauAnfrage): string | null {
  const rhythmus = anfrage.preissteigerung?.rhythmus;
  return anfrage.beginn && rhythmus ? plusMonate(anfrage.beginn, RHYTHMUS_MONATE[rhythmus]) : null;
}

/**
 * Grob wie das Backend (ADR 0022): die bis heute fälligen Stufen ab dem letzten Preis bis heute,
 * nach `betrachtetBis` und der Garantie, nicht nach `gekuendigtZum`; jeder Schritt auf Cent gerundet.
 */
function faelligeStufen(
  anfrage: VertragVorschauAnfrage,
  preise: PreisAnfrage[],
  betrachtetBis: string | null,
): { gueltigAb: string; betrag: Betrag }[] {
  const regel = anfrage.preissteigerung;
  const wert = regel?.art === 'PROZENT' ? regel.prozent : regel?.betrag?.wert;
  const heute = new Date().toISOString().slice(0, 10);
  const ausgang = preise
    .filter(vollstaendig)
    .filter((p) => p.gueltigAb <= heute)
    .sort((a, b) => a.gueltigAb.localeCompare(b.gueltigAb))
    .at(-1);
  if (!regel?.art || !regel.rhythmus || !regel.naechsteAm || !wert || !ausgang) {
    return [];
  }
  const grenze = [ausgang.gueltigAb, betrachtetBis ?? '', anfrage.preisgarantieBis ?? '']
    .sort()
    .at(-1)!;
  const bis =
    anfrage.gekuendigtZum && anfrage.gekuendigtZum < heute ? anfrage.gekuendigtZum : heute;
  const stufen: { gueltigAb: string; betrag: Betrag }[] = [];
  let preis = ausgang.betrag.wert;
  for (let i = 0; i < 1200; i++) {
    const ab = plusMonate(regel.naechsteAm, i * RHYTHMUS_MONATE[regel.rhythmus]);
    if (ab > bis) {
      break;
    }
    if (ab <= grenze) {
      continue;
    }
    preis =
      Math.round((regel.art === 'PROZENT' ? preis * (1 + wert / 100) : preis + wert) * 100) / 100;
    stufen.push({ gueltigAb: ab, betrag: { ...ausgang.betrag, wert: preis } });
  }
  return stufen;
}

/**
 * Grob wie das Backend: ab dem letzten Preis im Rhythmus, nicht vor heute (Browser), nicht in der
 * Garantie und nicht nach `gekuendigtZum`; jeder Schritt auf Cent gerundet. Unvollständig: keine.
 */
function prognoseFuer(
  anfrage: VertragVorschauAnfrage,
  preise: Pick<VertragPreisAntwort, 'gueltigAb' | 'betrag'>[],
): Prognosepreis[] {
  const regel = anfrage.preissteigerung;
  const letzter = preise.at(-1);
  if (!regel?.art || !regel.rhythmus || !regel.naechsteAm || !letzter) {
    return [];
  }
  const wert = regel.art === 'PROZENT' ? regel.prozent : regel.betrag?.wert;
  if (!wert) {
    return [];
  }
  const heute = new Date().toISOString().slice(0, 10);
  const prognose: Prognosepreis[] = [];
  let preis = letzter.betrag.wert;
  for (let i = 0; prognose.length < 3 && i < 200; i++) {
    const ab = plusMonate(regel.naechsteAm, i * RHYTHMUS_MONATE[regel.rhythmus]);
    if (anfrage.gekuendigtZum && ab > anfrage.gekuendigtZum) {
      break;
    }
    if (
      ab <= letzter.gueltigAb ||
      (anfrage.preisgarantieBis && ab <= anfrage.preisgarantieBis) ||
      ab < heute
    ) {
      continue;
    }
    preis =
      Math.round((regel.art === 'PROZENT' ? preis * (1 + wert / 100) : preis + wert) * 100) / 100;
    prognose.push({ ab, betrag: { ...letzter.betrag, wert: preis } });
  }
  return prognose;
}

function preisverlaufFuer(
  preise: Pick<VertragPreisAntwort, 'gueltigAb' | 'betrag' | 'art'>[],
  prognose: Prognosepreis[],
): Preispunkt[] {
  return [
    ...preise
      .filter(({ art }) => art !== 'NACH_ENDE')
      .map(({ gueltigAb, betrag, art }) => ({
        ab: gueltigAb,
        betrag,
        art: art === 'ANGEKUENDIGT' ? ('ANGEKUENDIGT' as const) : ('GEZAHLT' as const),
      })),
    ...prognose.map((p) => ({ ...p, art: 'PROGNOSE' as const })),
  ];
}

/**
 * Ohne Beginn ohne Preise: Der erste gilt ab dem Beginn. Die Preise wie nach dem Speichern, die
 * fälligen Stufen mit `neu`.
 */
function vorschauAntwort(anfrage: VertragVorschauAnfrage): VertragVorschauAntwort {
  const eingegeben = anfrage.preise ?? [];
  const stufen = faelligeStufen(anfrage, eingegeben, anfrage.preissteigerungBetrachtetBis ?? null);
  const preise = anfrage.beginn
    ? preiseMitArt([
        ...eingegeben,
        ...stufen.map((stufe) => ({ ...stufe, automatisch: true, neu: true })),
      ])
    : [];
  const aktuell = preise.find((p) => p.art === 'AKTUELL')?.betrag ?? null;
  const angekuendigt = preise.find((p) => p.art === 'ANGEKUENDIGT');
  const prognose = prognoseFuer(anfrage, preise);
  const prozent = anfrage.anteilProzent ?? 100;
  const proMonat =
    aktuell && anfrage.zahlweise
      ? {
          ...aktuell,
          wert: Math.round((aktuell.wert * 100) / MONATE_JE_ZAHLUNG[anfrage.zahlweise]) / 100,
        }
      : null;
  return {
    betrag: aktuell,
    preise,
    kostenProMonat: proMonat,
    eigenerAnteil:
      aktuell && prozent < 100
        ? {
            betrag: anteilVon(aktuell, prozent),
            kostenProMonat: proMonat && anteilVon(proMonat, prozent),
          }
        : null,
    einmalkosten: einmalkostenSumme(vollstaendigeEinmalkosten(anfrage.einmalkosten ?? [])),
    naechstePreisaenderung: angekuendigt
      ? { ab: angekuendigt.gueltigAb, betrag: angekuendigt.betrag, art: 'ANGEKUENDIGT' }
      : prognose[0]
        ? { ...prognose[0], art: 'PROGNOSE' }
        : null,
    prognose,
    kuendigung: vorschau(anfrage),
    vorschlagNaechsteAm: vorschlagFuer(anfrage),
  };
}

/** Grob wie das Backend, „heute“ ist der Tag des Browsers. */
function statusFuer({
  beginn,
  gekuendigtZum,
}: VertragAnfrage): VertragAntwort['berechnet']['status'] {
  const heute = new Date().toISOString().slice(0, 10);
  if (gekuendigtZum && gekuendigtZum < beginn) return 'STORNIERT';
  if (beginn > heute) return 'NICHT_BEGONNEN';
  if (gekuendigtZum && gekuendigtZum < heute) return 'BEENDET';
  return gekuendigtZum ? 'GEKUENDIGT' : 'AKTIV';
}

/** `gekuendigtZum` bzw. Laufzeitende ohne Verlängerung, das frühere. */
function vertragsendeFuer(anfrage: VertragAnfrage): string | null {
  const enden = [
    anfrage.gekuendigtZum,
    anfrage.verlaengerung === 'KEINE' ? anfrage.laufzeitende : null,
  ].filter((ende): ende is string => !!ende);
  return enden.sort()[0] ?? null;
}

/**
 * Gespeichert wie im Backend: Ein Preis bleibt nur automatisch, wenn er so gespeichert war; die
 * fälligen Stufen nach `preissteigerungBetrachtetBis` des gespeicherten Stands kommen dazu.
 */
function ausAnfrage(
  anfrage: VertragAnfrage | VertragAenderung,
  id: string,
  version: number,
  bisher: VertragAntwort | null = null,
): VertragAntwort {
  const { kategorieId, ...rest } = anfrage;
  const { unterbrechungIds, ...felder } = rest as typeof rest & { unterbrechungIds?: string[] };
  // Beim Ändern bleiben nur die genannten Unterbrechungen; anlegen lassen sie sich so nicht.
  const unterbrechungen = (bisher?.unterbrechungen ?? []).filter(({ id }) =>
    unterbrechungIds?.includes(id),
  );
  const letzte = unterbrechungen.at(-1);
  const geprueft = anfrage.preise.map((p) => ({
    ...p,
    automatisch:
      !!p.automatisch &&
      !!bisher?.preise.some(
        (b) => b.automatisch && b.gueltigAb === p.gueltigAb && b.betrag.wert === p.betrag.wert,
      ),
  }));
  const heute = new Date().toISOString().slice(0, 10);
  const {
    betrag: aktuell,
    preise: vorschauPreise,
    naechstePreisaenderung,
    eigenerAnteil,
    prognose,
  } = vorschauAntwort({
    ...anfrage,
    preise: geprueft,
    preissteigerungBetrachtetBis: bisher?.preissteigerungBetrachtetBis ?? null,
  });
  const preise: VertragPreisAntwort[] = vorschauPreise.map((preis) => ({
    gueltigAb: preis.gueltigAb,
    betrag: preis.betrag,
    art: preis.art,
    automatisch: preis.automatisch,
  }));
  const { wert, waehrung } = aktuell!;
  const proJahr = Math.round((wert * 1200) / MONATE_JE_ZAHLUNG[anfrage.zahlweise]) / 100;
  const prozent = anfrage.anteilProzent ?? 100;
  const einmalkosten = vollstaendigeEinmalkosten(anfrage.einmalkosten);
  return {
    ...VERTRAG_LEER,
    ...felder,
    id,
    version,
    betrag: aktuell!,
    preise,
    preissteigerungBetrachtetBis: anfrage.preissteigerung
      ? heute
      : (bisher?.preissteigerungBetrachtetBis ?? null),
    einmalkosten,
    preissteigerung: anfrage.preissteigerung
      ? {
          ...anfrage.preissteigerung,
          betrag: anfrage.preissteigerung.betrag ?? null,
          prozent: anfrage.preissteigerung.prozent ?? null,
        }
      : null,
    kategorie: KATEGORIEN.find((k) => k.id === kategorieId) ?? KATEGORIEN[0],
    unterbrechungen,
    berechnet: {
      ...BERECHNET_LEER,
      aktuellerBeginn: letzte ? plusTage(letzte.bis, 1) : anfrage.beginn,
      wiederaufnahme: null,
      einmalkosten: einmalkostenSumme(einmalkosten) ?? { wert: 0, waehrung },
      status: statusFuer(anfrage),
      kostenProMonat: { wert: Math.round((proJahr * 100) / 12) / 100, waehrung },
      kostenImJahr: { wert: proJahr, waehrung },
      naechstePreisaenderung,
      prognose,
      vertragsende: vertragsendeFuer(anfrage),
      preisverlauf: preisverlaufFuer(preise, prognose),
      kostenImJahrMitPrognose: prognose.some(({ ab }) => ab.startsWith(`${JAHR}-`)),
      eigenerAnteil: eigenerAnteil && {
        betrag: eigenerAnteil.betrag,
        kostenProMonat: eigenerAnteil.kostenProMonat!,
        kostenImJahr: anteilVon({ wert: proJahr, waehrung }, prozent),
      },
      kuendigung: vorschau(anfrage),
    },
  };
}

/** Wie das Backend: `""` bei Enum und Datum sowie `{ wert: null }` sind nicht lesbar. */
function nichtLesbar(anfrage: Record<string, unknown>): boolean {
  const zeilen = [
    ...((anfrage['preise'] ?? []) as { betrag: { wert: unknown } | null }[]),
    ...((anfrage['einmalkosten'] ?? []) as { betrag: { wert: unknown } | null }[]),
  ];
  return (
    zeilen.some(({ betrag }) => betrag?.wert === null) ||
    ['kategorieId', 'zahlweise', 'zahlungsweg', 'beginn', 'laufzeitende'].some(
      (feld) => anfrage[feld] === '',
    )
  );
}

function feldfehler(anfrage: VertragAnfrage): Feldfehler[] {
  const fehler: Feldfehler[] = [];
  const melden = (feld: string, code: string, parameter = {}) =>
    fehler.push({ feld, code, parameter });
  if (!anfrage.anbieter?.trim()) melden('anbieter', 'NotBlank');
  if ((anfrage.bezeichnung?.length ?? 0) > 200) melden('bezeichnung', 'Size', { max: 200 });
  if (!anfrage.kategorieId) melden('kategorieId', 'NotNull');
  if (anfrage.kategorieId === 'unbekannt') melden('kategorieId', 'Unbekannt');
  if (!anfrage.zahlweise) melden('zahlweise', 'NotNull');
  if (!anfrage.beginn) melden('beginn', 'NotNull');
  if (!anfrage.preise?.length) {
    melden('preise', 'NotEmpty');
  }
  const daten = new Set<string>();
  (anfrage.preise ?? []).forEach(({ gueltigAb, betrag }, i) => {
    if (!betrag) {
      melden(`preise[${i}].betrag`, 'NotNull');
    } else if (betrag.wert <= 0) {
      melden(`preise[${i}].betrag`, 'PositiverBetrag');
    } else if (Math.round(betrag.wert * 100) / 100 !== betrag.wert) {
      melden(`preise[${i}].betrag.wert`, 'Digits', { integer: 17, fraction: 2 });
    }
    if (!gueltigAb) {
      melden(`preise[${i}].gueltigAb`, 'NotNull');
    } else if (daten.has(gueltigAb)) {
      melden(`preise[${i}].gueltigAb`, 'GueltigAbEindeutig');
    } else if (gueltigAb && anfrage.beginn && gueltigAb < anfrage.beginn) {
      melden(`preise[${i}].gueltigAb`, 'PreisNichtVorBeginn');
    }
    if (gueltigAb) daten.add(gueltigAb);
  });
  // Der früheste vollständige Preis gilt genau ab Beginn; davor meldet PreisNichtVorBeginn.
  const vollstaendige = (anfrage.preise ?? []).map((p, i) => ({ ...p, i })).filter(vollstaendig);
  const fruehester = vollstaendige.sort((a, b) => a.gueltigAb.localeCompare(b.gueltigAb))[0];
  if (fruehester && anfrage.beginn && fruehester.gueltigAb > anfrage.beginn) {
    melden(`preise[${fruehester.i}].gueltigAb`, 'ErsterPreisAbBeginn');
  }
  const regel = anfrage.preissteigerung;
  if (regel) {
    if (!regel.naechsteAm) melden('preissteigerung.naechsteAm', 'NotNull');
    if (regel.art === 'PROZENT' && regel.prozent == null) {
      melden('preissteigerung.prozent', 'PassenderWert');
    } else if (regel.art === 'PROZENT' && regel.prozent! > 100) {
      melden('preissteigerung.prozent', 'DecimalMax', { value: '100' });
    }
    if (regel.art === 'BETRAG' && !regel.betrag) melden('preissteigerung.betrag', 'PassenderWert');
  }
  if (!anfrage.einmalkosten) {
    melden('einmalkosten', 'NotNull');
  }
  (anfrage.einmalkosten ?? []).forEach(({ bezeichnung, betrag, faelligAm }, i) => {
    if (!bezeichnung?.trim()) melden(`einmalkosten[${i}].bezeichnung`, 'NotBlank');
    if (!betrag) {
      melden(`einmalkosten[${i}].betrag`, 'NotNull');
    } else if (betrag.wert <= 0) {
      melden(`einmalkosten[${i}].betrag`, 'PositiverBetrag');
    }
    if (!faelligAm) melden(`einmalkosten[${i}].faelligAm`, 'NotNull');
  });
  if (anfrage.beginn && anfrage.laufzeitende && anfrage.laufzeitende < anfrage.beginn) {
    melden('laufzeitende', 'LaufzeitendeNachBeginn');
  }
  return fehler;
}

/** Antwort auf eine ungültige Eingabe, sonst `null`. */
function eingabePruefen(route: Route, problem: FehlerAntwort): Promise<void> | null {
  const anfrage = route.request().postDataJSON();
  if (nichtLesbar(anfrage)) {
    return problem(route, 400, 'ANFRAGE_UNGUELTIG', 'Request body is not readable.');
  }
  const felder = feldfehler(anfrage);
  return felder.length
    ? route.fulfill({
        status: 400,
        contentType: 'application/problem+json',
        json: {
          type: 'about:blank',
          status: 400,
          detail: 'Request contains invalid fields.',
          code: 'VALIDIERUNG',
          felder,
        },
      })
    : null;
}

type Fehlschlag = { status: 409; code: string } | { status: 400; felder: Feldfehler[] };

/**
 * Grob wie das Backend: Die Lücke zwischen Vertragsende und Datum wird eine Unterbrechung, ab dem Datum
 * läuft der Vertrag wieder; liegt es in der Zukunft, ist er bis dahin unterbrochen.
 */
function wiederaufnehmen(
  bisher: VertragAntwort,
  anfrage: VertragWiederaufnahme,
): VertragAntwort | Fehlschlag {
  const ende = bisher.berechnet.vertragsende;
  if (!bisher.berechnet.wiederaufnahme || !ende) {
    return { status: 409, code: 'WIEDERAUFNAHME_NICHT_MOEGLICH' };
  }
  if (anfrage.version !== bisher.version) {
    return { status: 409, code: 'KONFLIKT' };
  }
  if (anfrage.datum <= ende) {
    return {
      status: 400,
      felder: [{ feld: 'datum', code: 'NachVertragsende', parameter: { vertragsende: ende } }],
    };
  }
  const heute = new Date().toISOString().slice(0, 10);
  const luecke = plusTage(ende, 1) < anfrage.datum;
  const unterbrechungen = luecke
    ? [
        ...bisher.unterbrechungen,
        {
          id: `u-${bisher.unterbrechungen.length + 1}`,
          von: plusTage(ende, 1),
          bis: plusTage(anfrage.datum, -1),
          art: 'KUENDIGUNG' as const,
        },
      ]
    : bisher.unterbrechungen;
  const unterbrochen = anfrage.datum > heute;
  const betrag = anfrage.betrag ?? bisher.betrag;
  return {
    ...bisher,
    version: bisher.version + 1,
    gekuendigtZum: null,
    laufzeitende: anfrage.laufzeitende ?? null,
    verlaengerung: bisher.kuendbar ? (anfrage.verlaengerung ?? null) : null,
    kuendigungsfristMonate: bisher.kuendbar ? (anfrage.kuendigungsfristMonate ?? null) : null,
    betrag,
    preise: anfrage.betrag
      ? [
          ...bisher.preise.map((p) => ({ ...p, art: 'FRUEHER' as const })),
          { gueltigAb: anfrage.datum, betrag, art: 'AKTUELL', automatisch: false },
        ]
      : bisher.preise,
    unterbrechungen,
    berechnet: {
      ...bisher.berechnet,
      status: unterbrochen ? 'UNTERBROCHEN' : 'AKTIV',
      aktuellerBeginn: luecke ? anfrage.datum : bisher.beginn,
      vertragsende: null,
      wiederaufnahme: null,
      kuendigung: unterbrochen
        ? { ...KEINE_KUENDIGUNG, art: 'WIEDER_AB', zum: anfrage.datum }
        : { ...KEINE_KUENDIGUNG, art: 'MONATLICH_KUENDBAR', zum: plusMonate(heute, 1) },
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
      return route.fulfill({ json: vorschauAntwort(anfrage.postDataJSON()) });
    }
    if (!pfad && anfrage.method() === 'POST') {
      const ungueltig = eingabePruefen(route, problem);
      if (ungueltig) {
        return ungueltig;
      }
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

    const [id, unterpfad] = pfad.split('/');
    if (unterpfad === 'wiederaufnahme') {
      const bisher = vertraege.find((v) => v.id === id);
      if (!bisher) {
        return problem(route, 404, 'NICHT_GEFUNDEN', `Contract ${id} not found.`);
      }
      const antwort = wiederaufnehmen(bisher, anfrage.postDataJSON());
      if ('status' in antwort) {
        return antwort.status === 400
          ? route.fulfill({
              status: 400,
              json: { code: 'VALIDIERUNG', status: 400, felder: antwort.felder },
            })
          : problem(route, antwort.status, antwort.code, 'Resumption failed.');
      }
      vertraege = vertraege.map((v) => (v.id === id ? antwort : v));
      return route.fulfill({ json: antwort });
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
    const ungueltig = aenderung && eingabePruefen(route, problem);
    if (ungueltig) {
      return ungueltig;
    }
    const version = aenderung?.version ?? Number(url.searchParams.get('version'));
    if (version !== vorhanden.version) {
      return problem(route, 409, 'KONFLIKT', 'Contract was changed in the meantime.');
    }
    if (aenderung) {
      const geaendert = ausAnfrage(aenderung, pfad, version + 1, vorhanden);
      vertraege = vertraege.map((v) => (v.id === pfad ? geaendert : v));
      return route.fulfill({ json: geaendert });
    }
    vertraege = vertraege.filter((v) => v.id !== pfad);
    return route.fulfill({ status: 204 });
  });
}
