import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { systemstatusBeobachten } from '../../core/systemstatus/systemstatus.service';
import { RechtlicheLinks } from '../rechtliche-links/rechtliche-links';
import { SystemstatusLeiste } from '../systemstatus-leiste/systemstatus-leiste';
import { VersionAnzeige } from '../version-anzeige/version-anzeige';

/**
 * Fußzeile der Seiten mit Kopfzeile (Shell, Impressum, Datenschutz): Copyright, Systemstatus mit den
 * rechtlichen Links darunter, Version. Mit Seitennavigation steht das Copyright ab 901 px dort.
 */
@Component({
  selector: 'app-fusszeile',
  imports: [RechtlicheLinks, SystemstatusLeiste, VersionAnzeige],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<footer class="fusszeile">
    <p class="copyright">© Björn Bochmann</p>
    @if (systemstatus.status(); as status) {
      <app-systemstatus-leiste class="status" [status]="status" />
    }
    <app-rechtliche-links class="recht" />
    <app-version-anzeige class="version" />
  </footer>`,
  styleUrl: './fusszeile.scss',
  host: { '[class.mit-navigation]': 'mitNavigation()' },
})
export class Fusszeile {
  readonly mitNavigation = input(false);

  /** Nur zur Anzeige; gesperrt wird hier nichts. */
  protected readonly systemstatus = systemstatusBeobachten();
}
