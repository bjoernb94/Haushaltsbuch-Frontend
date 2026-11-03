import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { systemstatusBeobachten } from '../core/systemstatus/systemstatus.service';
import { UngespeicherteEingaben } from '../core/ungespeichert/ungespeicherte-eingaben';
import { HinweisBox } from '../shared/hinweis-box/hinweis-box';
import { SystemstatusLeiste } from '../shared/systemstatus-leiste/systemstatus-leiste';
import { VerwerfenDialog } from '../shared/verwerfen-dialog/verwerfen-dialog';
import { Hauptmenue } from './hauptmenue/hauptmenue';

/**
 * Rahmen der angemeldeten Bereiche, gemäß Design in zwei Layouts: Die Startseite (Route-Data
 * {@code ohneNavigation}) navigiert über ihre Kacheln, die übrigen Bereiche über die
 * Seitennavigation.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Hauptmenue, HinweisBox, SystemstatusLeiste, VerwerfenDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ungespeichert = inject(UngespeicherteEingaben);

  /** Nur zur Anzeige in der Fußzeile; in der App wird nichts gesperrt. */
  protected readonly systemstatus = systemstatusBeobachten();

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

  protected async abmelden(): Promise<void> {
    // Vor dem Abmelden fragen: Danach wäre die Sitzung schon fort, wenn der Guard beim Seitenwechsel fragt.
    if (!(await this.ungespeichert.bestaetigen())) {
      return;
    }
    // Auch wenn das Backend nicht antwortet, ist der Nutzer im Frontend abgemeldet.
    this.auth.abmelden().subscribe({
      complete: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }

  private routeMitNavigation(): boolean {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return !route.data['ohneNavigation'];
  }
}
