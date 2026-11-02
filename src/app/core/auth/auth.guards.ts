import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of } from 'rxjs';
import { Komponente } from '../api/api';
import { istVerfuegbar } from '../komponenten/komponente';
import { AuthService } from './auth.service';

/** Ziel nach der Anmeldung, wenn keine (gültige) returnUrl angegeben ist. */
export const STARTSEITE = '/start';

/** Bereiche der App nur mit Session, sonst zum Login (mit Rücksprung). */
export const angemeldetGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(AuthService)
    .sitzungPruefen()
    .pipe(
      map(
        (angemeldet) =>
          angemeldet || router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }),
      ),
    );
};

/** Login und Registrierung nur ohne Session; Angemeldete gehen direkt zur Startseite. */
export const abgemeldetGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .sitzungPruefen()
    .pipe(map((angemeldet) => (angemeldet ? router.parseUrl(STARTSEITE) : true)));
};

/**
 * Bereich einer Komponente nur, wenn sie gebucht und schon verfügbar ist, sonst zur Startseite.
 * Reine Anzeige, der Schutz liegt im Backend. Konnten die Komponenten nicht geladen werden, gibt
 * es hier einen neuen Versuch.
 */
export function bereichGuard(komponente: Komponente): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return (auth.komponentenFehler() ? auth.komponentenLaden() : of(undefined)).pipe(
      map(
        () =>
          (auth.komponenten().includes(komponente) && istVerfuegbar(komponente)) ||
          router.parseUrl(STARTSEITE),
      ),
    );
  };
}

/** Nur Pfade innerhalb der App, damit returnUrl nicht auf fremde Seiten führt. */
export function sichereRuecksprungUrl(url: string | null | undefined): string {
  return url?.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login')
    ? url
    : STARTSEITE;
}
