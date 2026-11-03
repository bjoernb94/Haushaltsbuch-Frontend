import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UngespeicherteEingaben } from '../../core/ungespeichert/ungespeicherte-eingaben';
import { BestaetigenDialog } from '../bestaetigen-dialog/bestaetigen-dialog';

/** Fragt, ob ungespeicherte Eingaben verloren gehen dürfen. */
@Component({
  selector: 'app-verwerfen-dialog',
  imports: [BestaetigenDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-bestaetigen-dialog
    [offen]="eingaben.frageOffen()"
    titel="Änderungen verwerfen?"
    text="Deine Eingaben wurden noch nicht gespeichert."
    neinText="Weiter bearbeiten"
    jaText="Verwerfen"
    (antwort)="eingaben.antworten($event)"
  />`,
})
export class VerwerfenDialog {
  protected readonly eingaben = inject(UngespeicherteEingaben);
}
