import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { VertragAntwort } from '../../../core/api/api';
import { Rundungshinweis } from '../../../shared/rundungshinweis/rundungshinweis';
import { VertragPreisverlauf } from '../vertrag-preisverlauf/vertrag-preisverlauf';
import { preisText, prognoseText } from '../vertrag-texte';

/**
 * Tab Preisverlauf der Details: Diagramm des Preisverlaufs (ab zwei Punkten), alle Preise und die
 * Prognose, sobald es mehr als den einen Preis gibt; sonst ein Hinweis mit „Preis hinzufügen“. Was
 * aktuell, angekündigt oder nach dem Vertragsende ist, sagt das Backend.
 */
@Component({
  selector: 'app-vertrag-preise',
  imports: [Rundungshinweis, VertragPreisverlauf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-preise.html',
  styleUrl: './vertrag-preise.scss',
})
export class VertragPreise {
  private readonly locale = inject(LOCALE_ID);

  readonly vertrag = input.required<VertragAntwort>();

  readonly hinzufuegen = output();

  protected readonly preise = computed(() => {
    const { preise, berechnet } = this.vertrag();
    if (preise.length < 2 && !berechnet.prognose.length) {
      return [];
    }
    return [
      ...preise.map((preis) => ({
        text: preisText(preis, this.locale),
        art: preis.art === 'AKTUELL' ? 'aktuell' : preis.art === 'FRUEHER' ? 'frueher' : '',
      })),
      ...berechnet.prognose.map((preis) => ({
        text: prognoseText(preis, this.locale),
        art: 'prognose',
      })),
    ];
  });
}
