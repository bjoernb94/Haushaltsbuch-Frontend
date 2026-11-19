/** Nutzt Graphem-Cluster, damit Akzente in zerlegter Form und Emojis ganz bleiben. */
const ZEICHEN = new Intl.Segmenter('de', { granularity: 'grapheme' });

function erstesZeichen(text: string): string {
  const [erstes] = ZEICHEN.segment(text.trim());
  return erstes?.segment ?? '';
}

/** Initialen aus Vor- und Nachname, z. B. „MM“, für Nutzermenü und Profil. */
export function initialen(vorname: string, name: string): string {
  return (erstesZeichen(vorname) + erstesZeichen(name)).toLocaleUpperCase('de');
}
