import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface NavEintrag {
  pfad: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly navigation: NavEintrag[] = [
    { pfad: '/buchungen', label: 'Buchungen', icon: 'receipt_long' },
    { pfad: '/vertraege', label: 'Verträge', icon: 'description' },
    { pfad: '/versorgung', label: 'Versorgung', icon: 'bolt' },
    { pfad: '/portfolio', label: 'Portfolio', icon: 'trending_up' },
    { pfad: '/nutzer', label: 'Nutzer', icon: 'person' },
  ];
}
