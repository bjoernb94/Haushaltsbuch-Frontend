import { Routes } from '@angular/router';
import { EinstellungenSeite } from './einstellungen-seite';

/** Einstellungen und ihre Unterseiten, aus dem Nutzermenü erreichbar. */
export const EINSTELLUNGEN_ROUTES: Routes = [
  { path: '', component: EinstellungenSeite, title: 'Einstellungen – Haushaltsbuch' },
  {
    path: 'profil',
    loadComponent: () => import('./profil/profil-seite').then((m) => m.ProfilSeite),
    title: 'Profil – Haushaltsbuch',
  },
];
