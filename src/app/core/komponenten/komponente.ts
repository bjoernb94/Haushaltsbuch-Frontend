import { Komponente } from '../api/api';

/** Fachbereiche, die ein Nutzer bucht. */
export const KOMPONENTEN: readonly { wert: Komponente; titel: string; text: string }[] = [
  {
    wert: 'FINANZUEBERSICHT',
    titel: 'Finanzübersicht',
    text: 'Einnahmen, Ausgaben und Kontostände',
  },
  {
    wert: 'VERTRAGSUEBERSICHT',
    titel: 'Vertragsübersicht',
    text: 'Laufende Verträge, Laufzeiten und Fristen',
  },
  {
    wert: 'VERSORGUNGSVERTRAEGE',
    titel: 'Übersicht über Versorgungsverträge',
    text: 'Strom, Gas, Wasser und Internet',
  },
  { wert: 'PORTFOLIO', titel: 'Portfolio', text: 'Geldanlagen und Depots' },
];
