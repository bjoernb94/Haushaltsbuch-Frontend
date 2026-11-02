import { Komponente } from '../api/api';

/** Fachbereiche, die ein Nutzer bucht. */
/** {@code verfuegbar}: Das Backend hat den Bereich schon, sonst gilt er als „Demnächst verfügbar“. */
export const KOMPONENTEN: readonly {
  wert: Komponente;
  titel: string;
  text: string;
  verfuegbar: boolean;
}[] = [
  {
    wert: 'FINANZUEBERSICHT',
    titel: 'Finanzübersicht',
    text: 'Einnahmen, Ausgaben und Kontostände',
    verfuegbar: false,
  },
  {
    wert: 'VERTRAGSUEBERSICHT',
    titel: 'Vertragsübersicht',
    text: 'Laufende Verträge, Laufzeiten und Fristen',
    verfuegbar: true,
  },
  {
    wert: 'VERSORGUNGSVERTRAEGE',
    titel: 'Übersicht über Versorgungsverträge',
    text: 'Strom, Gas, Wasser und Internet',
    verfuegbar: false,
  },
  { wert: 'PORTFOLIO', titel: 'Portfolio', text: 'Geldanlagen und Depots', verfuegbar: false },
];

export function istVerfuegbar(komponente: Komponente): boolean {
  return KOMPONENTEN.some((k) => k.wert === komponente && k.verfuegbar);
}
