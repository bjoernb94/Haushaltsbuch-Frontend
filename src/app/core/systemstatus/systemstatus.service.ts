import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, switchMap, timer } from 'rxjs';

/** Erreichbarkeit der Dienste, die für die Anmeldung nötig sind. */
export interface Systemstatus {
  backend: boolean;
  datenbank: boolean;
  anmeldeserver: boolean;
}

/** Ausschnitt der Antwort von /actuator/health/systemstatus. */
interface HealthAntwort {
  components?: Record<string, { status?: string } | undefined>;
}

export const AKTUALISIERUNG_MS = 30_000;

// Ohne Backend ist über die anderen Dienste nichts bekannt; sie gelten dann ebenfalls als nicht
// erreichbar, damit die Seite nichts über den Aufbau verrät.
const NICHTS_ERREICHBAR: Systemstatus = { backend: false, datenbank: false, anmeldeserver: false };

@Injectable({ providedIn: 'root' })
export class SystemstatusService {
  private readonly http = inject(HttpClient);

  /** Fragt den Status sofort und danach alle 30 s ab. */
  beobachten(): Observable<Systemstatus> {
    return timer(0, AKTUALISIERUNG_MS).pipe(switchMap(() => this.abfragen()));
  }

  abfragen(): Observable<Systemstatus> {
    return this.http.get<HealthAntwort>('/actuator/health/systemstatus').pipe(
      map(auswerten),
      catchError((error: unknown) =>
        // 503 heißt: Backend erreichbar, aber mindestens ein Dienst ist DOWN.
        of(
          error instanceof HttpErrorResponse && error.status === 503 && error.error?.components
            ? auswerten(error.error as HealthAntwort)
            : NICHTS_ERREICHBAR,
        ),
      ),
    );
  }
}

function auswerten(antwort: HealthAntwort): Systemstatus {
  const up = (name: string) => antwort.components?.[name]?.status === 'UP';
  return { backend: true, datenbank: up('db'), anmeldeserver: up('keycloak') };
}

export function allesErreichbar(status: Systemstatus): boolean {
  return status.backend && status.datenbank && status.anmeldeserver;
}
