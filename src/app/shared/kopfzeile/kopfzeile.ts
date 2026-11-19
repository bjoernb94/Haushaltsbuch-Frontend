import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Logo } from '../logo/logo';
import { Nutzermenue } from '../nutzermenue/nutzermenue';
import { Seitenaktionen } from '../seitenaktionen/seitenaktionen';
import { ZurueckLink } from '../zurueck-link/zurueck-link';

/**
 * Kopfzeile mit Logo und, mit Session, dem Nutzermenü. In der Shell und auf Impressum und
 * Datenschutz gleich, damit Logo und Nutzer-Button beim Wechsel nicht springen. Neben der
 * Seitenleiste (ab 901 px) fällt sie weg, nur das Nutzermenü bleibt und sitzt unten in der Leiste.
 * So gibt es das Menü immer nur einmal, auch wenn das Fenster die Breite wechselt. Bis 900 px bleibt
 * sie durchscheinend oben stehen, ohne Logo, dafür mit den Aktionen der Seite („Zurück“, „+“).
 */
@Component({
  selector: 'app-kopfzeile',
  imports: [Logo, Nutzermenue, RouterLink, ZurueckLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kopfzeile.html',
  styleUrl: './kopfzeile.scss',
  host: {
    '[class.seitenleiste]': 'seitenleiste()',
    '[class.menue-offen]': 'menueOffen()',
  },
})
export class Kopfzeile {
  readonly seitenleiste = input(false);

  protected readonly aktionen = inject(Seitenaktionen).aktionen;
  protected readonly menueOffen = signal(false);
}
