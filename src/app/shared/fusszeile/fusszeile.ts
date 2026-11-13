import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { systemstatusBeobachten } from '../../core/systemstatus/systemstatus.service';
import { RechtlicheLinks } from '../rechtliche-links/rechtliche-links';
import { SystemstatusLeiste } from '../systemstatus-leiste/systemstatus-leiste';
import { VersionAnzeige } from '../version-anzeige/version-anzeige';

/**
 * Fußzeile der Seiten mit Kopfzeile (Shell, Impressum, Datenschutz): Copyright, rechtliche Links,
 * Version. Außerhalb der Shell mit dem Systemstatus über den Links; in der Shell steht er auf den
 * Einstellungen, die Fußzeile ist dort ab 901 px eine flache Zeile.
 */
@Component({
  selector: 'app-fusszeile',
  imports: [RechtlicheLinks, SystemstatusLeiste, VersionAnzeige],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<footer class="fusszeile">
    <p class="copyright">© Björn Bochmann</p>
    @if (mitStatus() && systemstatus.status(); as status) {
      <app-systemstatus-leiste class="status" [status]="status" />
    }
    <app-rechtliche-links class="recht" />
    <app-version-anzeige class="version" />
  </footer>`,
  styleUrl: './fusszeile.scss',
  host: {
    '[class.mit-navigation]': 'mitNavigation()',
    '[class.flach]': '!mitStatus()',
  },
})
export class Fusszeile {
  readonly mitNavigation = input(false);
  readonly mitStatus = input(true);

  /**
   * Nur zur Anzeige; gesperrt wird hier nichts. Auch ohne Anzeige abgefragt: Erst ein erreichbares
   * Backend lädt Version und Umgebung, und die Einstellungen haben so gleich den letzten Stand.
   */
  protected readonly systemstatus = systemstatusBeobachten();
}
