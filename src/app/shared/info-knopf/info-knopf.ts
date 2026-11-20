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

/** Wie im Design System: höchstens 300 px breit, 8 px Abstand zu Knopf und Rahmen. */
const BREITE = 300;
const ABSTAND = 8;
/** Die Blase beginnt etwas links vom Knopf, so steht er über ihrem Anfang. */
const VERSATZ = 12;

interface Lage {
  links: number;
  oben: number;
  breite: number;
}

/**
 * ⓘ hinter der Beschriftung einer Zahl, öffnet per Klick oder Tipp eine Blase mit den Sätzen, die
 * erklären, wie die Zahl zustande kommt (Toggletip, Baustein „InfoKnopf“ im Design System). Esc, ein
 * Klick daneben oder ein erneuter Klick schließen sie; ein Klick auf einen anderen Info-Knopf ist ein
 * Klick daneben, so ist höchstens eine Blase offen. Ohne Sätze kein Knopf. Die Blase hängt am
 * nächsten positionierten Vorfahren (die Beschriftung oder ihre Karte mit {@code position: relative}),
 * unter dem Knopf und so verschoben, dass sie im Panel, Sheet bzw. Fenster bleibt.
 */
@Component({
  selector: 'app-info-knopf',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './info-knopf.html',
  styleUrl: './info-knopf.scss',
  host: {
    '(document:click)': 'klickIrgendwo($event)',
    '(keydown.escape)': 'esc()',
    '(window:resize)': 'lageAnpassen()',
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
  protected readonly lage = signal<Lage | null>(null);
  protected readonly blaseId = `info-blase-${naechsteNummer++}`;

  protected umschalten(): void {
    this.offen.update((offen) => !offen);
    this.lageAnpassen();
  }

  protected lageAnpassen(): void {
    if (this.offen()) {
      this.lage.set(this.lageBerechnen());
    }
  }

  /** Relativ zum Anker, links und Breite begrenzt auf den Rahmen; ohne Layout (Tests) null. */
  private lageBerechnen(): Lage | null {
    const knopf = this.knopf()?.nativeElement;
    const anker = this.element.nativeElement.offsetParent;
    if (!knopf || !anker) {
      return null;
    }
    const k = knopf.getBoundingClientRect();
    const a = anker.getBoundingClientRect();
    const r = this.rahmen()?.getBoundingClientRect();
    const links = Math.max(r?.left ?? 0, 0) + ABSTAND;
    const rechts = Math.min(r?.right ?? Infinity, document.documentElement.clientWidth) - ABSTAND;
    const breite = Math.min(BREITE, rechts - links);
    const x = Math.min(Math.max(k.left - VERSATZ, links), rechts - breite);
    return { links: x - a.left, oben: k.bottom - a.top + ABSTAND, breite };
  }

  /** Nächster Vorfahr, der seitlich abschneidet (Panel, Sheet, scrollender Bereich). */
  private rahmen(): Element | null {
    for (
      let element = this.element.nativeElement.parentElement;
      element && element !== document.body;
      element = element.parentElement
    ) {
      if (element.tagName === 'DIALOG' || getComputedStyle(element).overflowX !== 'visible') {
        return element;
      }
    }
    return null;
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
