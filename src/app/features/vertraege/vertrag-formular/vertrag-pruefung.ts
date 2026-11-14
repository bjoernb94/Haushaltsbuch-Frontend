import {
  Betrag,
  Feldfehler,
  Verlaengerung,
  VertragAntwort,
  VertragVorschauAnfrage,
  Zahlungsweg,
  Zahlweise,
} from '../../../core/api/api';
import { PreisEingabe, VertragEingabe } from '../vertrag.service';

/** Eine Zeile der Liste „Frühere und angekündigte Preise“. */
export interface PreisWerte {
  gueltigAb: string;
  betrag: string;
}

/** Werte der Formularfelder, unverändert wie eingegeben. */
export interface VertragWerte {
  anbieter: string;
  bezeichnung: string;
  kategorieId: string;
  vertragsnummer: string;
  /** Der heute gültige Preis (Art {@code AKTUELL}). */
  betrag: string;
  /** Leer = ab Vertragsbeginn. */
  gueltigSeit: string;
  /** Alle übrigen Preise, in der Reihenfolge der Antwort bzw. der Eingabe. */
  preise: PreisWerte[];
  /** Leer = 100 %. */
  anteilProzent: string;
  zahlweise: Zahlweise | '';
  abbuchungAb: string;
  zahlungsweg: Zahlungsweg | '';
  nichtKuendbar: boolean;
  beginn: string;
  laufzeitende: string;
  verlaengerung: Verlaengerung | '';
  kuendigungsfristMonate: string;
  gekuendigt: boolean;
  gekuendigtZum: string;
  notiz: string;
}

export type EinzelFeld = Exclude<keyof VertragWerte, 'preise'>;

/** Feld einer Zeile der Preisliste, z. B. {@code preise.0.gueltigAb}. */
export type PreisFeld = `preise.${number}.${keyof PreisWerte}`;

export type VertragFeld = EinzelFeld | PreisFeld;

export function preisFeld(index: number, feld: keyof PreisWerte): PreisFeld {
  return `preise.${index}.${feld}`;
}

// Ohne Tausenderpunkte oder mit korrekt gesetzten. „12.50“ passt absichtlich nicht: Das ist weder
// deutsch noch eindeutig und darf nicht still zu 1250 werden.
const BETRAG_MUSTER = /^-?(\d+|\d{1,3}(\.\d{3})+)(,\d+)?$/;

// Mehr Stellen kann eine JSON-Zahl aus dem Browser nicht genau wiedergeben.
const BETRAG_MAX_STELLEN = 15;

/** Liest einen Betrag mit Komma, {@code null} wenn das nicht eindeutig geht. Nicht gerundet. */
export function betragLesen(eingabe: string): number | null {
  const text = eingabe.trim();
  if (!BETRAG_MUSTER.test(text) || text.replace(/\D/g, '').length > BETRAG_MAX_STELLEN) {
    return null;
  }
  return Number(text.replaceAll('.', '').replace(',', '.'));
}

// Mit Komma wie im Design; was sich nicht lesen lässt, darf nicht still zu 100 % werden.
const ANTEIL_MUSTER = /^\d+(,\d+)?$/;

// Wie das Backend (1 bis 100, höchstens eine Nachkommastelle); nur damit die Vorschau nicht scheitert.
const ANTEIL_VORSCHAU = /^\d{1,3}(,\d)?$/;

function anteilFuerVorschau(eingabe: string, anteil: number | null): number | null {
  return ANTEIL_VORSCHAU.test(eingabe.trim()) && anteil !== null && anteil >= 1 && anteil <= 100
    ? anteil
    : null;
}

const ANTEIL_TEXT = 'Bitte eine Zahl von 1 bis 100 mit höchstens einer Nachkommastelle.';

/** Liest den Anteil mit Komma, {@code null} wenn das nicht geht. Grenzen prüft das Backend. */
export function anteilLesen(eingabe: string): number | null {
  const text = eingabe.trim();
  return ANTEIL_MUSTER.test(text) ? Number(text.replace(',', '.')) : null;
}

const PFLICHT_TEXT = {
  anbieter: 'Bitte gib den Anbieter ein.',
  kategorieId: 'Bitte wähle eine Kategorie.',
  betrag: 'Bitte gib einen gültigen Betrag ein, z. B. 19,99.',
  zahlweise: 'Bitte wähle die Zahlweise.',
  abbuchungAb: 'Bitte gib das Datum der nächsten Abbuchung ein.',
  gekuendigtZum: 'Bitte gib an, zu wann der Vertrag gekündigt ist.',
} as const;

const GUELTIG_AB_TEXT = 'Bitte gib an, ab wann dieser Preis gilt.';

const GUELTIG_SEIT_TEXT = 'Bitte gib an, seit wann der Betrag oben gilt.';

/**
 * Nur Pflichtfelder, zur Bedienung; alles Weitere entscheidet das Backend (ADR 0010). Ohne Datum darf
 * nur ein Preis sein (er gilt ab Vertragsbeginn): zuerst der Betrag, sonst die erste Zeile ohne Datum.
 * „Betrag gilt seit“ braucht es bei weiteren Preisen ohne Vertragsbeginn, sonst ist unklar, wie die
 * Preise zueinander stehen (wie im Design).
 */
export function vertragPruefen(w: VertragWerte): ReadonlyMap<VertragFeld, string> {
  const leer = (Object.keys(PFLICHT_TEXT) as (keyof typeof PFLICHT_TEXT)[]).filter(
    (feld) => !w[feld].trim() && (feld !== 'gekuendigtZum' || w.gekuendigt),
  );
  const fehler = new Map<VertragFeld, string>(leer.map((feld) => [feld, PFLICHT_TEXT[feld]]));
  if (w.preise.length && !w.gueltigSeit && !w.beginn) {
    fehler.set('gueltigSeit', GUELTIG_SEIT_TEXT);
  }
  if (w.anteilProzent.trim() && anteilLesen(w.anteilProzent) === null) {
    fehler.set('anteilProzent', ANTEIL_TEXT);
  }
  let ohneDatum = !w.gueltigSeit;
  w.preise.forEach((preis, i) => {
    if (!preis.gueltigAb) {
      if (ohneDatum) {
        fehler.set(preisFeld(i, 'gueltigAb'), GUELTIG_AB_TEXT);
      }
      ohneDatum = true;
    }
    if (!preis.betrag.trim()) {
      fehler.set(preisFeld(i, 'betrag'), PFLICHT_TEXT.betrag);
    }
  });
  return fehler;
}

/** Wie das Backend ihn speichert, mit Komma und zwei Stellen. */
function betragEingabe({ wert }: Betrag): string {
  return wert.toFixed(2).replace('.', ',');
}

function textOderNull(eingabe: string): string | null {
  return eingabe.trim() || null;
}

/**
 * Vorbelegung zum Bearbeiten. „Nächste Abbuchung“ zeigt den nächsten Termin, nicht den Anker. Welcher
 * Preis heute gilt, sagt das Backend ({@code art}); er steht unter „Betrag“, die übrigen in der Liste.
 */
export function werteAus(v: VertragAntwort): VertragWerte {
  const aktuell = v.preise.find(({ art }) => art === 'AKTUELL');
  return {
    anbieter: v.anbieter,
    bezeichnung: v.bezeichnung ?? '',
    kategorieId: v.kategorie.id,
    vertragsnummer: v.vertragsnummer ?? '',
    betrag: betragEingabe(aktuell?.betrag ?? v.betrag),
    gueltigSeit: aktuell?.gueltigAb ?? '',
    preise: v.preise
      .filter((preis) => preis !== aktuell)
      .map((preis) => ({ gueltigAb: preis.gueltigAb ?? '', betrag: betragEingabe(preis.betrag) })),
    anteilProzent: v.anteilProzent?.toString().replace('.', ',') ?? '',
    zahlweise: v.zahlweise,
    abbuchungAb: v.berechnet.naechsteAbbuchung?.am ?? v.abbuchungAb,
    zahlungsweg: v.zahlungsweg ?? '',
    nichtKuendbar: !v.kuendbar,
    beginn: v.beginn ?? '',
    laufzeitende: v.laufzeitende ?? '',
    verlaengerung: v.verlaengerung ?? '',
    kuendigungsfristMonate: v.kuendigungsfristMonate?.toString() ?? '',
    gekuendigt: !!v.gekuendigtZum,
    gekuendigtZum: v.gekuendigtZum ?? '',
    notiz: v.notiz ?? '',
  };
}

/**
 * Das Backend zählt von diesem Anker aus. Der angezeigte Termin darf ihn nicht versehentlich ersetzen,
 * sonst wandert der Abbuchungstag (31.01. monatlich: aus 30.11. folgt 30.12. statt 31.12.). Neuer
 * Anker ist er also erst, wenn sich Datum oder Zahlweise geändert haben.
 */
function abbuchungAb(w: VertragWerte, gespeichert: VertragAntwort | null): string | null {
  const unveraendert =
    gespeichert &&
    w.zahlweise === gespeichert.zahlweise &&
    w.abbuchungAb === werteAus(gespeichert).abbuchungAb;
  return unveraendert ? gespeichert.abbuchungAb : w.abbuchungAb || null;
}

function preisEingabe(gueltigAb: string, betrag: string, waehrung: string): PreisEingabe {
  const wert = betragLesen(betrag);
  return { gueltigAb: gueltigAb || null, betrag: wert === null ? null : { wert, waehrung } };
}

/**
 * Anfrage aus den Formularwerten. Leere Felder gehen als {@code null}, denn {@code ""} wäre bei Enums
 * und Datum {@code ANFRAGE_UNGUELTIG} ohne Bezug zum Feld, ebenso {@code { wert: null }} beim Betrag.
 * Der Betrag ist der erste Preis, die Liste folgt ({@code preise[i]} der Feldfehler). Felder, die das
 * Formular noch nicht zeigt (Einmalkosten, Preissteigerung), bleiben wie gespeichert, denn
 * {@code PUT} ersetzt alle Felder.
 */
export function anfrageAus(
  w: VertragWerte,
  gespeichert: VertragAntwort | null = null,
): Required<VertragEingabe> {
  const waehrung = gespeichert?.betrag.waehrung ?? 'EUR';
  return {
    anbieter: textOderNull(w.anbieter),
    bezeichnung: textOderNull(w.bezeichnung),
    kategorieId: textOderNull(w.kategorieId),
    vertragsnummer: textOderNull(w.vertragsnummer),
    preise: [
      preisEingabe(w.gueltigSeit, w.betrag, waehrung),
      ...w.preise.map((preis) => preisEingabe(preis.gueltigAb, preis.betrag, waehrung)),
    ],
    zahlweise: w.zahlweise || null,
    abbuchungAb: abbuchungAb(w, gespeichert),
    zahlungsweg: w.zahlungsweg || null,
    kuendbar: !w.nichtKuendbar,
    beginn: w.beginn || null,
    laufzeitende: w.laufzeitende || null,
    verlaengerung: w.nichtKuendbar ? null : w.verlaengerung || null,
    kuendigungsfristMonate:
      w.nichtKuendbar || !w.kuendigungsfristMonate ? null : Number(w.kuendigungsfristMonate),
    gekuendigtZum: w.gekuendigt ? w.gekuendigtZum || null : null,
    notiz: textOderNull(w.notiz),
    anteilProzent: anteilLesen(w.anteilProzent),
    einmalkosten: gespeichert?.einmalkosten ?? [],
    preissteigerung: gespeichert?.preissteigerung ?? null,
    preisgarantieBis: gespeichert?.preisgarantieBis ?? null,
    erinnerungSonderkuendigung: gespeichert?.erinnerungSonderkuendigung ?? true,
  };
}

/**
 * Das ganze Formular für die Vorschau. Preise und ein Anteil, die das Backend sicher ablehnt (ohne
 * Betrag, Betrag nicht größer 0, ein zweiter ohne Datum; Anteil nicht wie „33,3“), fehlen, damit die
 * übrigen Werte beim Tippen bleiben.
 */
export function vorschauAus(
  w: VertragWerte,
  gespeichert: VertragAntwort | null = null,
): VertragVorschauAnfrage {
  const a = anfrageAus(w, gespeichert);
  let ohneDatum = false;
  const preise = a.preise.filter(({ betrag, gueltigAb }) => {
    if (!betrag || betrag.wert <= 0 || (!gueltigAb && ohneDatum)) {
      return false;
    }
    ohneDatum ||= !gueltigAb;
    return true;
  });
  return {
    kuendbar: !w.nichtKuendbar,
    preise,
    anteilProzent: anteilFuerVorschau(w.anteilProzent, a.anteilProzent),
    einmalkosten: a.einmalkosten,
    preissteigerung: a.preissteigerung,
    preisgarantieBis: a.preisgarantieBis,
    zahlweise: a.zahlweise,
    abbuchungAb: a.abbuchungAb,
    beginn: a.beginn,
    laufzeitende: a.laufzeitende,
    verlaengerung: a.verlaengerung,
    kuendigungsfristMonate: a.kuendigungsfristMonate,
    gekuendigtZum: a.gekuendigtZum,
  };
}

const FELD_ZUM_API_FELD: Readonly<Record<string, VertragFeld>> = {
  anbieter: 'anbieter',
  bezeichnung: 'bezeichnung',
  kategorieId: 'kategorieId',
  vertragsnummer: 'vertragsnummer',
  preise: 'betrag',
  zahlweise: 'zahlweise',
  abbuchungAb: 'abbuchungAb',
  zahlungsweg: 'zahlungsweg',
  kuendbar: 'nichtKuendbar',
  beginn: 'beginn',
  laufzeitende: 'laufzeitende',
  verlaengerung: 'verlaengerung',
  kuendigungsfristMonate: 'kuendigungsfristMonate',
  gekuendigtZum: 'gekuendigtZum',
  notiz: 'notiz',
  anteilProzent: 'anteilProzent',
};

const PREIS_MUSTER = /^preise\[(\d+)\]\.(gueltigAb|betrag)\b/;

/** {@code preise[0]} ist der Betrag, {@code preise[i]} sonst die Zeile i − 1 der Liste. */
function formularFeld(apiFeld: string): VertragFeld | undefined {
  const preis = PREIS_MUSTER.exec(apiFeld);
  if (!preis) {
    return FELD_ZUM_API_FELD[apiFeld];
  }
  const index = Number(preis[1]);
  const teil = preis[2] as keyof PreisWerte;
  if (index > 0) {
    return preisFeld(index - 1, teil);
  }
  return teil === 'betrag' ? 'betrag' : 'gueltigSeit';
}

function istBetrag(feld: VertragFeld): boolean {
  return feld === 'betrag' || feld.endsWith('.betrag');
}

function feldfehlerText(feld: VertragFeld, { feld: apiFeld, code, parameter }: Feldfehler): string {
  if (feld === 'anteilProzent' && ['DecimalMin', 'DecimalMax', 'Digits'].includes(code)) {
    return ANTEIL_TEXT;
  }
  switch (code) {
    case 'NotBlank':
    case 'NotNull':
    case 'NotEmpty':
      if (istBetrag(feld)) {
        return PFLICHT_TEXT.betrag;
      }
      return feld in PFLICHT_TEXT
        ? PFLICHT_TEXT[feld as keyof typeof PFLICHT_TEXT]
        : 'Bitte fülle dieses Feld aus.';
    case 'Size':
      return apiFeld === 'preise'
        ? `Höchstens ${parameter['max']} Preise.`
        : `Höchstens ${parameter['max']} Zeichen.`;
    case 'GueltigAbPflicht':
      return feld === 'gueltigSeit' ? GUELTIG_SEIT_TEXT : GUELTIG_AB_TEXT;
    case 'GueltigAbEindeutig':
      return 'Für dieses Datum gibt es schon einen Preis.';
    case 'PreisNichtVorBeginn':
      return 'Ein Preis kann nicht vor dem Vertragsbeginn gelten.';
    case 'GleicheWaehrung':
      return 'Alle Preise brauchen dieselbe Währung.';
    case 'PositiverBetrag':
      return 'Der Betrag muss größer als 0 sein.';
    case 'Digits':
      return `Höchstens ${parameter['fraction']} Nachkommastellen.`;
    case 'ErlaubteWaehrung':
      return 'Diese Währung ist nicht möglich.';
    case 'Unbekannt':
      return 'Diese Kategorie gibt es nicht mehr. Bitte wähle eine andere.';
    case 'LaufzeitendeNachBeginn':
      return 'Das Laufzeitende liegt vor dem Vertragsbeginn.';
    case 'PlausiblesDatum':
      return 'Bitte gib ein Datum zwischen dem 01.01.1900 und dem 31.12.2199 ein.';
    case 'Min':
      return `Mindestens ${parameter['value']} Monate.`;
    case 'Max':
      return `Höchstens ${parameter['value']} Monate.`;
    default:
      return 'Bitte prüfe diese Eingabe.';
  }
}

/** Texte je Formularfeld; Fehler ohne passendes Feld fehlen. Hat ein Feld mehrere, gilt der erste. */
export function feldfehlerTexte(felder: Feldfehler[]): ReadonlyMap<VertragFeld, string> {
  const texte = new Map<VertragFeld, string>();
  for (const fehler of felder) {
    const feld = fehler.feld ? formularFeld(fehler.feld) : undefined;
    if (feld && !texte.has(feld)) {
      texte.set(feld, feldfehlerText(feld, fehler));
    }
  }
  return texte;
}
