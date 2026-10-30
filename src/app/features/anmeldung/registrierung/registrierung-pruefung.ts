import { Komponente } from '../../../core/komponenten/komponente';
import { passwortFehler } from './passwort-regeln';

export type Feld = 'email' | 'passwort' | 'name' | 'vorname' | 'komponenten';

export interface RegistrierungWerte {
  email: string;
  passwort: string;
  name: string;
  vorname: string;
  komponenten: Komponente[];
}

export interface Pruefung {
  /** Erstes Problem in der Reihenfolge des Designs, {@code null} wenn alles passt. */
  meldung: string | null;
  /** Alle Felder mit Problemen, für die rote Umrandung. */
  felder: ReadonlySet<Feld>;
}

// Wie im Design; die genaue Prüfung macht das Backend (@Email).
const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function registrierungPruefen(w: RegistrierungWerte): Pruefung {
  const leer = (['email', 'passwort', 'name', 'vorname'] as const).filter((feld) =>
    feld === 'passwort' ? !w.passwort : !w[feld].trim(),
  );
  const emailUngueltig = !!w.email.trim() && !EMAIL_MUSTER.test(w.email.trim());
  const passwortRegel = w.passwort ? passwortFehler(w.passwort, w.email) : null;
  const keineKomponente = w.komponenten.length === 0;

  const felder = new Set<Feld>(leer);
  if (emailUngueltig) felder.add('email');
  if (passwortRegel) felder.add('passwort');
  if (keineKomponente) felder.add('komponenten');

  let meldung: string | null = null;
  if (leer.length) meldung = 'Bitte fülle alle Felder aus.';
  else if (emailUngueltig) meldung = 'Bitte gib eine gültige E-Mail-Adresse ein.';
  else if (passwortRegel) meldung = passwortRegel.fehler;
  else if (keineKomponente) meldung = 'Bitte wähle mindestens eine Komponente aus.';

  return { meldung, felder };
}
