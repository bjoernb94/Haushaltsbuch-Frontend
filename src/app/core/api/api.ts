import { components } from './api.generated';

type Schemas = components['schemas'];

export type Betrag = Schemas['Betrag'];
export type Feldfehler = Schemas['Feldfehler'];
export type Komponente = Schemas['Komponente'];
export type Profil = Schemas['Profil'];
export type RegistrierungAnfrage = Schemas['RegistrierungAnfrage'];
export type VertragAntwort = Schemas['VertragAntwort'];
export type Zahlweise = Schemas['Zahlweise'];

/**
 * Fehlerantwort des Backends (ProblemDetail, siehe docs/api.md und ADR 0007 im Backend). Das
 * Feld {@code detail} fehlt hier bewusst: Es ist englisch und nur für Entwickler gedacht.
 */
export type Problem = Omit<Schemas['Problem'], 'detail'>;
