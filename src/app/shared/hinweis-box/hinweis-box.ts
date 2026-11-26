import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Die vier Zustände des Design Systems. */
export type HinweisArt = 'fehler' | 'warnung' | 'info' | 'erfolg';

/**
 * Meldung im Inhalt in den vier Zuständen des Design Systems: Fehler (rot) und Warnung (gelb, zeitkritisch) mit
 * {@code role="alert"}, Info (blau, z. B. „inzwischen an anderer Stelle geändert“) und Erfolg (grün, z. B.
 * „gespeichert“) mit {@code role="status"}. Statt {@code text} darf der Inhalt stehen, z. B. mit einem Link zum
 * Support. Mit {@code aktionText} steht ein Knopf daneben (z. B. „Erneut versuchen“), der {@code aktion} meldet.
 */
@Component({
  selector: 'app-hinweis-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hinweis-box.html',
  styleUrl: './hinweis-box.scss',
})
export class HinweisBox {
  readonly text = input<string>();
  readonly art = input<HinweisArt>('fehler');
  readonly aktionText = input<string>();
  readonly aktion = output<void>();

  protected rolle(): 'alert' | 'status' {
    const art = this.art();
    return art === 'fehler' || art === 'warnung' ? 'alert' : 'status';
  }
}
