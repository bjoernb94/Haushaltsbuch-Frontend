import { Routes } from '@angular/router';
import { BuchungenSeite } from './buchungen-seite';

export const BUCHUNGEN_ROUTES: Routes = [
  { path: '', component: BuchungenSeite, title: 'Buchungen – Haushaltsbuch' },
];
