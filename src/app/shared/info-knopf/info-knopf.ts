import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

let naechsteNummer = 0;

/**
 * ⓘ hinter der Beschriftung einer Zahl, öffnet per Klick oder Tipp eine Blase mit den Sätzen, die
 * erklären, wie die Zahl zustande kommt (Toggletip, Baustein „InfoKnopf“ im Design System). Esc, ein
 * Klick daneben oder ein erneuter Klick schließen sie; ein Klick auf einen anderen Info-Knopf ist ein
 * Klick daneben, so ist höchstens eine Blase offen. Ohne Sätze kein Knopf. Die Blase hängt unter dem
 * nächsten positionierten Vorfahren, gedacht ist die Beschriftung mit {@code position: relative}.
 */
@Component({
  selector: 'app-info-knopf',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './info-knopf.html',
  styleUrl: './info-knopf.scss',
  host: {
    '(document:click)': 'klickIrgendwo($event)',
    '(keydown.escape)': 'esc()',
  },
})
export class InfoKnopf {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Beschriftung der Zahl, für „Info zu …“. */
  readonly beschriftung = input.required<string>();
  /** Nur die Sätze, die gerade zutreffen. */
  readonly saetze = input.required<readonly string[]>();

  private readonly knopf = viewChild<ElementRef<HTMLButtonElement>>('knopf');

  protected readonly offen = signal(false);
  protected readonly blaseId = `info-blase-${naechsteNummer++}`;

  protected umschalten(): void {
    this.offen.update((offen) => !offen);
  }

  protected klickIrgendwo(event: MouseEvent): void {
    if (
      this.offen() &&
      event.target instanceof Node &&
      !this.element.nativeElement.contains(event.target)
    ) {
      this.offen.set(false);
    }
  }

  protected esc(): void {
    if (this.offen()) {
      this.offen.set(false);
      this.knopf()?.nativeElement.focus();
    }
  }
}
