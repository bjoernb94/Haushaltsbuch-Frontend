import {
  Erhoehungsrhythmus,
  Kuendigung,
  Kuendigungsart,
  Preisaenderung,
  Preiszeilenart,
  Prognosepreis,
  Verlaengerung,
  VertragPreissteigerungAntwort,
  VertragAntwort,
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

export const RHYTHMUS_TEXT: Record<Erhoehungsrhythmus, string> = {
  VIERTELJAEHRLICH: 'vierteljährlich',
  HALBJAEHRLICH: 'halbjährlich',
  JAEHRLICH: 'jährlich',
  ZWEIJAEHRLICH: 'alle 2 Jahre',
  DREIJAEHRLICH: 'alle 3 Jahre',
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
  NICHT_BEGONNEN: 'Noch nicht begonnen',
  AKTIV: 'Aktiv',
  GEKUENDIGT: 'Gekündigt',
  BEENDET: 'Beendet',
  STORNIERT: 'Storniert',
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
  STORNIERT: () => ({ text: 'Storniert', zusatz: '', ton: 'neutral' }),
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

/** Statt „Beginn – Ende“: Status und Vertragsende kommen vom Backend (ADR 0010). */
export function laufzeitZeile({ beginn, berechnet }: VertragAntwort): string {
  switch (berechnet.status) {
    case 'NICHT_BEGONNEN':
      return `Beginnt am ${datumText(beginn)}`;
    case 'BEENDET':
      return `${datumText(beginn)} – ${datumText(berechnet.vertragsende)}`;
    case 'STORNIERT':
      return `Storniert, Beginn wäre ${datumText(beginn)}`;
    default:
      return `Seit ${datumText(beginn)}`;
  }
}

/** Beendet oder storniert: in der Liste ausgegraut. */
export function vorbei({ status }: VertragAntwort['berechnet']): boolean {
  return status === 'BEENDET' || status === 'STORNIERT';
}

/** Unter Kennzahlen, wenn das Backend {@code hatAnteile} meldet. */
export const NUR_ANTEIL = 'Bei geteilten Verträgen nur dein Anteil';

/** Unter „Kosten pro Monat“, wenn das Backend {@code hatNichtBegonnene} meldet. */
export const OHNE_NICHT_BEGONNENE = 'Ohne Verträge, die erst später beginnen';

/**
 * „33,3“: Prozent wie vom Backend, beim Anteil höchstens eine Nachkommastelle, bei der Erhöhung
 * zwei („2,75“).
 */
export function prozentText(wert: number, locale: string, stellen = 1): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: stellen }).format(wert);
}

/** „Jährlich um 2,5 %“, ohne Datum: {@code naechsteAm} ist nur der Anker im Rhythmus. */
export function steigerungText(
  { art, prozent, betrag, rhythmus }: VertragPreissteigerungAntwort,
  locale: string,
): string {
  const um =
    art === 'PROZENT' ? `${prozentText(prozent ?? 0, locale, 2)} %` : betragText(betrag!, locale);
  const text = `${RHYTHMUS_TEXT[rhythmus]} um ${um}`;
  return text[0].toUpperCase() + text.slice(1);
}

export const PREISAENDERUNG_ART_TEXT: Record<Preisaenderung['art'], string> = {
  ANGEKUENDIGT: 'angekündigt',
  PROGNOSE: 'Prognose',
};
