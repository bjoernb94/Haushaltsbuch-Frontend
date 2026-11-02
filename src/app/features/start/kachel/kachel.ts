import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Komponente } from '../../../core/api/api';
import { istVerfuegbar, KOMPONENTE_ICON } from '../../../core/komponenten/komponente';

/**
 * Kachel eines Fachbereichs auf der Startseite. Bereiche ohne Backend erscheinen ausgegraut; ihr
 * Inhalt zeigt nur den Aufbau und ist für Screenreader verborgen.
 */
@Component({
  selector: 'app-kachel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kachel.html',
  styleUrl: './kachel.scss',
})
export class Kachel {
  readonly komponente = input.required<Komponente>();
  readonly titel = input.required<string>();

  protected readonly icon = computed(() => KOMPONENTE_ICON[this.komponente()]);
  protected readonly demnaechst = computed(() => !istVerfuegbar(this.komponente()));
}
