/** Ab so vielen automatischen Preisen hintereinander werden sie zusammengeklappt. */
export const AB_GRUPPE = 5;

/** Ein Eintrag mit seiner Stelle in der ursprünglichen Liste. */
export interface MitIndex<T> {
  eintrag: T;
  index: number;
}

/**
 * Ein Abschnitt der Liste: ein einzelner Eintrag oder eine Gruppe automatischer Preise. Der
 * {@code schluessel} einer Gruppe ist der Index ihres ersten Eintrags.
 */
export type Abschnitt<T> =
  | ({ art: 'einzeln' } & MitIndex<T>)
  | { art: 'gruppe'; schluessel: number; eintraege: MitIndex<T>[] };

/**
 * Fasst {@link AB_GRUPPE} oder mehr aufeinanderfolgende automatische Einträge zu einer Gruppe zusammen,
 * die übrigen bleiben einzeln. Nur Darstellung: Reihenfolge und Art kommen vom Backend.
 */
export function gruppieren<T>(
  eintraege: readonly T[],
  automatisch: (eintrag: T) => boolean,
): Abschnitt<T>[] {
  const abschnitte: Abschnitt<T>[] = [];
  let lauf: MitIndex<T>[] = [];
  const abschliessen = () => {
    if (lauf.length >= AB_GRUPPE) {
      abschnitte.push({ art: 'gruppe', schluessel: lauf[0].index, eintraege: lauf });
    } else {
      abschnitte.push(...lauf.map((e) => ({ art: 'einzeln' as const, ...e })));
    }
    lauf = [];
  };
  eintraege.forEach((eintrag, index) => {
    if (automatisch(eintrag)) {
      lauf.push({ eintrag, index });
    } else {
      abschliessen();
      abschnitte.push({ art: 'einzeln', eintrag, index });
    }
  });
  abschliessen();
  return abschnitte;
}

/** „2022–2026“ bzw. „2026“ aus zwei ISO-Daten. */
function jahre(von: string, bis: string): string {
  const [jahrVon, jahrBis] = [von.slice(0, 4), bis.slice(0, 4)];
  return jahrVon === jahrBis ? jahrVon : `${jahrVon}–${jahrBis}`;
}

/** „12 automatische Preise, 2022–2026“ aus den ISO-Daten des ersten und letzten Eintrags. */
export function gruppenText(anzahl: number, von: string, bis: string): string {
  return `${anzahl} automatische Preise, ${jahre(von, bis)}`;
}

/**
 * Hinweis auf die Stufen, die erst das Speichern anlegt: „Beim Speichern werden 5 automatische Preise
 * angelegt (2022–2026)“, bei einer „Beim Speichern wird 1 automatischer Preis angelegt (2022)“.
 */
export function neuHinweisText(anzahl: number, von: string, bis: string): string {
  const was = anzahl === 1 ? 'wird 1 automatischer Preis' : `werden ${anzahl} automatische Preise`;
  return `Beim Speichern ${was} angelegt (${jahre(von, bis)})`;
}
