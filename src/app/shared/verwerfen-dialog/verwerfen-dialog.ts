import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { UngespeicherteEingaben } from '../../core/ungespeichert/ungespeicherte-eingaben';

/**
 * Fragt, ob ungespeicherte Eingaben verloren gehen dürfen. Natives {@code dialog}: Fokus und Esc
 * kommen vom Browser, Esc und der erste Fokus führen zur sicheren Wahl „Weiter bearbeiten“.
 */
@Component({
  selector: 'app-verwerfen-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verwerfen-dialog.html',
  styleUrl: './verwerfen-dialog.scss',
})
export class VerwerfenDialog {
  protected readonly eingaben = inject(UngespeicherteEingaben);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.eingaben.frageOffen()) {
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
  protected beantworten(verwerfen: boolean): void {
    this.dialog().nativeElement.close();
    this.eingaben.antworten(verwerfen);
  }
}
