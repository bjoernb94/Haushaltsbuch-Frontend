import {
  Kuendigung,
  Kuendigungsart,
  Preisaenderung,
  Preiszeilenart,
  Prognosepreis,
  Verlaengerung,
  VertragPreisAntwort,
  VertragKategorieAntwort,
  VertragKategorieSchluessel,
  Vertragsstatus,
  Zahlungsweg,
  Zahlweise,
} from '../../core/api/api';
import { betragText } from '../../shared/format/betrag.pipe';
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

export const STATUS_TEXT: Record<Vertragsstatus, string> = {
  AKTIV: 'Aktiv',
  GEKUENDIGT: 'Gekündigt',
  BEENDET: 'Beendet',
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

type KuendigungTon = 'warnung' | 'ok' | 'info' | 'neutral';

interface KuendigungAnzeige {
  text: string;
  /** Zusatztext unter dem Badge, leer wenn es keinen gibt. */
  zusatz: string;
  ton: KuendigungTon;
}

/** Dauer der hinterlegten Frist für die Details, {@code null} ohne Angabe. */
export function fristDauerText(fristMonate: number | null): string | null {
  switch (fristMonate) {
    case null:
      return null;
    case 0:
      return 'ohne';
    case 1:
      return '1 Monat';
    default:
      return `${fristMonate} Monate`;
  }
}

const KUENDIGUNG_ANZEIGE: Record<Kuendigungsart, (k: Kuendigung) => KuendigungAnzeige> = {
  KUENDIGEN_BIS: (k) => ({
    text: `Kündbar bis ${datumText(k.kuendigenBis)}`,
    zusatz: `Vertrag endet zum ${datumText(k.zum)}`,
    ton: k.dringend ? 'warnung' : 'ok',
  }),
  MONATLICH_KUENDBAR: (k) => ({
    text: 'Monatlich kündbar',
    zusatz: `Kündbar zum ${datumText(k.zum)}`,
    ton: 'ok',
  }),
  ENDET: (k) => ({
    text: `Endet am ${datumText(k.zum)}`,
    zusatz: 'Verlängert sich nicht',
    ton: 'neutral',
  }),
  KEINE_LAUFZEIT: () => ({ text: 'Kein Termin bekannt', zusatz: '', ton: 'neutral' }),
  NICHT_KUENDBAR: () => ({ text: 'Nicht kündbar', zusatz: 'Pflichtbeitrag', ton: 'neutral' }),
  GEKUENDIGT: (k) => ({
    text: `Gekündigt zum ${datumText(k.zum)}`,
    zusatz: '',
    ton: 'info',
  }),
  BEENDET: () => ({ text: 'Beendet', zusatz: '', ton: 'neutral' }),
};

/** Badge aus {@code berechnet.kuendigung}; Termine und Art kommen vom Backend (ADR 0010). */
export function kuendigungAnzeige(kuendigung: Kuendigung): KuendigungAnzeige {
  return KUENDIGUNG_ANZEIGE[kuendigung.art](kuendigung);
}

/** Als Fließtext: „Kündbar bis 30.11.2026. Vertrag endet zum 31.12.2026“. */
export function kuendigungText(kuendigung: Kuendigung): string {
  const { text, zusatz } = kuendigungAnzeige(kuendigung);
  return zusatz ? `${text}. ${zusatz}` : text;
}

const PREISZEILE_ZUSATZ: Record<Preiszeilenart, string> = {
  FRUEHER: '',
  AKTUELL: ' · aktuell',
  ANGEKUENDIGT: ' · angekündigt',
  NACH_ENDE: ' · nach Vertragsende',
};

/** „ab 01.01.2026: 586,80 € · aktuell“; ohne Datum gilt der Preis ab Vertragsbeginn. */
export function preisText({ gueltigAb, betrag, art }: VertragPreisAntwort, locale: string): string {
  const ab = gueltigAb ? `ab ${datumText(gueltigAb)}` : 'ab Vertragsbeginn';
  return `${ab}: ${betragText(betrag, locale)}${PREISZEILE_ZUSATZ[art]}`;
}

/** „ab 01.01.2027: 601,47 € · Prognose“. */
export function prognoseText({ ab, betrag }: Prognosepreis, locale: string): string {
  return `ab ${datumText(ab)}: ${betragText(betrag, locale)} · Prognose`;
}

export const PREISAENDERUNG_ART_TEXT: Record<Preisaenderung['art'], string> = {
  ANGEKUENDIGT: 'angekündigt',
  PROGNOSE: 'Prognose',
};
