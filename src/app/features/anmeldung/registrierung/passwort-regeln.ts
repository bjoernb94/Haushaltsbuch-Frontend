/**
 * Passwort-Richtlinie des Keycloak-Realms, damit das Formular vor dem Absenden prüfen kann.
 * Entscheidend bleibt Keycloak; bei Änderungen der Richtlinie dort auch hier anpassen.
 * Die Prüfungen folgen Keycloak: Buchstaben und Ziffern nach Unicode, Sonderzeichen ist alles
 * andere. Nutzername und E-Mail sind gleich (das Backend legt die E-Mail als Nutzernamen an).
 * Die Passwort-Historie betrifft nur Passwortänderungen, nicht die Registrierung.
 */
export interface PasswortRegel {
  text: string;
  fehler: string;
  erfuellt(passwort: string, email: string): boolean;
}

export const PASSWORT_REGELN: readonly PasswortRegel[] = [
  {
    text: 'Mindestens 8 Zeichen',
    fehler: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
    erfuellt: (p) => p.length >= 8,
  },
  {
    text: 'Ein Großbuchstabe',
    fehler: 'Das Passwort muss mindestens einen Großbuchstaben enthalten.',
    erfuellt: (p) => /\p{Lu}/u.test(p),
  },
  {
    text: 'Ein Kleinbuchstabe',
    fehler: 'Das Passwort muss mindestens einen Kleinbuchstaben enthalten.',
    erfuellt: (p) => /\p{Ll}/u.test(p),
  },
  {
    text: 'Eine Zahl',
    fehler: 'Das Passwort muss mindestens eine Zahl enthalten.',
    erfuellt: (p) => /\p{Nd}/u.test(p),
  },
  {
    text: 'Ein Sonderzeichen',
    fehler: 'Das Passwort muss mindestens ein Sonderzeichen enthalten.',
    erfuellt: (p) => /[^\p{L}\p{Nd}]/u.test(p),
  },
  {
    text: 'Nicht deine E-Mail-Adresse',
    fehler: 'Das Passwort darf nicht deine E-Mail-Adresse sein.',
    erfuellt: (p, email) => p.toLowerCase() !== email.trim().toLowerCase(),
  },
];

/** Erste verletzte Regel, sonst {@code null}. */
export function passwortFehler(passwort: string, email: string): PasswortRegel | null {
  return PASSWORT_REGELN.find((regel) => !regel.erfuellt(passwort, email)) ?? null;
}
