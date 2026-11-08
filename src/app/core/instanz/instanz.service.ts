import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { timeout } from 'rxjs';

/** Angaben des Betreibers dieser Instanz für Impressum und Datenschutzerklärung. */
export interface Instanzangaben {
  betreiber: { name: string; anschrift: string[]; email: string };
  rechtsgrundlage: string;
  speicherort: string;
  logAufbewahrungTage: number;
  /** ISO-Datum. */
  stand: string;
  lizenz?: string;
  /** Link zum Quellcode, nur http(s). */
  quellcode?: string;
}

export type Instanzstand =
  | { zustand: 'laedt' }
  /** Keine oder unvollständige Datei: Der Betreiber hat nichts hinterlegt. */
  | { zustand: 'fehlt' }
  | { zustand: 'fehler' }
  | { zustand: 'da'; angaben: Instanzangaben };

/** Hängt der Betreiber ins Image ein (siehe README); nginx liefert ohne Datei 404. */
export const INSTANZ_URL = '/instanz.json';

const ANTWORT_TIMEOUT_MS = 5_000;

/** Lädt die Angaben des Betreibers einmal; nach einem Fehler beim nächsten Aufruf erneut. */
@Injectable({ providedIn: 'root' })
export class InstanzService {
  private readonly http = inject(HttpClient);

  private readonly _stand = signal<Instanzstand>({ zustand: 'laedt' });
  private geladen = false;
  private laedt = false;

  readonly stand = this._stand.asReadonly();

  laden(): void {
    if (this.geladen || this.laedt) {
      return;
    }
    this.laedt = true;
    this._stand.set({ zustand: 'laedt' });
    this.http
      .get<unknown>(INSTANZ_URL)
      .pipe(timeout(ANTWORT_TIMEOUT_MS))
      .subscribe({
        next: (antwort) => this.fertig(pruefen(antwort)),
        // 404 und ein Text statt JSON (z. B. index.html bei npm start) heißen: nichts hinterlegt.
        error: (error: unknown) =>
          this.fertig(
            error instanceof HttpErrorResponse && (error.status === 404 || error.status === 200)
              ? { zustand: 'fehlt' }
              : { zustand: 'fehler' },
          ),
      });
  }

  private fertig(stand: Instanzstand): void {
    this.laedt = false;
    this.geladen = stand.zustand !== 'fehler';
    this._stand.set(stand);
  }
}

const text = (wert: unknown): wert is string => typeof wert === 'string' && wert.trim() !== '';

function pruefen(antwort: unknown): Instanzstand {
  const a = (antwort ?? {}) as Record<string, unknown>;
  const b = (a['betreiber'] ?? {}) as Record<string, unknown>;
  const anschrift = b['anschrift'];
  const tage = a['logAufbewahrungTage'];
  const vollstaendig =
    text(b['name']) &&
    Array.isArray(anschrift) &&
    anschrift.length > 0 &&
    anschrift.every(text) &&
    text(b['email']) &&
    text(a['rechtsgrundlage']) &&
    text(a['speicherort']) &&
    typeof tage === 'number' &&
    Number.isInteger(tage) &&
    tage > 0 &&
    typeof a['stand'] === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(a['stand']);
  if (!vollstaendig) {
    return { zustand: 'fehlt' };
  }
  const lizenz = a['lizenz'];
  const quellcode = a['quellcode'];
  return {
    zustand: 'da',
    angaben: {
      betreiber: {
        name: b['name'] as string,
        anschrift: anschrift as string[],
        email: b['email'] as string,
      },
      rechtsgrundlage: a['rechtsgrundlage'] as string,
      speicherort: a['speicherort'] as string,
      logAufbewahrungTage: tage,
      stand: a['stand'] as string,
      lizenz: text(lizenz) ? lizenz : undefined,
      quellcode: text(quellcode) && /^https?:\/\//.test(quellcode) ? quellcode : undefined,
    },
  };
}
