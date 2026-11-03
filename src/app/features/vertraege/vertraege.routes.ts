import { Routes } from '@angular/router';
import { NeuerVertragSeite } from './neuer-vertrag/neuer-vertrag-seite';
import { VertraegeSeite } from './vertraege-seite';

export const VERTRAEGE_ROUTES: Routes = [
  { path: '', component: VertraegeSeite, title: 'Verträge – Haushaltsbuch' },
  { path: 'neu', component: NeuerVertragSeite, title: 'Neuer Vertrag – Haushaltsbuch' },
];
