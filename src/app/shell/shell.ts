import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { Fusszeile } from '../shared/fusszeile/fusszeile';
import { HinweisBox } from '../shared/hinweis-box/hinweis-box';
import { Kopfzeile } from '../shared/kopfzeile/kopfzeile';
import { VerwerfenDialog } from '../shared/verwerfen-dialog/verwerfen-dialog';
import { Hauptmenue } from './hauptmenue/hauptmenue';

/**
 * Rahmen der angemeldeten Bereiche, gemäß Design in zwei Layouts: Die Startseite (Route-Data
 * {@code ohneNavigation}) navigiert über ihre Kacheln, die übrigen Bereiche über die
 * Seitennavigation.
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
  private readonly router = inject(Router);

  protected readonly komponentenFehler = this.auth.komponentenFehler;

  protected readonly mitNavigation = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.routeMitNavigation()),
    ),
    { initialValue: this.routeMitNavigation() },
  );

  protected komponentenLaden(): void {
    this.auth.komponentenLaden().subscribe();
  }

  private routeMitNavigation(): boolean {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return !route.data['ohneNavigation'];
  }
}
