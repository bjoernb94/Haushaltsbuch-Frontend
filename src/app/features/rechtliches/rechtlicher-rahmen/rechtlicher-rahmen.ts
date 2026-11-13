import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { STARTSEITE } from '../../../core/auth/auth.guards';
import { AuthService } from '../../../core/auth/auth.service';
import { InstanzService } from '../../../core/instanz/instanz.service';
import { Fusszeile } from '../../../shared/fusszeile/fusszeile';
import { herkunftAus, zurueckLabel } from '../../../shared/herkunft/herkunft';
import { Kopfzeile } from '../../../shared/kopfzeile/kopfzeile';
import { istRechtlich } from '../../../shared/rechtliche-links/rechtliche-links';

/**
 * Rahmen für Impressum und Datenschutz: erreichbar mit und ohne Session. Mit Session zeigt die
 * Kopfzeile das Nutzermenü. „Zurück“ führt zur Herkunft, ohne sie zum Login bzw. zur Startseite.
 */
@Component({
  selector: 'app-rechtlicher-rahmen',
  imports: [Fusszeile, Kopfzeile, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rechtlicher-rahmen.html',
  styleUrl: './rechtlicher-rahmen.scss',
})
export class RechtlicherRahmen {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Bleibt auch beim Neuladen im Verlauf des Browsers erhalten. */
  private readonly herkunft = herkunftAus(inject(Location).getState(), istRechtlich);

  protected readonly zurueck = computed(() =>
    this.router.parseUrl(this.herkunft ?? (this.auth.angemeldet() ? STARTSEITE : '/login')),
  );

  protected readonly zurueckLabel = computed(() =>
    zurueckLabel(this.router.serializeUrl(this.zurueck())),
  );

  constructor() {
    // Ohne Guard: Die Session entscheidet nur über Nutzermenü und Ziel von „Zurück“.
    this.auth.sitzungPruefen().subscribe();
    inject(InstanzService).laden();
  }
}
