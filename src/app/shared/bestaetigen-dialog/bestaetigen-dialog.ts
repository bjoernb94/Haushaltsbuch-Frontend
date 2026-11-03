import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

let letzterDialog = 0;

/**
 * Frage vor einem Schritt, der sich nicht zurücknehmen lässt. Natives {@code dialog}: Fokus und Esc
 * kommen vom Browser, Esc und der erste Fokus führen zur sicheren Wahl. {@link antwort} kann für
 * dieselbe Frage zweimal kommen, weil auch das Schließen selbst „nein“ meldet.
 */
@Component({
  selector: 'app-bestaetigen-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bestaetigen-dialog.html',
  styleUrl: './bestaetigen-dialog.scss',
})
export class BestaetigenDialog {
  readonly offen = input.required<boolean>();
  readonly titel = input.required<string>();
  readonly text = input.required<string>();
  readonly neinText = input.required<string>();
  readonly jaText = input.required<string>();

  readonly antwort = output<boolean>();

  protected readonly id = `dialog-${++letzterDialog}`;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.offen()) {
        dialog.showModal();
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  /**
   * Erst schließen, dann antworten: Das Schließen gibt den Fokus an den auslösenden Knopf zurück,
   * und nach der Antwort darf die Seite ihn weitergeben.
   */
  protected beantworten(ja: boolean): void {
    this.dialog().nativeElement.close();
    this.antwort.emit(ja);
  }
}
