import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  VertragAenderung,
  VertragAnfrage,
  VertragAntwort,
  VertragKategorieAntwort,
  VertragPreisAnfrage,
  VertragsuebersichtAntwort,
  VertragVorschauAnfrage,
  VertragVorschauAntwort,
} from '../../core/api/api';

/**
 * Was ein Formular schickt: Fehlt eine Eingabe, ist der Wert {@code null}, und das Backend antwortet
 * mit einem Feldfehler (ADR 0010).
 */
export type Eingabe<T> = { [F in keyof T]: T[F] | null };

/** Ein Preis der Liste; wie {@link Eingabe}, auch der Betrag fehlt als {@code null}. */
export type PreisEingabe = Eingabe<VertragPreisAnfrage>;

export type VertragEingabe = Eingabe<Omit<VertragAnfrage, 'preise'>> & { preise: PreisEingabe[] };

const VERTRAEGE_URL = '/api/vertraege';

/**
 * Zugriff auf die Verträge, siehe docs/api.md im Backend. Hält keine Daten, die Seiten laden sie
 * beim Öffnen und nach Änderungen neu. Fehler: Auswertung über {@code problemCode}.
 */
@Injectable({ providedIn: 'root' })
export class VertragService {
  private readonly http = inject(HttpClient);

  /** In der Reihenfolge des Backends. */
  auflisten(): Observable<VertragAntwort[]> {
    return this.http.get<VertragAntwort[]>(VERTRAEGE_URL);
  }

  anlegen(vertrag: VertragEingabe): Observable<VertragAntwort> {
    return this.http.post<VertragAntwort>(VERTRAEGE_URL, vertrag);
  }

  /** Veraltete {@code version}: 409 KONFLIKT. */
  aendern(
    id: string,
    vertrag: VertragEingabe & Pick<VertragAenderung, 'version'>,
  ): Observable<VertragAntwort> {
    return this.http.put<VertragAntwort>(`${VERTRAEGE_URL}/${id}`, vertrag);
  }

  /** Veraltete {@code version}: 409 KONFLIKT. */
  loeschen(id: string, version: number): Observable<void> {
    return this.http.delete<void>(`${VERTRAEGE_URL}/${id}`, { params: { version } });
  }

  kategorien(): Observable<VertragKategorieAntwort[]> {
    return this.http.get<VertragKategorieAntwort[]>(`${VERTRAEGE_URL}/kategorien`);
  }

  uebersicht(): Observable<VertragsuebersichtAntwort> {
    return this.http.get<VertragsuebersichtAntwort>(`${VERTRAEGE_URL}/uebersicht`);
  }

  /** Berechnete Werte für das Formular, speichert nichts. */
  vorschau(anfrage: VertragVorschauAnfrage): Observable<VertragVorschauAntwort> {
    return this.http.post<VertragVorschauAntwort>(`${VERTRAEGE_URL}/vorschau`, anfrage);
  }
}
