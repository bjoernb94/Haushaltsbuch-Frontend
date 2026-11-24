import { Directive, input } from '@angular/core';
import { EinzelFeld, VertragFeld } from './vertrag-pruefung';

export const TABS = [
  { key: 'allgemein', label: 'Allgemein' },
  { key: 'kosten', label: 'Kosten' },
  { key: 'preise', label: 'Preisverlauf' },
  { key: 'laufzeit', label: 'Laufzeit' },
] as const;

export type TabKey = (typeof TABS)[number]['key'];

const TAB_VON: Record<EinzelFeld, TabKey> = {
  anbieter: 'allgemein',
  bezeichnung: 'allgemein',
  kategorieId: 'allgemein',
  vertragsnummer: 'allgemein',
  notiz: 'allgemein',
  betrag: 'kosten',
  anteilProzent: 'kosten',
  zahlweise: 'kosten',
  beginn: 'kosten',
  zahlungsweg: 'kosten',
  einmalkosten: 'kosten',
  nichtKuendbar: 'laufzeit',
  laufzeitende: 'laufzeit',
  verlaengerung: 'laufzeit',
  kuendigungsfristMonate: 'laufzeit',
  gekuendigt: 'laufzeit',
  gekuendigtZum: 'laufzeit',
  erinnerungSonderkuendigung: 'laufzeit',
  preisgarantieBis: 'preise',
  steigt: 'preise',
  steigerungsart: 'preise',
  steigerungswert: 'preise',
  rhythmus: 'preise',
  naechsteErhoehungAm: 'preise',
};

/** Der Tab, in dem ein Feld steht; dort zählt und zeigt das Formular seinen Fehler. */
export function tabVon(feld: VertragFeld): TabKey {
  if (feld.startsWith('preise.')) {
    return 'preise';
  }
  return feld.startsWith('einmalkosten.') ? 'kosten' : TAB_VON[feld as EinzelFeld];
}

/** Auswahl aus den Texten einer Aufzählung, in deren Reihenfolge. */
export function optionen<T extends string>(texte: Record<T, string>): { wert: T; text: string }[] {
  return (Object.keys(texte) as T[]).map((wert) => ({ wert, text: texte[wert] }));
}

/**
 * Gemeinsames der Tabs: Ihre Felder gehören zum Formular ({@code formControlName} im umgebenden
 * {@code formGroup}), Fehler kommen von dort. IDs {@code <idPrefix>-<feld>}, wie
 * {@link VertragFormular} sie zum Fokussieren sucht.
 */
@Directive()
export abstract class VertragTab {
  readonly idPrefix = input.required<string>();
  readonly fehler = input.required<ReadonlyMap<VertragFeld, string>>();

  protected id(feld: VertragFeld): string {
    return `${this.idPrefix()}-${feld}`;
  }

  protected fehlerText(feld: VertragFeld): string | null {
    return this.fehler().get(feld) ?? null;
  }

  /** Für {@code aria-describedby}: der Fehlertext, wenn es ihn gibt, und ein fester Hinweis. */
  protected beschreibung(feld: VertragFeld, hinweisId?: string): string | null {
    const fehlerId = this.fehlerText(feld) ? `${this.id(feld)}-fehler` : null;
    return [fehlerId, hinweisId].filter(Boolean).join(' ') || null;
  }
}
