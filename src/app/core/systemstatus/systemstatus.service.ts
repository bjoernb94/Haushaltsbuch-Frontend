import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, Observable, of, switchMap, tap, timeout, timer } from 'rxjs';

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

/**
 * Längste Wartezeit auf eine Antwort. Hängt das Backend (z. B. beim DB-Check, der bis zum
 * Verbindungs-Timeout des Pools wartet), gilt das wie keine Antwort. Deutlich unter
 * {@link AKTUALISIERUNG_MS}, sonst bricht die nächste Abfrage die laufende ab und es kommt nie
 * ein Ergebnis an.
 */
export const ANTWORT_TIMEOUT_MS = 5_000;

// Ohne Backend ist über die anderen Dienste nichts bekannt; sie gelten dann ebenfalls als nicht
// erreichbar, damit die Seite nichts über den Aufbau verrät.
const NICHTS_ERREICHBAR: Systemstatus = { backend: false, datenbank: false, anmeldeserver: false };

@Injectable({ providedIn: 'root' })
export class SystemstatusService {
  private readonly http = inject(HttpClient);

  /**
   * Letzter bekannter Status, damit z. B. der Wechsel zwischen Login und Registrierung die
   * Anzeige nicht bis zur nächsten Antwort ausblendet.
   */
  letzterStatus: Systemstatus | undefined;

  /** Fragt den Status sofort und danach alle 30 s ab. */
  beobachten(): Observable<Systemstatus> {
    return timer(0, AKTUALISIERUNG_MS).pipe(
      switchMap(() => this.abfragen()),
      tap((status) => (this.letzterStatus = status)),
    );
  }

  abfragen(): Observable<Systemstatus> {
    return this.http.get<HealthAntwort>('/actuator/health/systemstatus').pipe(
      timeout(ANTWORT_TIMEOUT_MS),
      map(auswerten),
      catchError((error: unknown) =>
        // 503 heißt: Backend erreichbar, aber mindestens ein Dienst ist DOWN. Alles andere,
        // auch ein Timeout, zählt als keine Antwort.
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

/**
 * Systemstatus als Signal, solange die aufrufende Komponente lebt (Injection Context nötig).
 * {@code status} ist {@code undefined}, bis die erste Antwort (oder der Timeout) da ist; bis dahin
 * ist nichts gesperrt. Ist schon ein Status bekannt, startet das Signal mit diesem.
 */
export function systemstatusBeobachten(): {
  status: Signal<Systemstatus | undefined>;
  gesperrt: Signal<boolean>;
} {
  const service = inject(SystemstatusService);
  const status = toSignal<Systemstatus | undefined, Systemstatus | undefined>(
    service.beobachten(),
    {
      initialValue: service.letzterStatus,
    },
  );
  const gesperrt = computed(() => {
    const s = status();
    return s !== undefined && !allesErreichbar(s);
  });
  return { status, gesperrt };
}
