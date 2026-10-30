import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, switchMap, tap } from 'rxjs';
import { OHNE_ANMELDE_UMLEITUNG } from './auth-context';

/** Profil des angemeldeten Nutzers, siehe GET /api/nutzer/ich im Backend. */
export interface Nutzer {
  vorname: string | null;
  name: string | null;
  email: string | null;
}

/** Wert von {@code grund} im ProblemDetail einer abgelehnten Anmeldung. */
export type AnmeldungFehlgrund = 'UNGUELTIG' | 'GESPERRT' | 'NICHT_EINGERICHTET';

const OHNE_UMLEITUNG = () => new HttpContext().set(OHNE_ANMELDE_UMLEITUNG, true);

/**
 * Anmeldung über das eigene Formular der SPA. Das Backend holt die Tokens bei Keycloak und
 * hält sie in der Session; die SPA kennt nur das Session-Cookie und fragt den Status über
 * GET /api/nutzer/ich ab.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  /** {@code undefined}, solange der Status noch nicht beim Backend abgefragt wurde. */
  private readonly aktuellerNutzer = signal<Nutzer | null | undefined>(undefined);

  readonly nutzer = computed(() => this.aktuellerNutzer() ?? null);
  readonly angemeldet = computed(() => !!this.aktuellerNutzer());

  /**
   * Liefert, ob eine Session besteht. Fragt nur beim ersten Aufruf das Backend; das setzt
   * nebenbei das XSRF-TOKEN-Cookie, das der Login-POST braucht.
   */
  sitzungPruefen(): Observable<boolean> {
    const bekannt = this.aktuellerNutzer();
    return bekannt === undefined ? this.nutzerLaden() : of(bekannt !== null);
  }

  /** Fehler: {@link HttpErrorResponse}, siehe {@link anmeldungFehlgrund}. */
  anmelden(email: string, passwort: string): Observable<void> {
    return this.http
      .post<void>('/api/anmeldung', { email, passwort }, { context: OHNE_UMLEITUNG() })
      .pipe(
        switchMap(() => this.nutzerLaden()),
        map(() => undefined),
      );
  }

  abmelden(): Observable<void> {
    return this.http
      .post<void>('/api/abmeldung', null, { context: OHNE_UMLEITUNG() })
      .pipe(tap({ finalize: () => this.zuruecksetzen() }));
  }

  /** Vergisst den Nutzer, z. B. wenn das Backend die Session beendet hat (401). */
  zuruecksetzen(): void {
    this.aktuellerNutzer.set(null);
  }

  private nutzerLaden(): Observable<boolean> {
    return this.http.get<Nutzer>('/api/nutzer/ich', { context: OHNE_UMLEITUNG() }).pipe(
      tap((nutzer) => this.aktuellerNutzer.set(nutzer)),
      map(() => true),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.zuruecksetzen();
        }
        // Backend nicht erreichbar o. Ä.: vorerst als abgemeldet behandeln (der Login zeigt
        // dann den Fehler), aber nicht merken, damit die nächste Prüfung es erneut versucht.
        return of(false);
      }),
    );
  }
}

/** Grund einer abgelehnten Anmeldung aus dem ProblemDetail des Backends, sonst {@code null}. */
export function anmeldungFehlgrund(error: unknown): AnmeldungFehlgrund | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const grund: unknown = error.error?.grund;
  return grund === 'UNGUELTIG' || grund === 'GESPERRT' || grund === 'NICHT_EINGERICHTET'
    ? grund
    : null;
}
