import { Location } from '@angular/common';
import { inject } from '@angular/core';
import { EINSTELLUNGEN } from '../../shared/nutzermenue/nutzermenue';
import { Seitenaktion, seitenaktionenMelden } from '../../shared/seitenaktionen/seitenaktionen';

/**
 * Im Navigations-State: Die Einstellungen haben die Unterseite selbst geöffnet, der vorige Eintrag im
 * Verlauf sind also sie, samt ihrer eigenen Herkunft.
 */
const INTERN = 'intern';

/** State für die Links der Einstellungen auf ihre Unterseiten. */
export const UNTERSEITE_STATE = { [INTERN]: true };

/**
 * „Zurück“ einer Unterseite (Injection-Kontext): immer zu den Einstellungen, von dort geöffnet im Verlauf
 * zurück, damit deren „Zurück“ weiter zur ursprünglichen Herkunft führt. Meldet es auch der Kopfzeile.
 */
export function zurueckZuEinstellungen(): Seitenaktion {
  const intern = !!(inject(Location).getState() as Record<string, unknown> | null)?.[INTERN];
  const zurueck: Seitenaktion = {
    ziel: EINSTELLUNGEN,
    label: 'Zurück zu Einstellungen',
    text: 'Einstellungen',
    verlauf: intern,
  };
  seitenaktionenMelden(() => ({ zurueck }));
  return zurueck;
}
