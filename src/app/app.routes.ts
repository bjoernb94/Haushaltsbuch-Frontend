import { Routes } from '@angular/router';

// Ein Feature-Ordner je Backend-Modul, jeweils lazy geladen.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'buchungen' },
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
  { path: '**', redirectTo: 'buchungen' },
];
