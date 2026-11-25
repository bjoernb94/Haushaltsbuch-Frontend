import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { VertragUnterbrechungAntwort } from '../../../../core/api/api';
import { InfoKnopf } from '../../../../shared/info-knopf/info-knopf';
import { INFO_UNTERBRECHUNG, UNTERBRECHUNG_ART_TEXT, zeitraumText } from '../../vertrag-texte';

/**
 * Tab Laufzeit der Details: die Unterbrechungen mit Zeitraum und Art, nur zur Ansicht (entfernen
 * lassen sie sich beim Bearbeiten).
 */
@Component({
  selector: 'app-vertrag-unterbrechungen',
  imports: [InfoKnopf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-unterbrechungen.html',
  styleUrl: './vertrag-unterbrechungen.scss',
})
export class VertragUnterbrechungen {
  readonly unterbrechungen = input.required<VertragUnterbrechungAntwort[]>();

  protected readonly info = INFO_UNTERBRECHUNG;
  protected readonly zeilen = computed(() =>
    this.unterbrechungen().map((u) => ({
      id: u.id,
      zeitraum: zeitraumText(u),
      art: UNTERBRECHUNG_ART_TEXT[u.art],
    })),
  );
}
