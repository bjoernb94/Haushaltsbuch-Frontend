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

/** Pfade des Icons je Komponente, wie im Design. */
export const KOMPONENTE_ICON: Record<Komponente, readonly string[]> = {
  FINANZUEBERSICHT: [
    'M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
    'M3 10h18',
    'M7 15h3',
  ],
  VERTRAGSUEBERSICHT: [
    'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z',
    'M14 3v5h5',
    'M9 13h6',
    'M9 17h4',
  ],
  VERSORGUNGSVERTRAEGE: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  PORTFOLIO: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
};

export function istVerfuegbar(komponente: Komponente): boolean {
  return KOMPONENTEN.some((k) => k.wert === komponente && k.verfuegbar);
}
