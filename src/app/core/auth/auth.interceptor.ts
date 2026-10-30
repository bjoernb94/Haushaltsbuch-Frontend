import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { OHNE_ANMELDE_UMLEITUNG } from './auth-context';
import { AuthService } from './auth.service';

/**
 * Das Backend antwortet auf nicht angemeldete Aufrufe unter /api/** mit 401, z. B. wenn die
 * Session abgelaufen ist. Dann geht es zum Login und danach zurück zur aktuellen Seite.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        req.url.startsWith('/api/') &&
        !req.context.get(OHNE_ANMELDE_UMLEITUNG)
      ) {
        auth.zuruecksetzen();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }),
  );
};
