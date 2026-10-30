import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { systemstatusBeobachten } from '../core/systemstatus/systemstatus.service';
import { SystemstatusLeiste } from '../shared/systemstatus-leiste/systemstatus-leiste';

interface NavEintrag {
  pfad: string;
  label: string;
  icon: string;
}

/** Rahmen der angemeldeten Bereiche: Kopfzeile und Navigation. */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    SystemstatusLeiste,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly nutzer = this.auth.nutzer;

  /** Nur zur Anzeige in der Fußzeile; in der App wird nichts gesperrt. */
  protected readonly systemstatus = systemstatusBeobachten();

  protected readonly navigation: NavEintrag[] = [
    { pfad: '/start', label: 'Start', icon: 'home' },
    { pfad: '/buchungen', label: 'Buchungen', icon: 'receipt_long' },
    { pfad: '/vertraege', label: 'Verträge', icon: 'description' },
    { pfad: '/versorgung', label: 'Versorgung', icon: 'bolt' },
    { pfad: '/portfolio', label: 'Portfolio', icon: 'trending_up' },
    { pfad: '/nutzer', label: 'Nutzer', icon: 'person' },
  ];

  protected abmelden(): void {
    // Auch wenn das Backend nicht antwortet, ist der Nutzer im Frontend abgemeldet.
    this.auth.abmelden().subscribe({
      complete: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }
}
