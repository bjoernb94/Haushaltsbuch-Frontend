import { Location, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { STARTSEITE } from '../../core/auth/auth.guards';
import { systemstatusBeobachten } from '../../core/systemstatus/systemstatus.service';
import { VersionService } from '../../core/version/version.service';
import { HERKUNFT, herkunftAus, zurueckLabel } from '../../shared/herkunft/herkunft';
import { seitenaktionenMelden } from '../../shared/seitenaktionen/seitenaktionen';
import { EINSTELLUNGEN, istEinstellungen } from '../../shared/nutzermenue/nutzermenue';
import { UNTERSEITE_STATE } from './unterseite';

/**
 * Einstellungen: Konto (Profil, Komponenten), Systemstatus, Version und Umgebung, rechtliche Links. Der
 * Systemstatus steht in der Shell nur hier. „Zurück“ (bis 900 px in der Kopfzeile; darüber führt die
 * Seitenleiste weiter) führt zur Herkunft, ohne sie zur Startseite; die Unterseiten kehren im Verlauf
 * hierher zurück, damit sie erhalten bleibt.
 */
@Component({
  selector: 'app-einstellungen-seite',
  imports: [NgTemplateOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './einstellungen-seite.html',
  styleUrl: './einstellungen-seite.scss',
})
export class EinstellungenSeite {
  private readonly router = inject(Router);

  protected readonly version = inject(VersionService);
  protected readonly systemstatus = systemstatusBeobachten();

  /** Bleibt auch beim Neuladen im Verlauf des Browsers erhalten. */
  private readonly herkunft = herkunftAus(inject(Location).getState(), istEinstellungen);

  private readonly zurueck = this.router.parseUrl(this.herkunft ?? STARTSEITE);
  private readonly zurueckLabel = zurueckLabel(this.router.serializeUrl(this.zurueck));

  protected readonly unterseiteState = UNTERSEITE_STATE;

  /** Von Impressum und Datenschutz führt „Zurück“ hierher. */
  protected readonly rechtlichState = { [HERKUNFT]: EINSTELLUNGEN };

  /** Bis zur ersten Antwort ohne Angabe. */
  protected readonly dienste = computed(() => {
    const s = this.systemstatus.status();
    return [
      { name: 'Backend', ok: s?.backend },
      { name: 'Datenbank', ok: s?.datenbank },
      { name: 'Anmeldeserver', ok: s?.anmeldeserver },
    ];
  });

  constructor() {
    seitenaktionenMelden(() => ({
      titel: 'Einstellungen',
      zurueck: { ziel: this.zurueck, label: this.zurueckLabel },
    }));
  }
}
