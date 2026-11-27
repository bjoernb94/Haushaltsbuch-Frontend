import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Benachrichtigungen } from '../benachrichtigungen/benachrichtigungen';
import { problemCode } from '../fehler/problem';
import { UngespeicherteEingaben } from '../ungespeichert/ungespeicherte-eingaben';
import { OHNE_ANMELDE_UMLEITUNG } from './auth-context';
import { STARTSEITE } from './auth.guards';
import { AuthService, KOMPONENTEN_URL } from './auth.service';

/**
 * Das Backend antwortet auf nicht angemeldete Aufrufe unter /api/** mit 401, z. B. wenn die
 * Session abgelaufen ist. Dann geht es zum Login, mit dem Hinweis darauf, und danach zurück zur
 * aktuellen Seite. Ein
 * weiteres 401 paralleler Aufrufe darf die returnUrl auf dem Login nicht überschreiben.
 *
 * 403 KEIN_ZUGRIFF heißt, die Komponente ist inzwischen abbestellt: Komponenten neu laden und zur
 * Startseite. Das gilt nicht für deren eigenen Abruf, sonst entstünde eine Schleife.
 *
 * Beide Umleitungen müssen passieren: Ungespeicherte Eingaben halten sie nicht mit einer Rückfrage auf.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const ungespeichert = inject(UngespeicherteEingaben);
  const benachrichtigungen = inject(Benachrichtigungen);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        req.url.startsWith('/api/') &&
        !req.context.get(OHNE_ANMELDE_UMLEITUNG)
      ) {
        auth.zuruecksetzen();
        if (router.url.split('?')[0] !== '/login') {
          ungespeichert.vergessen();
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          // Nach dem Zurücksetzen gemeldet: ein Toast vor dem Login, bis die Anmeldung gelingt.
          benachrichtigungen.melden({
            art: 'info',
            titel: 'Deine Sitzung ist abgelaufen.',
            text: 'Bitte melde dich erneut an.',
            dauerhaft: true,
          });
        }
      }
      if (problemCode(error) === 'KEIN_ZUGRIFF' && req.url !== KOMPONENTEN_URL) {
        auth.komponentenLaden().subscribe(() => {
          ungespeichert.vergessen();
          void router.navigateByUrl(STARTSEITE);
        });
      }
      return throwError(() => error);
    }),
  );
};
