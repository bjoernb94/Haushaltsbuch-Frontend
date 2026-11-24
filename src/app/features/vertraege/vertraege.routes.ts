import { Routes } from '@angular/router';
import { ungespeichertGuard } from '../../core/ungespeichert/ungespeichert.guard';
import { NeuerVertragSeite } from './formular/neuer-vertrag/neuer-vertrag-seite';
import { VertragBearbeiten } from './formular/vertrag-bearbeiten/vertrag-bearbeiten';
import { VertragWiederaufnehmen } from './formular/wiederaufnahme/vertrag-wiederaufnehmen';
import { VertragDetails } from './details/vertrag-details';
import { VertraegeSeite } from './liste/vertraege-seite';

// „neu“ vor der Liste, sonst nähme ihre Kind-Route :id es als ID.
export const VERTRAEGE_ROUTES: Routes = [
  {
    path: 'neu',
    component: NeuerVertragSeite,
    canDeactivate: [ungespeichertGuard],
    title: 'Neuer Vertrag – Haushaltsbuch',
  },
  {
    path: '',
    component: VertraegeSeite,
    title: 'Verträge – Haushaltsbuch',
    children: [
      {
        path: ':id',
        component: VertragDetails,
        children: [
          { path: '', children: [] },
          {
            path: 'bearbeiten',
            component: VertragBearbeiten,
            canDeactivate: [ungespeichertGuard],
            title: 'Vertrag bearbeiten – Haushaltsbuch',
          },
          {
            path: 'wiederaufnehmen',
            component: VertragWiederaufnehmen,
            canDeactivate: [ungespeichertGuard],
            title: 'Vertrag wieder aufnehmen – Haushaltsbuch',
          },
        ],
      },
    ],
  },
];
