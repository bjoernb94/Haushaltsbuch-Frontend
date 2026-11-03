import { Feldfehler, Verlaengerung, Zahlungsweg, Zahlweise } from '../../../core/api/api';
import { VertragEingabe } from '../vertrag.service';

/** Werte der Formularfelder, unverändert wie eingegeben. */
export interface VertragWerte {
  anbieter: string;
  bezeichnung: string;
  kategorieId: string;
  vertragsnummer: string;
  betrag: string;
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

export type VertragFeld = keyof VertragWerte;

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

const PFLICHT_TEXT = {
  anbieter: 'Bitte gib den Anbieter ein.',
  kategorieId: 'Bitte wähle eine Kategorie.',
  betrag: 'Bitte gib einen gültigen Betrag ein, z. B. 19,99.',
  zahlweise: 'Bitte wähle die Zahlweise.',
  abbuchungAb: 'Bitte gib das Datum der nächsten Abbuchung ein.',
  gekuendigtZum: 'Bitte gib an, zu wann der Vertrag gekündigt ist.',
} as const;

/** Nur Pflichtfelder, zur Bedienung; alles Weitere entscheidet das Backend (ADR 0010). */
export function vertragPruefen(w: VertragWerte): ReadonlyMap<VertragFeld, string> {
  const leer = (Object.keys(PFLICHT_TEXT) as (keyof typeof PFLICHT_TEXT)[]).filter(
    (feld) => !w[feld].trim() && (feld !== 'gekuendigtZum' || w.gekuendigt),
  );
  return new Map(leer.map((feld) => [feld, PFLICHT_TEXT[feld]]));
}

function textOderNull(eingabe: string): string | null {
  return eingabe.trim() || null;
}

/**
 * Anfrage aus den Formularwerten. Leere Felder gehen als {@code null}, denn {@code ""} wäre bei Enums
 * und Datum {@code ANFRAGE_UNGUELTIG} ohne Bezug zum Feld, ebenso {@code { wert: null }} beim Betrag.
 */
export function anfrageAus(w: VertragWerte): Required<VertragEingabe> {
  const wert = betragLesen(w.betrag);
  return {
    anbieter: textOderNull(w.anbieter),
    bezeichnung: textOderNull(w.bezeichnung),
    kategorieId: textOderNull(w.kategorieId),
    vertragsnummer: textOderNull(w.vertragsnummer),
    betrag: wert === null ? null : { wert, waehrung: 'EUR' },
    zahlweise: w.zahlweise || null,
    abbuchungAb: w.abbuchungAb || null,
    zahlungsweg: w.zahlungsweg || null,
    kuendbar: !w.nichtKuendbar,
    beginn: w.beginn || null,
    laufzeitende: w.laufzeitende || null,
    verlaengerung: w.nichtKuendbar ? null : w.verlaengerung || null,
    kuendigungsfristMonate:
      w.nichtKuendbar || !w.kuendigungsfristMonate ? null : Number(w.kuendigungsfristMonate),
    gekuendigtZum: w.gekuendigt ? w.gekuendigtZum || null : null,
    notiz: textOderNull(w.notiz),
  };
}

const FELD_ZUM_API_FELD: Readonly<Record<string, VertragFeld>> = {
  anbieter: 'anbieter',
  bezeichnung: 'bezeichnung',
  kategorieId: 'kategorieId',
  vertragsnummer: 'vertragsnummer',
  betrag: 'betrag',
  'betrag.wert': 'betrag',
  'betrag.waehrung': 'betrag',
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
};

function feldfehlerText(feld: VertragFeld, { code, parameter }: Feldfehler): string {
  switch (code) {
    case 'NotBlank':
    case 'NotNull':
      return feld in PFLICHT_TEXT
        ? PFLICHT_TEXT[feld as keyof typeof PFLICHT_TEXT]
        : 'Bitte fülle dieses Feld aus.';
    case 'Size':
      return `Höchstens ${parameter['max']} Zeichen.`;
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
    const feld = fehler.feld ? FELD_ZUM_API_FELD[fehler.feld] : undefined;
    if (feld && !texte.has(feld)) {
      texte.set(feld, feldfehlerText(feld, fehler));
    }
  }
  return texte;
}
