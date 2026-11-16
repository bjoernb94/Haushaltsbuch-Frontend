import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export const RUNDUNG_TEXT =
  'Umgerechnete Werte und Summen sind gerundet und können um wenige Cent abweichen. Verbindlich ist der Betrag je Abbuchung.';

/** Unter der Prognose; dort steht schon, dass es keine Abbuchung ist. */
export const RUNDUNG_TEXT_KURZ = 'Gerundet, kann um wenige Cent abweichen.';

/**
 * Fußnote unter umgerechneten Werten (pro Monat, im Jahr, Anteil, Summen, Prognose): Das Backend
 * rundet erst bei der Ausgabe, verbindlich ist nur der Betrag je Abbuchung. Die SPA erklärt oder
 * korrigiert die Abweichung nicht (ADR 0010). Nicht am Betrag je Abbuchung selbst.
 */
@Component({
  selector: 'app-rundungshinweis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '{{ text() }}',
  styleUrl: './rundungshinweis.scss',
})
export class Rundungshinweis {
  readonly kurz = input(false, { transform: booleanAttribute });

  protected readonly text = computed(() => (this.kurz() ? RUNDUNG_TEXT_KURZ : RUNDUNG_TEXT));
}
