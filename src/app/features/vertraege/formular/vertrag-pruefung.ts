import {
  Betrag,
  Erhoehungsrhythmus,
  Feldfehler,
  Steigerungsart,
  Verlaengerung,
  VertragAntwort,
  VertragVorschauAnfrage,
  Zahlungsweg,
  Zahlweise,
} from '../../../core/api/api';
import {
  EinmalkostenEingabe,
  PreisEingabe,
  PreissteigerungEingabe,
  VertragEingabe,
} from '../vertrag.service';

/** Eine Zeile der Liste „Preise“ nach dem Betrag ab Vertragsbeginn. */
export interface PreisWerte {
  gueltigAb: string;
  betrag: string;
  /**
   * Vom Backend aus der Preissteigerung angelegt; geht unverändert zurück, ob es bleibt, entscheidet
   * das Backend (ADR 0022).
   */
  automatisch: boolean;
}

/** Die Eingabefelder einer Preiszeile, an denen Fehler stehen können. */
export type PreisEingabeFeld = Exclude<keyof PreisWerte, 'automatisch'>;

/** Eine Zeile der Einmalkosten. */
export interface EinmalkostenWerte {
  bezeichnung: string;
  betrag: string;
  faelligAm: string;
}

/** Werte der Formularfelder, unverändert wie eingegeben. */
export interface VertragWerte {
  anbieter: string;
  bezeichnung: string;
  kategorieId: string;
  vertragsnummer: string;
  /** Der erste Preis; er gilt ab {@link beginn}. */
  betrag: string;
  /** Alle späteren Preise, in der Reihenfolge der Antwort bzw. der Eingabe. */
  preise: PreisWerte[];
  /** Leer = 100 %. */
  anteilProzent: string;
  zahlweise: Zahlweise | '';
  beginn: string;
  zahlungsweg: Zahlungsweg | '';
  nichtKuendbar: boolean;
  laufzeitende: string;
  verlaengerung: Verlaengerung | '';
  kuendigungsfristMonate: string;
  gekuendigt: boolean;
  gekuendigtZum: string;
  notiz: string;
  /** In der Reihenfolge der Antwort bzw. der Eingabe. */
  einmalkosten: EinmalkostenWerte[];
  preisgarantieBis: string;
  /** Schalter „Preis steigt regelmäßig“; aus, gehen die Felder darunter nicht mit. */
  steigt: boolean;
  steigerungsart: Steigerungsart;
  /** Prozent oder Betrag, je nach {@link steigerungsart}. */
  steigerungswert: string;
  rhythmus: Erhoehungsrhythmus;
  naechsteErhoehungAm: string;
  erinnerungSonderkuendigung: boolean;
}

/** {@code einmalkosten} steht für Fehler an der ganzen Liste, z. B. zu viele Einträge. */
export type EinzelFeld = Exclude<keyof VertragWerte, 'preise'>;

/** Feld einer Zeile der Preisliste, z. B. {@code preise.0.gueltigAb}. */
export type PreisFeld = `preise.${number}.${PreisEingabeFeld}`;

/** Feld einer Zeile der Einmalkosten, z. B. {@code einmalkosten.0.faelligAm}. */
export type EinmalkostenFeld = `einmalkosten.${number}.${keyof EinmalkostenWerte}`;

export type VertragFeld = EinzelFeld | PreisFeld | EinmalkostenFeld;

export function preisFeld(index: number, feld: PreisEingabeFeld): PreisFeld {
  return `preise.${index}.${feld}`;
}

export function einmalkostenFeld(index: number, feld: keyof EinmalkostenWerte): EinmalkostenFeld {
  return `einmalkosten.${index}.${feld}`;
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
const PROZENT_MUSTER = /^\d+(,\d+)?$/;

// Wie das Backend (1 bis 100, höchstens eine Nachkommastelle); nur damit die Vorschau nicht scheitert.
const ANTEIL_VORSCHAU = /^\d{1,3}(,\d)?$/;

function anteilFuerVorschau(eingabe: string, anteil: number | null): number | null {
  return ANTEIL_VORSCHAU.test(eingabe.trim()) && anteil !== null && anteil >= 1 && anteil <= 100
    ? anteil
    : null;
}

const ANTEIL_TEXT = 'Bitte eine Zahl von 1 bis 100 mit höchstens einer Nachkommastelle.';

/**
 * Liest Prozent mit Komma (Anteil, Erhöhung), {@code null} wenn das nicht geht. Grenzen prüft das
 * Backend.
 */
export function prozentLesen(eingabe: string): number | null {
  const text = eingabe.trim();
  return PROZENT_MUSTER.test(text) ? Number(text.replace(',', '.')) : null;
}

// Wie das Backend (größer 0, höchstens 100, zwei Nachkommastellen); nur damit die Vorschau nicht scheitert.
const ERHOEHUNG_VORSCHAU = /^\d{1,3}(,\d{1,2})?$/;

const ERHOEHUNG_TEXT = 'Bitte eine Zahl größer 0 bis 100 mit höchstens zwei Nachkommastellen.';

const PFLICHT_TEXT = {
  anbieter: 'Bitte gib den Anbieter ein.',
  kategorieId: 'Bitte wähle eine Kategorie.',
  betrag: 'Bitte gib einen gültigen Betrag ein, z. B. 19,99.',
  zahlweise: 'Bitte wähle die Zahlweise.',
  beginn: 'Bitte gib an, wann der Vertrag beginnt.',
  gekuendigtZum: 'Bitte gib an, zu wann der Vertrag gekündigt ist.',
} as const;

const EINMALKOSTEN_PFLICHT_TEXT: Readonly<Record<keyof EinmalkostenWerte, string>> = {
  bezeichnung: 'Bitte gib an, wofür die Kosten anfallen.',
  betrag: PFLICHT_TEXT.betrag,
  faelligAm: 'Bitte gib an, wann die Kosten fällig sind.',
};

const STEIGERUNG_PFLICHT_TEXT = {
  steigerungswert: 'Bitte gib an, um wie viel der Preis steigt.',
  naechsteErhoehungAm: 'Bitte gib an, wann der Preis zum ersten Mal steigt.',
} as const;

const GUELTIG_AB_TEXT = 'Bitte gib an, ab wann dieser Preis gilt.';

const ERSTER_PREIS_TEXT = 'Der früheste Preis muss ab Vertragsbeginn gelten.';

/** Leer oder nicht eindeutig lesbar: Das Backend bekäme {@code betrag: null}. */
function betragFehlt(eingabe: string): boolean {
  return betragLesen(eingabe) === null;
}

/**
 * Nur Pflichtfelder und lesbare Beträge, zur Bedienung; alles Weitere entscheidet das Backend
 * (ADR 0010). Jeder spätere Preis braucht ein Datum, der erste gilt ab Vertragsbeginn.
 */
export function vertragPruefen(w: VertragWerte): ReadonlyMap<VertragFeld, string> {
  const leer = (Object.keys(PFLICHT_TEXT) as (keyof typeof PFLICHT_TEXT)[]).filter((feld) =>
    feld === 'betrag'
      ? betragFehlt(w.betrag)
      : !w[feld].trim() && (feld !== 'gekuendigtZum' || w.gekuendigt),
  );
  const fehler = new Map<VertragFeld, string>(leer.map((feld) => [feld, PFLICHT_TEXT[feld]]));
  if (w.anteilProzent.trim() && prozentLesen(w.anteilProzent) === null) {
    fehler.set('anteilProzent', ANTEIL_TEXT);
  }
  w.preise.forEach((preis, i) => {
    if (!preis.gueltigAb) {
      fehler.set(preisFeld(i, 'gueltigAb'), GUELTIG_AB_TEXT);
    }
    if (betragFehlt(preis.betrag)) {
      fehler.set(preisFeld(i, 'betrag'), PFLICHT_TEXT.betrag);
    }
  });
  if (w.steigt) {
    for (const feld of Object.keys(
      STEIGERUNG_PFLICHT_TEXT,
    ) as (keyof typeof STEIGERUNG_PFLICHT_TEXT)[]) {
      if (!w[feld].trim()) {
        fehler.set(feld, STEIGERUNG_PFLICHT_TEXT[feld]);
      }
    }
    if (
      w.steigerungsart === 'BETRAG' &&
      w.steigerungswert.trim() &&
      betragFehlt(w.steigerungswert)
    ) {
      fehler.set('steigerungswert', PFLICHT_TEXT.betrag);
    }
  }
  w.einmalkosten.forEach((zeile, i) => {
    for (const feld of Object.keys(EINMALKOSTEN_PFLICHT_TEXT) as (keyof EinmalkostenWerte)[]) {
      if (feld === 'betrag' ? betragFehlt(zeile.betrag) : !zeile[feld].trim()) {
        fehler.set(einmalkostenFeld(i, feld), EINMALKOSTEN_PFLICHT_TEXT[feld]);
      }
    }
  });
  return fehler;
}

/** Wie das Backend ihn speichert, mit Komma und zwei Stellen. */
export function betragEingabe({ wert }: Betrag): string {
  return wert.toFixed(2).replace('.', ',');
}

function textOderNull(eingabe: string): string | null {
  return eingabe.trim() || null;
}

/**
 * Vorbelegung zum Bearbeiten. Das Backend sortiert die Preise nach Datum, der erste gilt ab Vertragsbeginn;
 * er steht unter „Betrag“, die übrigen in der Liste.
 */
export function werteAus(v: VertragAntwort): VertragWerte {
  const [erster, ...spaetere] = v.preise;
  return {
    anbieter: v.anbieter,
    bezeichnung: v.bezeichnung ?? '',
    kategorieId: v.kategorie.id,
    vertragsnummer: v.vertragsnummer ?? '',
    betrag: betragEingabe(erster?.betrag ?? v.betrag),
    preise: spaetere.map((preis) => ({
      gueltigAb: preis.gueltigAb,
      betrag: betragEingabe(preis.betrag),
      automatisch: preis.automatisch,
    })),
    anteilProzent: v.anteilProzent?.toString().replace('.', ',') ?? '',
    zahlweise: v.zahlweise,
    beginn: v.beginn,
    zahlungsweg: v.zahlungsweg ?? '',
    nichtKuendbar: !v.kuendbar,
    laufzeitende: v.laufzeitende ?? '',
    verlaengerung: v.verlaengerung ?? '',
    kuendigungsfristMonate: v.kuendigungsfristMonate?.toString() ?? '',
    gekuendigt: !!v.gekuendigtZum,
    gekuendigtZum: v.gekuendigtZum ?? '',
    notiz: v.notiz ?? '',
    einmalkosten: v.einmalkosten.map((zeile) => ({
      bezeichnung: zeile.bezeichnung,
      betrag: betragEingabe(zeile.betrag),
      faelligAm: zeile.faelligAm,
    })),
    preisgarantieBis: v.preisgarantieBis ?? '',
    ...steigerungWerte(v.preissteigerung),
    erinnerungSonderkuendigung: v.erinnerungSonderkuendigung,
  };
}

type SteigerungWerte = Pick<
  VertragWerte,
  'steigt' | 'steigerungsart' | 'steigerungswert' | 'rhythmus' | 'naechsteErhoehungAm'
>;

/** Ohne Regel wie im Design: Prozent, jährlich. */
export const OHNE_STEIGERUNG: SteigerungWerte = {
  steigt: false,
  steigerungsart: 'PROZENT',
  steigerungswert: '',
  rhythmus: 'JAEHRLICH',
  naechsteErhoehungAm: '',
};

function steigerungWerte(regel: VertragAntwort['preissteigerung']): SteigerungWerte {
  if (!regel) {
    return OHNE_STEIGERUNG;
  }
  return {
    steigt: true,
    steigerungsart: regel.art,
    steigerungswert:
      regel.art === 'PROZENT'
        ? (regel.prozent?.toString().replace('.', ',') ?? '')
        : regel.betrag
          ? betragEingabe(regel.betrag)
          : '',
    rhythmus: regel.rhythmus,
    naechsteErhoehungAm: regel.naechsteAm,
  };
}

function preisEingabe(
  gueltigAb: string,
  betrag: string,
  waehrung: string,
  automatisch = false,
): PreisEingabe {
  const wert = betragLesen(betrag);
  return {
    gueltigAb: gueltigAb || null,
    betrag: wert === null ? null : { wert, waehrung },
    // Nur gesetzt, wenn die Antwort es so lieferte; fehlt es, zählt es als eingetragen.
    ...(automatisch && { automatisch }),
  };
}

function einmalkostenEingabe(zeile: EinmalkostenWerte, waehrung: string): EinmalkostenEingabe {
  const wert = betragLesen(zeile.betrag);
  return {
    bezeichnung: textOderNull(zeile.bezeichnung),
    betrag: wert === null ? null : { wert, waehrung },
    faelligAm: zeile.faelligAm || null,
  };
}

/** Zur Art nur der passende Wert, der andere {@code null} (sonst {@code PassenderWert}). */
function steigerungEingabe(w: VertragWerte, waehrung: string): PreissteigerungEingabe | null {
  if (!w.steigt) {
    return null;
  }
  const betrag = w.steigerungsart === 'BETRAG' ? betragLesen(w.steigerungswert) : null;
  return {
    art: w.steigerungsart,
    prozent: w.steigerungsart === 'PROZENT' ? prozentLesen(w.steigerungswert) : null,
    betrag: betrag === null ? null : { wert: betrag, waehrung },
    rhythmus: w.rhythmus,
    naechsteAm: w.naechsteErhoehungAm || null,
  };
}

/**
 * Anfrage aus den Formularwerten. Leere Felder gehen als {@code null}, denn {@code ""} wäre bei Enums
 * und Datum {@code ANFRAGE_UNGUELTIG} ohne Bezug zum Feld, ebenso {@code { wert: null }} beim Betrag.
 * Der Betrag ist der erste Preis und gilt ab Vertragsbeginn, die Liste folgt ({@code preise[i]} der
 * Feldfehler).
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
      preisEingabe(w.beginn, w.betrag, waehrung),
      ...w.preise.map((preis) =>
        preisEingabe(preis.gueltigAb, preis.betrag, waehrung, preis.automatisch),
      ),
    ],
    zahlweise: w.zahlweise || null,
    beginn: w.beginn || null,
    zahlungsweg: w.zahlungsweg || null,
    kuendbar: !w.nichtKuendbar,
    laufzeitende: w.laufzeitende || null,
    verlaengerung: w.nichtKuendbar ? null : w.verlaengerung || null,
    kuendigungsfristMonate:
      w.nichtKuendbar || !w.kuendigungsfristMonate ? null : Number(w.kuendigungsfristMonate),
    gekuendigtZum: w.gekuendigt ? w.gekuendigtZum || null : null,
    notiz: textOderNull(w.notiz),
    anteilProzent: prozentLesen(w.anteilProzent),
    einmalkosten: w.einmalkosten.map((zeile) => einmalkostenEingabe(zeile, waehrung)),
    preissteigerung: steigerungEingabe(w, waehrung),
    preisgarantieBis: w.preisgarantieBis || null,
    erinnerungSonderkuendigung: w.erinnerungSonderkuendigung,
  };
}

/** Ein Wert, den das Backend sicher ablehnt, fehlt; die Vorschau übergeht die Regel dann. */
function steigerungFuerVorschau(
  w: VertragWerte,
  regel: PreissteigerungEingabe | null,
): PreissteigerungEingabe | null {
  if (!regel) {
    return null;
  }
  const prozent =
    regel.prozent != null &&
    ERHOEHUNG_VORSCHAU.test(w.steigerungswert.trim()) &&
    regel.prozent > 0 &&
    regel.prozent <= 100
      ? regel.prozent
      : null;
  const betrag = regel.betrag && regel.betrag.wert > 0 ? regel.betrag : null;
  return { ...regel, prozent, betrag };
}

/**
 * Das ganze Formular für die Vorschau. Preise, Einmalkosten, ein Anteil und eine Erhöhung, die das
 * Backend sicher ablehnt (ohne Betrag, Betrag nicht größer 0, ein Preis vor dem Beginn; Anteil nicht
 * wie „33,3“, Prozent nicht wie „2,75“ oder über 100), fehlen, damit die übrigen Werte beim Tippen
 * bleiben. Fehlt der erste Preis, fehlen alle: Sonst wäre ein späterer der früheste und verstieße
 * gegen {@code ErsterPreisAbBeginn}. Unvollständige Zeilen (auch ohne Datum) und Regeln ignoriert die
 * Vorschau selbst.
 */
export function vorschauAus(
  w: VertragWerte,
  gespeichert: VertragAntwort | null = null,
): VertragVorschauAnfrage {
  const a = anfrageAus(w, gespeichert);
  const brauchbar = ({ betrag }: PreisEingabe) => !!betrag && betrag.wert > 0;
  const preise = brauchbar(a.preise[0])
    ? a.preise.filter(
        (preis) => brauchbar(preis) && !(preis.gueltigAb && a.beginn && preis.gueltigAb < a.beginn),
      )
    : [];
  return {
    kuendbar: !w.nichtKuendbar,
    preise,
    anteilProzent: anteilFuerVorschau(w.anteilProzent, a.anteilProzent),
    einmalkosten: a.einmalkosten.filter(({ betrag }) => !betrag || betrag.wert > 0),
    preissteigerung: steigerungFuerVorschau(w, a.preissteigerung),
    preisgarantieBis: a.preisgarantieBis,
    zahlweise: a.zahlweise,
    beginn: a.beginn,
    laufzeitende: a.laufzeitende,
    verlaengerung: a.verlaengerung,
    kuendigungsfristMonate: a.kuendigungsfristMonate,
    gekuendigtZum: a.gekuendigtZum,
    // Unverändert aus der Antwort, damit gelöschte Stufen in der Vorschau nicht wieder entstehen.
    preissteigerungBetrachtetBis: gespeichert?.preissteigerungBetrachtetBis ?? null,
  };
}

const FELD_ZUM_API_FELD: Readonly<Record<string, VertragFeld>> = {
  anbieter: 'anbieter',
  bezeichnung: 'bezeichnung',
  kategorieId: 'kategorieId',
  vertragsnummer: 'vertragsnummer',
  preise: 'betrag',
  zahlweise: 'zahlweise',
  beginn: 'beginn',
  zahlungsweg: 'zahlungsweg',
  kuendbar: 'nichtKuendbar',
  laufzeitende: 'laufzeitende',
  verlaengerung: 'verlaengerung',
  kuendigungsfristMonate: 'kuendigungsfristMonate',
  gekuendigtZum: 'gekuendigtZum',
  notiz: 'notiz',
  anteilProzent: 'anteilProzent',
  einmalkosten: 'einmalkosten',
  preisgarantieBis: 'preisgarantieBis',
  'preissteigerung.art': 'steigerungsart',
  'preissteigerung.prozent': 'steigerungswert',
  'preissteigerung.betrag': 'steigerungswert',
  'preissteigerung.betrag.wert': 'steigerungswert',
  'preissteigerung.betrag.waehrung': 'steigerungswert',
  'preissteigerung.rhythmus': 'rhythmus',
  'preissteigerung.naechsteAm': 'naechsteErhoehungAm',
};

const PREIS_MUSTER = /^preise\[(\d+)\]\.(gueltigAb|betrag)\b/;

const EINMALKOSTEN_MUSTER = /^einmalkosten\[(\d+)\]\.(bezeichnung|betrag|faelligAm)\b/;

/**
 * {@code preise[0]} ist der Betrag, sein Datum der Vertragsbeginn; {@code preise[i]} sonst die Zeile
 * i − 1 der Liste. {@code einmalkosten[i]} ist die Zeile i.
 */
function formularFeld(apiFeld: string): VertragFeld | undefined {
  const einmal = EINMALKOSTEN_MUSTER.exec(apiFeld);
  if (einmal) {
    return einmalkostenFeld(Number(einmal[1]), einmal[2] as keyof EinmalkostenWerte);
  }
  const preis = PREIS_MUSTER.exec(apiFeld);
  if (!preis) {
    return FELD_ZUM_API_FELD[apiFeld];
  }
  const index = Number(preis[1]);
  const teil = preis[2] as PreisEingabeFeld;
  if (index > 0) {
    return preisFeld(index - 1, teil);
  }
  return teil === 'betrag' ? 'betrag' : 'beginn';
}

function istBetrag(feld: VertragFeld): boolean {
  return feld === 'betrag' || feld.endsWith('.betrag');
}

/** Der Teil nach der Zeile, z. B. {@code faelligAm}; {@code null} außerhalb der Einmalkosten. */
function einmalkostenTeil(feld: VertragFeld): keyof EinmalkostenWerte | null {
  return feld.startsWith('einmalkosten.') ? (feld.split('.')[2] as keyof EinmalkostenWerte) : null;
}

function feldfehlerText(feld: VertragFeld, { feld: apiFeld, code, parameter }: Feldfehler): string {
  const einmal = einmalkostenTeil(feld);
  if (feld === 'anteilProzent' && ['DecimalMin', 'DecimalMax', 'Digits'].includes(code)) {
    return ANTEIL_TEXT;
  }
  if (
    apiFeld === 'preissteigerung.prozent' &&
    ['DecimalMin', 'DecimalMax', 'Digits'].includes(code)
  ) {
    return ERHOEHUNG_TEXT;
  }
  switch (code) {
    case 'NotBlank':
    case 'NotNull':
    case 'NotEmpty':
      if (einmal) {
        return EINMALKOSTEN_PFLICHT_TEXT[einmal];
      }
      if (feld in STEIGERUNG_PFLICHT_TEXT) {
        return STEIGERUNG_PFLICHT_TEXT[feld as keyof typeof STEIGERUNG_PFLICHT_TEXT];
      }
      if (istBetrag(feld)) {
        return PFLICHT_TEXT.betrag;
      }
      if (feld.endsWith('.gueltigAb')) {
        return GUELTIG_AB_TEXT;
      }
      return feld in PFLICHT_TEXT
        ? PFLICHT_TEXT[feld as keyof typeof PFLICHT_TEXT]
        : 'Bitte fülle dieses Feld aus.';
    case 'Size':
      if (apiFeld === 'preise') {
        return `Höchstens ${parameter['max']} Preise.`;
      }
      return apiFeld === 'einmalkosten'
        ? `Höchstens ${parameter['max']} Einmalkosten.`
        : `Höchstens ${parameter['max']} Zeichen.`;
    case 'ErsterPreisAbBeginn':
      return ERSTER_PREIS_TEXT;
    case 'GueltigAbEindeutig':
      return 'Für dieses Datum gibt es schon einen Preis.';
    case 'PreisNichtVorBeginn':
      return 'Ein Preis kann nicht vor dem Vertragsbeginn gelten.';
    case 'GleicheWaehrung':
      if (feld === 'steigerungswert') {
        return 'Die Erhöhung braucht dieselbe Währung wie die Preise.';
      }
      return einmal
        ? 'Einmalkosten brauchen dieselbe Währung wie die Preise.'
        : 'Alle Preise brauchen dieselbe Währung.';
    case 'PassenderWert':
      return STEIGERUNG_PFLICHT_TEXT.steigerungswert;
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
