import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Logo } from '../logo/logo';
import { Nutzermenue } from '../nutzermenue/nutzermenue';

/**
 * Kopfzeile mit Logo und, mit Session, dem Nutzermenü. In der Shell und auf Impressum und
 * Datenschutz gleich, damit Logo und Nutzer-Button beim Wechsel nicht springen.
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
      <app-nutzermenue />
    </div>
  </header>`,
  styleUrl: './kopfzeile.scss',
})
export class Kopfzeile {}
