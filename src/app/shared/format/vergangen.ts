const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;

/**
 * Wie lange ein Zeitpunkt her ist, z. B. „Vor 5 Min.“, „Gestern“, später das Datum. Reine Anzeige ohne
 * fachliche Bedeutung, darf deshalb die Uhr des Browsers nutzen.
 */
export function vergangenText(zeit: number, jetzt: number, locale: string): string {
  const her = jetzt - zeit;
  if (her < MINUTE) {
    return 'Gerade eben';
  }
  if (her < STUNDE) {
    return `Vor ${Math.floor(her / MINUTE)} Min.`;
  }
  if (her < 24 * STUNDE) {
    return `Vor ${Math.floor(her / STUNDE)} Std.`;
  }
  if (her < 48 * STUNDE) {
    return 'Gestern';
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(zeit);
}
