import { Routes } from '@angular/router';
import { ungespeichertGuard } from '../../core/ungespeichert/ungespeichert.guard';
import { NeuerVertragSeite } from './neuer-vertrag/neuer-vertrag-seite';
import { VertraegeSeite } from './vertraege-seite';

export const VERTRAEGE_ROUTES: Routes = [
  {
    path: '',
    component: VertraegeSeite,
    canDeactivate: [ungespeichertGuard],
    title: 'Verträge – Haushaltsbuch',
  },
  {
    path: 'neu',
    component: NeuerVertragSeite,
    canDeactivate: [ungespeichertGuard],
    title: 'Neuer Vertrag – Haushaltsbuch',
  },
];
