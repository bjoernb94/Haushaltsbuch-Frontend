import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Logo } from '../logo/logo';
import { Nutzermenue } from '../nutzermenue/nutzermenue';

/**
 * Kopfzeile mit Logo und, mit Session, dem Nutzermenü. In der Shell und auf Impressum und
 * Datenschutz gleich, damit Logo und Nutzer-Button beim Wechsel nicht springen. Neben der
 * Seitenleiste (ab 901 px) fällt sie weg, nur das Nutzermenü bleibt und sitzt unten in der Leiste.
 * So gibt es das Menü immer nur einmal, auch wenn das Fenster die Breite wechselt.
 */
@Component({
  selector: 'app-kopfzeile',
  imports: [Logo, Nutzermenue],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="kopfzeile">
    <div class="kopfzeile-innen">
      <div class="logo">
        <app-logo />
        <span>Haushaltsbuch</span>
      </div>
      <app-nutzermenue [seitenleiste]="seitenleiste()" />
    </div>
  </header>`,
  styleUrl: './kopfzeile.scss',
  host: { '[class.seitenleiste]': 'seitenleiste()' },
})
export class Kopfzeile {
  readonly seitenleiste = input(false);
}
