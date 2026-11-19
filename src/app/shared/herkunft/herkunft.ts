/** Schlüssel im Navigations-State: Seite, zu der „Zurück“ führt (Impressum, Datenschutz, Einstellungen). */
export const HERKUNFT = 'herkunft';

/**
 * Herkunft aus dem Navigations-State. Nur eigene Pfade, nichts von außen, und keine Seite, für die
 * {@code ausser} gilt (die Seite selbst bzw. ihre Geschwister, sonst führte „Zurück“ im Kreis).
 */
export function herkunftAus(state: unknown, ausser: (url: string) => boolean): string | undefined {
  const herkunft = (state as Record<string, unknown> | null | undefined)?.[HERKUNFT];
  return typeof herkunft === 'string' &&
    herkunft.startsWith('/') &&
    !herkunft.startsWith('//') &&
    !ausser(herkunft)
    ? herkunft
    : undefined;
}

/** Namen der Seiten, zu denen „Zurück“ führen kann. */
const SEITEN: Record<string, string> = {
  '/login': 'Login',
  '/registrierung': 'Registrierung',
  '/start': 'Startseite',
  '/vertraege': 'Verträge',
  '/vertraege/neu': 'Neuer Vertrag',
  '/einstellungen': 'Einstellungen',
  '/einstellungen/profil': 'Profil',
  '/einstellungen/komponenten': 'Komponenten',
  '/impressum': 'Impressum',
  '/datenschutz': 'Datenschutz',
};

/** Beschriftung für „Zurück“ zu {@code url}; ohne bekannten Namen bleibt es beim sichtbaren Text. */
export function zurueckLabel(url: string): string | null {
  const seite = SEITEN[url.split(/[?#]/)[0]];
  return seite ? `Zurück zu ${seite}` : null;
}
