import {
  Kuendigung,
  Kuendigungsart,
  Verlaengerung,
  VertragKategorieAntwort,
  VertragKategorieSchluessel,
  Zahlungsweg,
  Zahlweise,
} from '../../core/api/api';
import { datumText } from '../../shared/format/datum.pipe';

// Texte je Code, wie im Design. Record stellt sicher, dass kein Code vergessen wird.

export const ZAHLWEISE_TEXT: Record<Zahlweise, string> = {
  MONATLICH: 'monatlich',
  VIERTELJAEHRLICH: 'vierteljährlich',
  HALBJAEHRLICH: 'halbjährlich',
  JAEHRLICH: 'jährlich',
};

/** Für „586,80 €/Jahr“. */
export const ZAHLWEISE_EINHEIT: Record<Zahlweise, string> = {
  MONATLICH: 'Monat',
  VIERTELJAEHRLICH: 'Quartal',
  HALBJAEHRLICH: 'Halbjahr',
  JAEHRLICH: 'Jahr',
};

export const ZAHLUNGSWEG_TEXT: Record<Zahlungsweg, string> = {
  LASTSCHRIFT: 'Lastschrift',
  KREDITKARTE: 'Kreditkarte',
  PAYPAL: 'PayPal',
  UEBERWEISUNG: 'Überweisung',
  DAUERAUFTRAG: 'Dauerauftrag',
};

export const VERLAENGERUNG_TEXT: Record<Verlaengerung, string> = {
  ZAHLUNGSINTERVALL: 'Jederzeit zum Ende des Zahlungsintervalls',
  MONATLICH: 'Nach Laufzeitende monatlich',
  ZWOELF_MONATE: 'Nach Laufzeitende um 12 Monate',
  KEINE: 'Keine, Vertrag endet',
};

const KATEGORIE_TEXT: Record<VertragKategorieSchluessel, string> = {
  STREAMING_ABOS: 'Streaming & Abos',
  SOFTWARE_APPS: 'Software & Apps',
  VERSICHERUNG: 'Versicherung',
  MOBILFUNK_INTERNET: 'Mobilfunk & Internet',
  MITGLIEDSCHAFTEN: 'Mitgliedschaften',
  GEBUEHREN_BEITRAEGE: 'Gebühren & Beiträge',
  SONSTIGES: 'Sonstiges',
};

/** Standardkategorien haben einen Schlüssel, eigene Kategorien einen Namen. */
export function kategorieText({ schluessel, name }: VertragKategorieAntwort): string {
  return schluessel ? KATEGORIE_TEXT[schluessel] : (name ?? '');
}

export function vertragName(vertrag: { bezeichnung: string | null; anbieter: string }): string {
  return vertrag.bezeichnung || vertrag.anbieter;
}

export type KuendigungTon = 'warnung' | 'ok' | 'info' | 'neutral';

export interface KuendigungAnzeige {
  text: string;
  /** Zusatztext unter dem Badge, leer wenn es keinen gibt. */
  zusatz: string;
  ton: KuendigungTon;
}

function fristText(fristMonate: number | null): string {
  switch (fristMonate ?? 0) {
    case 0:
      return 'ohne Frist';
    case 1:
      return '1 Monat Frist';
    default:
      return `${fristMonate} Monate Frist`;
  }
}

const KUENDIGUNG_ANZEIGE: Record<Kuendigungsart, (k: Kuendigung) => KuendigungAnzeige> = {
  KUENDIGEN_BIS: (k) => ({
    text: `Kündbar bis ${datumText(k.kuendigenBis)}`,
    zusatz: `zum ${datumText(k.zum)}, ${fristText(k.fristMonate)}`,
    ton: k.dringend ? 'warnung' : 'ok',
  }),
  MONATLICH_KUENDBAR: (k) => ({
    text: 'Monatlich kündbar',
    zusatz: `${fristText(k.fristMonate)}, nächstmöglich zum ${datumText(k.zum)}`,
    ton: 'ok',
  }),
  ENDET: (k) => ({
    text: `Endet am ${datumText(k.zum)}`,
    zusatz: 'ohne Verlängerung',
    ton: 'neutral',
  }),
  KEINE_LAUFZEIT: () => ({ text: 'Kein Kündigungstermin bestimmbar', zusatz: '', ton: 'neutral' }),
  NICHT_KUENDBAR: () => ({ text: 'Nicht kündbar', zusatz: 'Pflichtbeitrag', ton: 'neutral' }),
  GEKUENDIGT: (k) => ({
    text: `Gekündigt zum ${datumText(k.zum)}`,
    zusatz: 'läuft noch aus',
    ton: 'info',
  }),
  BEENDET: () => ({ text: 'Beendet', zusatz: '', ton: 'neutral' }),
};

/** Badge aus {@code berechnet.kuendigung}; Termine und Art kommen vom Backend (ADR 0010). */
export function kuendigungAnzeige(kuendigung: Kuendigung): KuendigungAnzeige {
  return KUENDIGUNG_ANZEIGE[kuendigung.art](kuendigung);
}
