import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Komponente } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { istVerfuegbar } from '../core/komponenten/komponente';
import { systemstatusBeobachten } from '../core/systemstatus/systemstatus.service';
import { HinweisBox } from '../shared/hinweis-box/hinweis-box';
import { SystemstatusLeiste } from '../shared/systemstatus-leiste/systemstatus-leiste';

interface NavEintrag {
  pfad: string;
  label: string;
  icon: string;
  /** Ohne Komponente immer sichtbar. */
  komponente?: Komponente;
}

const NAVIGATION: readonly NavEintrag[] = [
  { pfad: '/start', label: 'Start', icon: 'home' },
  { pfad: '/buchungen', label: 'Buchungen', icon: 'receipt_long', komponente: 'FINANZUEBERSICHT' },
  { pfad: '/vertraege', label: 'Verträge', icon: 'description', komponente: 'VERTRAGSUEBERSICHT' },
  { pfad: '/versorgung', label: 'Versorgung', icon: 'bolt', komponente: 'VERSORGUNGSVERTRAEGE' },
  { pfad: '/portfolio', label: 'Portfolio', icon: 'trending_up', komponente: 'PORTFOLIO' },
  { pfad: '/nutzer', label: 'Nutzer', icon: 'person' },
];

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
    HinweisBox,
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

  protected readonly komponentenFehler = this.auth.komponentenFehler;

  /** Nur gebuchte Bereiche; noch nicht verfügbare erscheinen ohne Link. */
  protected readonly navigation = computed(() =>
    NAVIGATION.filter((e) => !e.komponente || this.auth.komponenten().includes(e.komponente)).map(
      (e) => ({ ...e, demnaechst: !!e.komponente && !istVerfuegbar(e.komponente) }),
    ),
  );

  protected komponentenLaden(): void {
    this.auth.komponentenLaden().subscribe();
  }

  protected abmelden(): void {
    // Auch wenn das Backend nicht antwortet, ist der Nutzer im Frontend abgemeldet.
    this.auth.abmelden().subscribe({
      complete: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }
}
