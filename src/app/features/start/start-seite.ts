import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

/** Platzhalter, bis das Artboard „Startseite“ umgesetzt ist. */
@Component({
  selector: 'app-start-seite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Willkommen{{ nutzer()?.vorname ? ', ' + nutzer()?.vorname : '' }}</h1>`,
})
export class StartSeite {
  protected readonly nutzer = inject(AuthService).nutzer;
}
