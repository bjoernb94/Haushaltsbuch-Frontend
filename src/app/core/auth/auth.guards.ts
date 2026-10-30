import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
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

/** Nur Pfade innerhalb der App, damit returnUrl nicht auf fremde Seiten führt. */
export function sichereRuecksprungUrl(url: string | null | undefined): string {
  return url?.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login')
    ? url
    : STARTSEITE;
}
