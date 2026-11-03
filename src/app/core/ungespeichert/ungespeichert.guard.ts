import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { UngespeicherteEingaben } from './ungespeicherte-eingaben';

/** Seiten mit Formular nur nach Rückfrage verlassen, auch über Menü und Zurück-Button. */
export const ungespeichertGuard: CanDeactivateFn<unknown> = () =>
  inject(UngespeicherteEingaben).bestaetigen();
