import { ChangeDetectionStrategy, Component, computed, inject, LOCALE_ID } from '@angular/core';
import { Komponente } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { Kachel } from './kachel/kachel';
import { VertragKachel } from './vertrag-kachel/vertrag-kachel';

/** Überblick nach der Anmeldung: je gebuchter Komponente eine Kachel, von dort geht es weiter. */
@Component({
  selector: 'app-start-seite',
  imports: [Kachel, VertragKachel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './start-seite.html',
  styleUrl: './start-seite.scss',
})
export class StartSeite {
  private readonly auth = inject(AuthService);

  protected readonly vorname = computed(() => this.auth.nutzer()?.vorname);

  /** Reine Anzeige, darf daher aus dem Browser kommen. */
  protected readonly monat = new Intl.DateTimeFormat(inject(LOCALE_ID), {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  protected gebucht(komponente: Komponente): boolean {
    return this.auth.komponenten().includes(komponente);
  }
}
