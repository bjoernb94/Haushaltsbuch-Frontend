import { Routes } from '@angular/router';
import { abgemeldetGuard, angemeldetGuard } from './core/auth/auth.guards';

// Anmeldung (Login, Registrierung) ohne Navigation. Start und die Fachbereiche (ein Feature-Ordner
// je Backend-Modul) liegen in der Shell und brauchen eine Session. Alles lazy geladen.
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [abgemeldetGuard],
    loadComponent: () => import('./features/anmeldung/login/login-seite').then((m) => m.LoginSeite),
    title: 'Anmelden – Haushaltsbuch',
  },
  {
    path: 'registrierung',
    canActivate: [abgemeldetGuard],
    loadComponent: () =>
      import('./features/anmeldung/registrierung/registrierung-seite').then(
        (m) => m.RegistrierungSeite,
      ),
    title: 'Registrieren – Haushaltsbuch',
  },
  {
    path: '',
    // Lazy, damit Angular Material nicht im Start-Bundle von Login und Registrierung landet.
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    canActivate: [angemeldetGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'start' },
      {
        path: 'start',
        loadChildren: () => import('./features/start/start.routes').then((m) => m.START_ROUTES),
      },
      {
        path: 'buchungen',
        loadChildren: () =>
          import('./features/buchungen/buchungen.routes').then((m) => m.BUCHUNGEN_ROUTES),
      },
      {
        path: 'vertraege',
        loadChildren: () =>
          import('./features/vertraege/vertraege.routes').then((m) => m.VERTRAEGE_ROUTES),
      },
      {
        path: 'versorgung',
        loadChildren: () =>
          import('./features/versorgung/versorgung.routes').then((m) => m.VERSORGUNG_ROUTES),
      },
      {
        path: 'portfolio',
        loadChildren: () =>
          import('./features/portfolio/portfolio.routes').then((m) => m.PORTFOLIO_ROUTES),
      },
      {
        path: 'nutzer',
        loadChildren: () => import('./features/nutzer/nutzer.routes').then((m) => m.NUTZER_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: 'start' },
];
