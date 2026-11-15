import { components } from './api.generated';

type Schemas = components['schemas'];

export type AnstehendeKuendigung = Schemas['AnstehendeKuendigung'];
export type Betrag = Schemas['Betrag'];
export type Feldfehler = Schemas['Feldfehler'];
export type Komponente = Schemas['Komponente'];
export type Kuendigung = Schemas['Kuendigung'];
export type Kuendigungsart = Schemas['Kuendigungsart'];
export type Preisaenderung = Schemas['Preisaenderung'];
export type Preiszeilenart = Schemas['Preiszeilenart'];
export type Prognosepreis = Schemas['Prognosepreis'];
export type Profil = Schemas['Profil'];
export type RegistrierungAnfrage = Schemas['RegistrierungAnfrage'];
export type Verlaengerung = Schemas['Verlaengerung'];
export type VertragAenderung = Schemas['VertragAenderung'];
export type VertragAnfrage = Schemas['VertragAnfrage'];
export type VertragAntwort = Schemas['VertragAntwort'];
export type VertragEinmalkostenAnfrage = Schemas['VertragEinmalkostenAnfrage'];
export type VertragPreisAnfrage = Schemas['VertragPreisAnfrage'];
export type VertragPreisAntwort = Schemas['VertragPreisAntwort'];
export type VertragKategorieAntwort = Schemas['VertragKategorieAntwort'];
export type VertragKategorieSchluessel = Schemas['VertragKategorieSchluessel'];
export type Vertragsstatus = Schemas['Vertragsstatus'];
export type VertragsuebersichtAntwort = Schemas['VertragsuebersichtAntwort'];
export type VertragVorschauAnfrage = Schemas['VertragVorschauAnfrage'];
export type VertragVorschauAntwort = Schemas['VertragVorschauAntwort'];
export type Zahlungsweg = Schemas['Zahlungsweg'];
export type Zahlweise = Schemas['Zahlweise'];

/**
 * Fehlerantwort des Backends (ProblemDetail, siehe docs/api.md und ADR 0007 im Backend). Das
 * Feld {@code detail} fehlt hier bewusst: Es ist englisch und nur für Entwickler gedacht.
 */
export type Problem = Omit<Schemas['Problem'], 'detail'>;
