/** Zeitpunkt (ISO mit Uhrzeit) als Datum und Uhrzeit des Browsers, z. B. „08.11.2026, 15:26“. */
export function zeitpunktText(iso: string, locale: string): string {
  const zeit = new Date(iso);
  return Number.isNaN(zeit.getTime())
    ? iso
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(zeit);
}
