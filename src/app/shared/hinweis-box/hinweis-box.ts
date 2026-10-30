import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Meldung über einem Formular: Fehler (rot) oder Info (grün). */
@Component({
  selector: 'app-hinweis-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hinweis-box.html',
  styleUrl: './hinweis-box.scss',
})
export class HinweisBox {
  readonly text = input.required<string>();
  readonly art = input<'fehler' | 'info'>('fehler');
}
