import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/** Startet den Login-Flow im Backend (BFF, Spring Security oauth2Login). */
export const LOGIN_URL = '/oauth2/authorization/keycloak';

/**
 * Das Backend antwortet auf nicht angemeldete Aufrufe unter /api/** mit 401 statt
 * mit einem Redirect. In dem Fall wird die ganze Seite auf den Login-Flow umgeleitet;
 * nach dem Login landet der Browser wieder in der SPA.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        req.url.startsWith('/api/')
      ) {
        window.location.href = LOGIN_URL;
      }
      return throwError(() => error);
    }),
  );
