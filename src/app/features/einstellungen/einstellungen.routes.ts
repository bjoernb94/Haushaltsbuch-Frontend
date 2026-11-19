import { Routes } from '@angular/router';
import { ungespeichertGuard } from '../../core/ungespeichert/ungespeichert.guard';
import { EinstellungenSeite } from './einstellungen-seite';

/** Einstellungen und ihre Unterseiten, aus dem Nutzermenü erreichbar. */
export const EINSTELLUNGEN_ROUTES: Routes = [
  { path: '', component: EinstellungenSeite, title: 'Einstellungen – Haushaltsbuch' },
  {
    path: 'profil',
    loadComponent: () => import('./profil/profil-seite').then((m) => m.ProfilSeite),
    title: 'Profil – Haushaltsbuch',
  },
  {
    path: 'komponenten',
    loadComponent: () => import('./komponenten/komponenten-seite').then((m) => m.KomponentenSeite),
    title: 'Komponenten – Haushaltsbuch',
    canDeactivate: [ungespeichertGuard],
  },
];
