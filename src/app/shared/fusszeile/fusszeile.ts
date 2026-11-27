import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { systemstatusBeobachten } from '../../core/systemstatus/systemstatus.service';
import { RechtlicheLinks } from '../rechtliche-links/rechtliche-links';
import { SystemstatusLeiste } from '../systemstatus-leiste/systemstatus-leiste';
import { VersionAnzeige } from '../version-anzeige/version-anzeige';

/**
 * Fußzeile mit den rechtlichen Links. In der Shell (Variante {@code app}) nur sie, mittig zur ganzen
 * Seite und unter der Seitenleiste durch; Version und Systemstatus stehen dort in den Einstellungen,
 * die Umgebung zeigt der Streifen. Auf Impressum und Datenschutz ({@code einfach}) mit Copyright, ohne
 * Session auch mit Systemstatus und Version.
 */
@Component({
  selector: 'app-fusszeile',
  imports: [RechtlicheLinks, SystemstatusLeiste, VersionAnzeige],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<footer class="fusszeile">
    @if (variante() === 'einfach') {
      <p class="copyright">© Björn Bochmann</p>
    }
    @if (mitStatus() && systemstatus.status(); as status) {
      <app-systemstatus-leiste class="status" [status]="status" />
    }
    <app-rechtliche-links class="recht" />
    @if (mitStatus()) {
      <app-version-anzeige class="version" />
    }
  </footer>`,
  styleUrl: './fusszeile.scss',
  host: { '[class.app]': "variante() === 'app'" },
})
export class Fusszeile {
  readonly variante = input<'app' | 'einfach'>('einfach');
  /** Systemstatus und Version; in der Variante {@code app} nie. */
  readonly status = input(true);

  protected readonly mitStatus = computed(() => this.variante() === 'einfach' && this.status());

  /**
   * Nur zur Anzeige; gesperrt wird hier nichts. Auch ohne Anzeige abgefragt: Erst ein erreichbares
   * Backend lädt Version und Umgebung, und die Einstellungen haben so gleich den letzten Stand.
   */
  protected readonly systemstatus = systemstatusBeobachten();
}
