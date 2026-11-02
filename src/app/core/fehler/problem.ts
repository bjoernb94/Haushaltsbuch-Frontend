import { HttpErrorResponse } from '@angular/common/http';

/** Einzelner Verstoß aus {@code felder}; {@code code} ist z. B. NotBlank oder Size. */
export interface Feldfehler {
  feld: string;
  code: string;
  parameter: Record<string, unknown>;
}

/**
 * Fehlerantwort des Backends (ProblemDetail, siehe docs/api.md und ADR 0007 im Backend). Das
 * Feld {@code detail} fehlt hier bewusst: Es ist englisch und nur für Entwickler gedacht.
 */
export interface Problem {
  status: number;
  code: string;
  felder?: Feldfehler[];
}

function problem(error: unknown): Partial<Problem> | null {
  return error instanceof HttpErrorResponse && typeof error.error === 'object' ? error.error : null;
}

/** Stabiler Code der Fehlerantwort, sonst {@code null} (z. B. HTML-Fehlerseite eines Proxys). */
export function problemCode(error: unknown): string | null {
  const code = problem(error)?.code;
  return typeof code === 'string' ? code : null;
}

/** Feldfehler der Fehlerantwort, sonst leer. */
export function problemFelder(error: unknown): Feldfehler[] {
  const felder = problem(error)?.felder;
  return Array.isArray(felder) ? felder : [];
}
