import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { STARTSEITE } from '../../../core/auth/auth.guards';
import { AuthService } from '../../../core/auth/auth.service';
import { InstanzService } from '../../../core/instanz/instanz.service';
import { VersionService } from '../../../core/version/version.service';
import { Kopfzeile } from '../../../shared/kopfzeile/kopfzeile';
import { herkunftAus, RechtlicheLinks } from '../../../shared/rechtliche-links/rechtliche-links';
import { VersionAnzeige } from '../../../shared/version-anzeige/version-anzeige';

/** Namen der Seiten, zu denen „Zurück“ führen kann. */
const SEITEN: Record<string, string> = {
  '/login': 'Login',
  '/registrierung': 'Registrierung',
  '/start': 'Startseite',
  '/vertraege': 'Verträge',
  '/vertraege/neu': 'Neuer Vertrag',
};

/**
 * Rahmen für Impressum und Datenschutz: erreichbar mit und ohne Session. Mit Session zeigt die
 * Kopfzeile das Nutzermenü. „Zurück“ führt zur Herkunft, ohne sie zum Login bzw. zur Startseite.
 */
@Component({
  selector: 'app-rechtlicher-rahmen',
  imports: [Kopfzeile, RechtlicheLinks, RouterLink, VersionAnzeige],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rechtlicher-rahmen.html',
  styleUrl: './rechtlicher-rahmen.scss',
})
export class RechtlicherRahmen {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Bleibt auch beim Neuladen im Verlauf des Browsers erhalten. */
  private readonly herkunft = herkunftAus(inject(Location).getState());

  protected readonly zurueck = computed(() =>
    this.router.parseUrl(this.herkunft ?? (this.auth.angemeldet() ? STARTSEITE : '/login')),
  );

  protected readonly zurueckLabel = computed(() => {
    const seite = SEITEN[this.router.serializeUrl(this.zurueck()).split(/[?#]/)[0]];
    return seite ? `Zurück zu ${seite}` : null;
  });

  constructor() {
    // Ohne Guard: Die Session entscheidet nur über Nutzermenü und Ziel von „Zurück“.
    this.auth.sitzungPruefen().subscribe();
    // Ohne Systemstatus auf diesen Seiten lädt sonst niemand Version und Umgebung.
    inject(VersionService).laden();
    inject(InstanzService).laden();
  }
}
