import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { Fusszeile } from '../shared/fusszeile/fusszeile';
import { HinweisBox } from '../shared/hinweis-box/hinweis-box';
import { Kopfzeile } from '../shared/kopfzeile/kopfzeile';
import { Seitenaktionen } from '../shared/seitenaktionen/seitenaktionen';
import { VerwerfenDialog } from '../shared/verwerfen-dialog/verwerfen-dialog';
import { Hauptmenue } from './hauptmenue/hauptmenue';

/**
 * Rahmen der angemeldeten Bereiche, auf allen Seiten gleich: ab 901 px links die Seitenleiste, daneben
 * die Kopfzeile mit Titel und Hauptaktion der Seite, darunter die Fußzeile über die ganze Breite. Bis
 * 900 px die Kopfzeile und unten die Tab-Leiste, ohne Fußzeile; eine Seite mit eigener Leiste
 * (Seitenaktionen) hat beides nicht. Den Systemstatus zeigen hier nur die Einstellungen.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Hauptmenue, Fusszeile, HinweisBox, Kopfzeile, VerwerfenDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);

  protected readonly komponentenFehler = this.auth.komponentenFehler;
  protected readonly aktionen = inject(Seitenaktionen).aktionen;

  protected komponentenLaden(): void {
    this.auth.komponentenLaden().subscribe();
  }
}
