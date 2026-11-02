import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, LOCALE_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Komponente } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { Kachel } from './kachel/kachel';

/** Überblick nach der Anmeldung: je gebuchter Komponente eine Kachel, von dort geht es weiter. */
@Component({
  selector: 'app-start-seite',
  imports: [RouterLink, Kachel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './start-seite.html',
  styleUrl: './start-seite.scss',
})
export class StartSeite {
  private readonly auth = inject(AuthService);

  protected readonly vorname = computed(() => this.auth.nutzer()?.vorname);

  /** Reine Anzeige, darf daher aus dem Browser kommen. */
  protected readonly monat = formatDate(new Date(), 'MMMM y', inject(LOCALE_ID));

  protected gebucht(komponente: Komponente): boolean {
    return this.auth.komponenten().includes(komponente);
  }
}
