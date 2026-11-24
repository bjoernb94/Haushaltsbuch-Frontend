import { VertragAntwort, VertragUnterbrechungAntwort } from '../../../core/api/api';
import { datumText } from '../../../shared/format/datum.pipe';

/**
 * Unterbrechungen lassen sich im Formular nur entfernen (ADR 0023), angelegt werden sie beim Wieder
 * aufnehmen. Das Formular merkt sich die IDs der zum Entfernen markierten; wirksam wird das erst beim
 * Sichern, bis dahin lässt es sich rückgängig machen.
 */

/** Die gespeicherten Unterbrechungen ohne die zum Entfernen markierten, sortiert wie vom Backend. */
export function verbleibendeUnterbrechungen(
  gespeichert: VertragAntwort | null,
  entfernt: readonly string[],
): VertragUnterbrechungAntwort[] {
  return (gespeichert?.unterbrechungen ?? []).filter(({ id }) => !entfernt.includes(id));
}

/**
 * Text zu einer Regel, die die Angaben an den verbleibenden Unterbrechungen misst; {@code null} bei
 * anderen Regeln. Die Daten stehen in den Unterbrechungen selbst, gerechnet wird nicht (ADR 0010).
 */
export function unterbrechungFehlerText(
  code: string,
  verbleibende: readonly VertragUnterbrechungAntwort[],
): string | null {
  const erste = verbleibende.at(0);
  const letzte = verbleibende.at(-1);
  switch (code) {
    case 'BeginnVorUnterbrechung':
      return erste
        ? `Der Vertragsbeginn muss vor der ersten Unterbrechung (ab ${datumText(erste.von)}) liegen.`
        : 'Der Vertragsbeginn muss vor der ersten Unterbrechung liegen.';
    case 'KuendigungNachUnterbrechung':
      return letzte
        ? `Die Kündigung muss nach der letzten Unterbrechung (bis ${datumText(letzte.bis)}) liegen.`
        : 'Die Kündigung muss nach der letzten Unterbrechung liegen.';
    case 'LaufzeitendeNachAktuellemBeginn':
      return letzte
        ? `Das Laufzeitende muss nach der letzten Unterbrechung (bis ${datumText(letzte.bis)}) liegen.`
        : 'Das Laufzeitende muss nach der letzten Unterbrechung liegen.';
    case 'UnterbrechungenGetrennt':
      return 'Die Unterbrechungen überschneiden sich.';
    default:
      return null;
  }
}

/** An der Liste der Unterbrechungen, z. B. weil eine inzwischen entfernt wurde. */
export const UNTERBRECHUNG_UNBEKANNT_TEXT =
  'Diese Unterbrechung gibt es nicht mehr. Lade den Vertrag neu.';
