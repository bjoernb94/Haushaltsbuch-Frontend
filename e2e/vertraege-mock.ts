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
  anteilProzent: null,
  einmalkosten: [] as VertragAntwort['einmalkosten'],
  preissteigerung: null,
  preisgarantieBis: null,
  erinnerungSonderkuendigung: true,
} as const;

/** Ein Preis seit Vertragsbeginn, wie bei den meisten Verträgen. */
function einPreis(wert: number): VertragPreisAntwort[] {
  return [{ gueltigAb: null, betrag: betrag(wert), art: 'AKTUELL' }];
}

const BERECHNET_LEER: Pick<
  VertragAntwort['berechnet'],
  | 'kostenImJahrMitPrognose'
  | 'jahr'
  | 'eigenerAnteil'
  | 'naechstePreisaenderung'
  | 'preisverlauf'
  | 'prognose'
> = {
  kostenImJahrMitPrognose: false,
  jahr: 2026,
  eigenerAnteil: null,
  naechstePreisaenderung: null,
  preisverlauf: [],
  prognose: [],
};

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
    preise: einPreis(586.8),
    zahlweise: 'JAEHRLICH',
    abbuchungAb: '2024-01-01',
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
      naechsteAbbuchung: { am: '2027-01-01', betrag: betrag(586.8) },
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
      { gueltigAb: null, betrag: betrag(29.9), art: 'FRUEHER' },
      { gueltigAb: '2026-01-01', betrag: betrag(34.9), art: 'AKTUELL' },
      { gueltigAb: '2027-03-01', betrag: betrag(39.9), art: 'ANGEKUENDIGT' },
    ],
    zahlweise: 'MONATLICH',
    abbuchungAb: '2025-05-01',
    verlaengerung: 'ZAHLUNGSINTERVALL',
    kuendigungsfristMonate: 3,
    berechnet: {
      ...BERECHNET_LEER,
      einmalkosten: betrag(0),
      status: 'AKTIV',
      naechstePreisaenderung: { ab: '2027-03-01', betrag: betrag(39.9), art: 'ANGEKUENDIGT' },
      kostenProMonat: betrag(34.9),
      kostenImJahr: betrag(418.8),
      naechsteAbbuchung: { am: '2026-12-01', betrag: betrag(34.9) },
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
    preise: einPreis(55.08),
    zahlweise: 'VIERTELJAEHRLICH',
    abbuchungAb: '2013-01-15',
    kuendbar: false,
    berechnet: {
      ...BERECHNET_LEER,
      einmalkosten: betrag(0),
      status: 'AKTIV',
      kostenProMonat: betrag(18.36),
      kostenImJahr: betrag(220.32),
      naechsteAbbuchung: { am: '2027-01-15', betrag: betrag(55.08) },
      kuendigung: { ...KEINE_KUENDIGUNG, art: 'NICHT_KUENDBAR' },
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'kurs',
    anbieter: 'Sprachschule',
    kategorie: kategorie('SONSTIGES'),
    betrag: betrag(60),
    preise: einPreis(60),
    zahlweise: 'HALBJAEHRLICH',
    abbuchungAb: '2026-07-01',
    laufzeitende: '2027-06-30',
    verlaengerung: 'KEINE',
    berechnet: {
      ...BERECHNET_LEER,
      einmalkosten: betrag(0),
      status: 'AKTIV',
      kostenProMonat: betrag(10),
      kostenImJahr: betrag(120),
      naechsteAbbuchung: { am: '2027-01-01', betrag: betrag(60) },
      kuendigung: { ...KEINE_KUENDIGUNG, art: 'ENDET', zum: '2027-06-30' },
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'app',
    anbieter: 'Software GmbH',
    kategorie: kategorie('SOFTWARE_APPS'),
    betrag: betrag(5),
    preise: einPreis(5),
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
    abbuchungAb: '2026-01-05',
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
      naechsteAbbuchung: { am: '2026-12-05', betrag: betrag(5) },
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
    preise: einPreis(9.9),
    zahlweise: 'MONATLICH',
    abbuchungAb: '2024-01-05',
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
      naechsteAbbuchung: { am: '2026-12-05', betrag: betrag(9.9) },
      kuendigung: { ...KEINE_KUENDIGUNG, art: 'GEKUENDIGT', fristMonate: 1, zum: '2026-12-31' },
    },
  },
  {
    ...VERTRAG_LEER,
    id: 'alt',
    anbieter: 'Mobilfunk GmbH',
    kategorie: kategorie('MOBILFUNK_INTERNET'),
    betrag: betrag(19.99),
    preise: einPreis(19.99),
    zahlweise: 'MONATLICH',
    abbuchungAb: '2024-01-15',
    gekuendigtZum: '2026-06-30',
    berechnet: {
      ...BERECHNET_LEER,
      einmalkosten: betrag(0),
      status: 'BEENDET',
      kostenProMonat: betrag(19.99),
      kostenImJahr: betrag(239.88),
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
  const laufend = vertraege.filter((v) => v.berechnet.status !== 'BEENDET');
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
    jahr: JAHR,
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

interface PreisAnfrage {
  gueltigAb?: string | null;
  betrag?: Betrag | null;
}

/** Sortiert wie das Backend, „heute“ ist der Tag des Browsers; der Eintrag ohne Datum zuerst. */
function preiseMitArt(preise: PreisAnfrage[]): VertragPreisAntwort[] {
  const heute = new Date().toISOString().slice(0, 10);
  const sortiert = preise
    .filter((p): p is { gueltigAb?: string | null; betrag: Betrag } => !!p.betrag)
    .map((p) => ({ gueltigAb: p.gueltigAb ?? null, betrag: p.betrag }))
    .sort((a, b) => (a.gueltigAb ?? '').localeCompare(b.gueltigAb ?? ''));
  const aktuell = Math.max(
    0,
    sortiert.findLastIndex((p) => !p.gueltigAb || p.gueltigAb <= heute),
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

function plusMonate(iso: string, monate: number): string {
  const [jahr, monat, tag] = iso.split('-').map(Number);
  return new Date(Date.UTC(jahr, monat - 1 + monate, tag)).toISOString().slice(0, 10);
}

/**
 * Grob wie das Backend: ab dem letzten Preis im Rhythmus, nicht vor heute (Browser), nicht in der
 * Garantie und nicht nach `gekuendigtZum`; jeder Schritt auf Cent gerundet. Unvollständig: keine.
 */
function prognoseFuer(
  anfrage: VertragVorschauAnfrage,
  preise: VertragPreisAntwort[],
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
      (letzter.gueltigAb && ab <= letzter.gueltigAb) ||
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

/** Erster Preis ohne Datum: Beginn, sonst 12 Monate vor dem zweiten bzw. vor heute. */
function preisverlaufFuer(
  preise: VertragPreisAntwort[],
  prognose: Prognosepreis[],
  beginn: string | null | undefined,
): Preispunkt[] {
  const heute = new Date().toISOString().slice(0, 10);
  return [
    ...preise
      .filter(({ art }) => art !== 'NACH_ENDE')
      .map(({ gueltigAb, betrag, art }, i, alle) => ({
        ab: gueltigAb ?? beginn ?? plusMonate(alle[i + 1]?.gueltigAb ?? heute, -12),
        betrag,
        art: art === 'ANGEKUENDIGT' ? ('ANGEKUENDIGT' as const) : ('GEZAHLT' as const),
      })),
    ...prognose.map((p) => ({ ...p, art: 'PROGNOSE' as const })),
  ];
}

function vorschauAntwort(anfrage: VertragVorschauAnfrage): VertragVorschauAntwort {
  const preise = preiseMitArt(anfrage.preise ?? []);
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
    // Grob: der Anker selbst, ohne Rhythmus; null ohne Zahlweise, Anker oder Preis wie im Backend.
    naechsteAbbuchung:
      aktuell && anfrage.zahlweise && anfrage.abbuchungAb
        ? { am: anfrage.abbuchungAb, betrag: aktuell }
        : null,
    naechstePreisaenderung: angekuendigt
      ? { ab: angekuendigt.gueltigAb!, betrag: angekuendigt.betrag, art: 'ANGEKUENDIGT' }
      : prognose[0]
        ? { ...prognose[0], art: 'PROGNOSE' }
        : null,
    prognose,
    kuendigung: vorschau(anfrage),
  };
}

function ausAnfrage(
  anfrage: VertragAnfrage | VertragAenderung,
  id: string,
  version: number,
): VertragAntwort {
  const { kategorieId, ...felder } = anfrage;
  const {
    betrag: aktuell,
    preise,
    naechstePreisaenderung,
    eigenerAnteil,
    prognose,
  } = vorschauAntwort(anfrage);
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
    einmalkosten,
    preissteigerung: anfrage.preissteigerung
      ? {
          ...anfrage.preissteigerung,
          betrag: anfrage.preissteigerung.betrag ?? null,
          prozent: anfrage.preissteigerung.prozent ?? null,
        }
      : null,
    kategorie: KATEGORIEN.find((k) => k.id === kategorieId) ?? KATEGORIEN[0],
    berechnet: {
      ...BERECHNET_LEER,
      einmalkosten: einmalkostenSumme(einmalkosten) ?? { wert: 0, waehrung },
      status: anfrage.gekuendigtZum ? 'GEKUENDIGT' : 'AKTIV',
      kostenProMonat: { wert: Math.round((proJahr * 100) / 12) / 100, waehrung },
      kostenImJahr: { wert: proJahr, waehrung },
      naechsteAbbuchung: { am: anfrage.abbuchungAb, betrag: aktuell! },
      naechstePreisaenderung,
      prognose,
      preisverlauf: preisverlaufFuer(preise, prognose, anfrage.beginn),
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
    ['kategorieId', 'zahlweise', 'abbuchungAb', 'zahlungsweg', 'beginn', 'laufzeitende'].some(
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
  if (!anfrage.abbuchungAb) melden('abbuchungAb', 'NotNull');
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
    if (!gueltigAb && anfrage.preise.slice(0, i).some((p) => !p.gueltigAb)) {
      melden(`preise[${i}].gueltigAb`, 'GueltigAbPflicht');
    } else if (gueltigAb && daten.has(gueltigAb)) {
      melden(`preise[${i}].gueltigAb`, 'GueltigAbEindeutig');
    } else if (gueltigAb && anfrage.beginn && gueltigAb < anfrage.beginn) {
      melden(`preise[${i}].gueltigAb`, 'PreisNichtVorBeginn');
    }
    if (gueltigAb) daten.add(gueltigAb);
  });
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
      const geaendert = ausAnfrage(aenderung, pfad, version + 1);
      vertraege = vertraege.map((v) => (v.id === pfad ? geaendert : v));
      return route.fulfill({ json: geaendert });
    }
    vertraege = vertraege.filter((v) => v.id !== pfad);
    return route.fulfill({ status: 204 });
  });
}
