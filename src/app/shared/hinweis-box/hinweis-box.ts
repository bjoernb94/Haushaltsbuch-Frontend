import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Meldung über einem Formular: Fehler (rot), Info (grün, z. B. „gespeichert“) oder Hinweis (blau), etwa
 * wenn sich der Stand inzwischen geändert hat und neu geladen wurde. Statt {@code text} darf der Inhalt
 * stehen, z. B. mit einem Link zum Support.
 */
@Component({
  selector: 'app-hinweis-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hinweis-box.html',
  styleUrl: './hinweis-box.scss',
})
export class HinweisBox {
  readonly text = input<string>();
  readonly art = input<'fehler' | 'info' | 'hinweis'>('fehler');
}
