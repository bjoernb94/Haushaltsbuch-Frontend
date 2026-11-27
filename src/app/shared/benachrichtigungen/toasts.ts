import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Benachrichtigungen } from '../../core/benachrichtigungen/benachrichtigungen';
import { ART_TEXT, MeldungSymbol } from './meldung-symbol';

/**
 * Was oben steht und nicht überdeckt werden darf: die Kopfzeile bzw. die eigene Leiste einer Seite.
 * Gesucht wird die unterste sichtbare; ohne steht oben nur der Streifen der Umgebung (außerhalb PROD).
 */
const KOPF = '[data-kopf]';
const STREIFEN = 'app-root > .streifen';

/**
 * Toasts oben rechts unter der Glocke, neueste oben; bis 900 px über die volle Breite. Sie stehen
 * immer im selben Abstand unter der Kopfzeile, auch wenn die sich bewegt (oben auf der Seite schiebt
 * sie der Streifen der Umgebung nach unten); ohne Kopfzeile (Login, Registrierung) mit etwas mehr
 * Abstand unter dem oberen Rand. Steht einmal in der App-Wurzel, damit die Live-Region schon vor der
 * ersten Meldung im DOM ist; Fehler als {@code alert}, sonst {@code status}. Der Fokus bleibt, wo er
 * ist. Maus oder Fokus auf einem Toast halten seine Zeit an.
 */
@Component({
  selector: 'app-toasts',
  imports: [MeldungSymbol, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toasts.html',
  styleUrl: './toasts.scss',
  host: {
    '[class.mit-kopfzeile]': 'kante().mitKopf',
    '[style.--toasts-kante.px]': 'kante().px',
  },
})
export class Toasts {
  protected readonly benachrichtigungen = inject(Benachrichtigungen);
  protected readonly artText = ART_TEXT;

  /** Unterkante dessen, was oben steht, im Fenster. */
  protected readonly kante = signal({ px: 0, mitKopf: false });

  private readonly document = inject(DOCUMENT);

  constructor() {
    // Solange Toasts stehen, in jedem Frame: So folgen sie der Kopfzeile beim Scrollen und nach einem
    // Seitenwechsel, ganz gleich, wann der Browser scrollt. Ohne Toasts gibt es nichts zu messen.
    const fenster = this.document.defaultView;
    let frame: number | undefined;
    const schritt = () => {
      this.messen();
      frame = this.benachrichtigungen.toasts().length
        ? fenster?.requestAnimationFrame(schritt)
        : undefined;
    };
    afterRenderEffect(() => {
      if (this.benachrichtigungen.toasts().length && frame === undefined) {
        schritt();
      }
    });
    inject(DestroyRef).onDestroy(() => {
      if (frame !== undefined) {
        fenster?.cancelAnimationFrame(frame);
      }
    });
  }

  protected fokusRaus(event: FocusEvent, id: string): void {
    const toast = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node && toast.contains(event.relatedTarget))) {
      this.benachrichtigungen.fortsetzen(id);
    }
  }

  private messen(): void {
    const unten = (elemente: Element[]) =>
      elemente
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height > 0)
        .reduce((max, r) => Math.max(max, r.bottom), 0);
    const kopf = unten([...this.document.querySelectorAll(KOPF)]);
    const streifen = unten([...this.document.querySelectorAll(STREIFEN)]);
    const neu = { px: Math.round(Math.max(0, kopf, streifen)), mitKopf: kopf > 0 };
    const alt = this.kante();
    if (neu.px !== alt.px || neu.mitKopf !== alt.mitKopf) {
      this.kante.set(neu);
    }
  }
}
