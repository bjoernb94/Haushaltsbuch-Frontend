import {
  Feldfehler,
  Verlaengerung,
  VertragAntwort,
  VertragWiederaufnahme,
} from '../../../../core/api/api';
import { datumText } from '../../../../shared/format/datum.pipe';
import { betragLesen } from '../vertrag-pruefung';

/** Werte der Felder im Dialog „Wieder aufnehmen“, unverändert wie eingegeben. */
export interface WiederaufnahmeWerte {
  datum: string;
  verlaengerung: Verlaengerung | '';
  laufzeitende: string;
  kuendigungsfristMonate: string;
  /** Leer, wenn sich der Preis nicht ändert. */
  betrag: string;
}

export type WiederaufnahmeFeld = keyof WiederaufnahmeWerte;

const PFLICHT_TEXT = {
  datum: 'Bitte gib das Datum der Wiederaufnahme ein.',
  verlaengerung: 'Bitte wähle, wie sich der Vertrag verlängert.',
} as const;

const BETRAG_TEXT = 'Bitte gib einen gültigen Betrag ein, z. B. 13,99.';

const PLAUSIBLES_DATUM_TEXT = 'Bitte gib ein Datum zwischen dem 01.01.1900 und dem 31.12.2199 ein.';

/**
 * Vorbelegung: Datum aus {@code berechnet.wiederaufnahme.vorschlag}, Verlängerung und Frist wie
 * bisher (ohne Verlängerung, {@code KEINE}, bleibt sie leer), kein Laufzeitende, kein neuer Betrag.
 */
export function wiederaufnahmeWerte(v: VertragAntwort): WiederaufnahmeWerte {
  return {
    datum: v.berechnet.wiederaufnahme?.vorschlag ?? '',
    verlaengerung: v.verlaengerung === 'KEINE' ? '' : (v.verlaengerung ?? ''),
    laufzeitende: '',
    kuendigungsfristMonate: v.kuendigungsfristMonate?.toString() ?? '',
    betrag: '',
  };
}

/**
 * Nur Pflichtfelder und ein lesbarer Betrag, zur Bedienung; ob Datum und Laufzeit passen, entscheidet
 * das Backend (ADR 0010). Bei nicht kündbaren Verträgen gibt es keine Laufzeit.
 */
export function wiederaufnahmePruefen(
  w: WiederaufnahmeWerte,
  kuendbar: boolean,
): ReadonlyMap<WiederaufnahmeFeld, string> {
  const fehler = new Map<WiederaufnahmeFeld, string>();
  if (!w.datum) {
    fehler.set('datum', PFLICHT_TEXT.datum);
  }
  if (kuendbar && !w.verlaengerung) {
    fehler.set('verlaengerung', PFLICHT_TEXT.verlaengerung);
  }
  if (w.betrag.trim() && betragLesen(w.betrag) === null) {
    fehler.set('betrag', BETRAG_TEXT);
  }
  return fehler;
}

/**
 * Anfrage aus den Werten. Bei nicht kündbaren Verträgen fehlt die Laufzeit (auch das Laufzeitende,
 * der Dialog zeigt es nicht); der Betrag in der Währung der Preise.
 */
export function wiederaufnahmeAnfrage(
  w: WiederaufnahmeWerte,
  v: VertragAntwort,
): VertragWiederaufnahme {
  const wert = w.betrag.trim() ? betragLesen(w.betrag) : null;
  return {
    version: v.version,
    datum: w.datum,
    laufzeitende: v.kuendbar ? w.laufzeitende || null : null,
    verlaengerung: v.kuendbar ? w.verlaengerung || null : null,
    kuendigungsfristMonate:
      v.kuendbar && w.kuendigungsfristMonate ? Number(w.kuendigungsfristMonate) : null,
    betrag: wert === null ? null : { wert, waehrung: v.betrag.waehrung },
  };
}

const FELD_ZUM_API_FELD: Readonly<Record<string, WiederaufnahmeFeld>> = {
  datum: 'datum',
  verlaengerung: 'verlaengerung',
  laufzeitende: 'laufzeitende',
  kuendigungsfristMonate: 'kuendigungsfristMonate',
  betrag: 'betrag',
  'betrag.wert': 'betrag',
  'betrag.waehrung': 'betrag',
};

function feldfehlerText(feld: WiederaufnahmeFeld, { code, parameter }: Feldfehler): string {
  switch (code) {
    case 'NotNull':
      if (feld === 'betrag') {
        return BETRAG_TEXT;
      }
      return feld in PFLICHT_TEXT
        ? PFLICHT_TEXT[feld as keyof typeof PFLICHT_TEXT]
        : 'Bitte fülle dieses Feld aus.';
    case 'NachVertragsende':
      return `Das Datum muss nach dem Vertragsende (${datumText(String(parameter['vertragsende']))}) liegen.`;
    case 'PlausiblesDatum':
      return PLAUSIBLES_DATUM_TEXT;
    case 'LaufzeitendeBeiEnde':
      return 'Ohne Laufzeitende kann der Vertrag nicht zum Laufzeitende enden.';
    case 'LaufzeitendeNachBeginn':
      return 'Das Laufzeitende liegt vor der Wiederaufnahme.';
    case 'Min':
      return `Mindestens ${parameter['value']} Monate.`;
    case 'Max':
      return `Höchstens ${parameter['value']} Monate.`;
    case 'PositiverBetrag':
      return 'Der Betrag muss größer als 0 sein.';
    case 'Digits':
      return `Höchstens ${parameter['fraction']} Nachkommastellen.`;
    case 'GueltigAbEindeutig':
      return 'Für dieses Datum gibt es schon einen Preis. Trag die Änderung im Tab Preisverlauf ein.';
    case 'GleicheWaehrung':
      return 'Der Betrag braucht dieselbe Währung wie die Preise.';
    default:
      return 'Bitte prüfe diese Eingabe.';
  }
}

/** Texte je Feld; Fehler ohne passendes Feld fehlen. Hat ein Feld mehrere, gilt der erste. */
export function wiederaufnahmeFehlerTexte(
  felder: Feldfehler[],
): ReadonlyMap<WiederaufnahmeFeld, string> {
  const texte = new Map<WiederaufnahmeFeld, string>();
  for (const fehler of felder) {
    const feld = fehler.feld ? FELD_ZUM_API_FELD[fehler.feld] : undefined;
    if (feld && !texte.has(feld)) {
      texte.set(feld, feldfehlerText(feld, fehler));
    }
  }
  return texte;
}
