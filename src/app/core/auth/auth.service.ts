import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, switchMap, tap } from 'rxjs';
import { Komponente, KomponentenAntwort, ProfilAntwort, RegistrierungAnfrage } from '../api/api';
import { OHNE_ANMELDE_UMLEITUNG } from './auth-context';

export const KOMPONENTEN_URL = '/api/nutzer/ich/komponenten';

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
  private readonly aktuellerNutzer = signal<ProfilAntwort | null | undefined>(undefined);

  /** {@code null}, solange die gebuchten Komponenten nicht geladen werden konnten. */
  private readonly gebuchteKomponenten = signal<Komponente[] | null>(null);

  readonly nutzer = computed(() => this.aktuellerNutzer() ?? null);
  readonly angemeldet = computed(() => !!this.aktuellerNutzer());
  readonly komponenten = computed(() => this.gebuchteKomponenten() ?? []);
  readonly komponentenFehler = computed(
    () => this.angemeldet() && this.gebuchteKomponenten() === null,
  );

  /**
   * Liefert, ob eine Session besteht. Fragt nur beim ersten Aufruf das Backend; das setzt
   * nebenbei das XSRF-TOKEN-Cookie, das der Login-POST braucht.
   */
  sitzungPruefen(): Observable<boolean> {
    const bekannt = this.aktuellerNutzer();
    return bekannt === undefined ? this.nutzerLaden() : of(bekannt !== null);
  }

  /** Fehler: {@link HttpErrorResponse}, Auswertung über {@code problemCode}. */
  anmelden(email: string, passwort: string): Observable<void> {
    return this.http
      .post<void>('/api/anmeldung', { email, passwort }, { context: OHNE_UMLEITUNG() })
      .pipe(
        switchMap(() => this.nutzerLaden()),
        map(() => undefined),
      );
  }

  /**
   * Legt das Konto an; das Backend meldet den Nutzer danach direkt an. Liefert, ob diese
   * Anmeldung geklappt hat (sonst muss sich der Nutzer selbst anmelden).
   * Fehler: {@link HttpErrorResponse}, Auswertung über {@code problemCode}.
   */
  registrieren(registrierung: RegistrierungAnfrage): Observable<boolean> {
    return this.http
      .post<void>('/api/registrierung', registrierung, { context: OHNE_UMLEITUNG() })
      .pipe(switchMap(() => this.nutzerLaden()));
  }

  abmelden(): Observable<void> {
    return this.http
      .post<void>('/api/abmeldung', null, { context: OHNE_UMLEITUNG() })
      .pipe(tap({ finalize: () => this.zuruecksetzen() }));
  }

  /**
   * Lädt die gebuchten Komponenten neu. Scheitert das, bleibt der Nutzer angemeldet und
   * {@code komponentenFehler} ist gesetzt; ein 401 behandelt der {@code authInterceptor}.
   */
  komponentenLaden(): Observable<void> {
    // Die Version braucht nur die Seite, die die Komponenten ändert; sie lädt sie selbst.
    return this.http.get<KomponentenAntwort>(KOMPONENTEN_URL).pipe(
      map(({ komponenten }) => this.gebuchteKomponenten.set(komponenten)),
      catchError(() => {
        this.gebuchteKomponenten.set(null);
        return of(undefined);
      }),
    );
  }

  /** Vergisst den Nutzer, z. B. wenn das Backend die Session beendet hat (401). */
  zuruecksetzen(): void {
    this.aktuellerNutzer.set(null);
    this.gebuchteKomponenten.set(null);
  }

  private nutzerLaden(): Observable<boolean> {
    return this.http.get<ProfilAntwort>('/api/nutzer/ich', { context: OHNE_UMLEITUNG() }).pipe(
      tap((nutzer) => this.aktuellerNutzer.set(nutzer)),
      switchMap(() => this.komponentenLaden()),
      map(() => this.angemeldet()),
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
