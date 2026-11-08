import { Routes } from '@angular/router';
import { abgemeldetGuard, angemeldetGuard, bereichGuard } from './core/auth/auth.guards';

// Anmeldung (Login, Registrierung) sowie Impressum und Datenschutz ohne Navigation. Start und die Fachbereiche (ein Feature-Ordner
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
  // Mit und ohne Session erreichbar, deshalb ohne Guard und außerhalb der Shell.
  {
    path: 'impressum',
    loadComponent: () =>
      import('./features/rechtliches/impressum-seite').then((m) => m.ImpressumSeite),
    title: 'Impressum – Haushaltsbuch',
  },
  {
    path: 'datenschutz',
    loadComponent: () =>
      import('./features/rechtliches/datenschutz-seite').then((m) => m.DatenschutzSeite),
    title: 'Datenschutz – Haushaltsbuch',
  },
  {
    path: '',
    // Lazy, damit Login und Registrierung den Rahmen der App nicht mitladen.
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    canActivate: [angemeldetGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'start' },
      {
        path: 'start',
        data: { ohneNavigation: true },
        loadChildren: () => import('./features/start/start.routes').then((m) => m.START_ROUTES),
      },
      {
        path: 'vertraege',
        canActivate: [bereichGuard('VERTRAGSUEBERSICHT')],
        loadChildren: () =>
          import('./features/vertraege/vertraege.routes').then((m) => m.VERTRAEGE_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: 'start' },
];
