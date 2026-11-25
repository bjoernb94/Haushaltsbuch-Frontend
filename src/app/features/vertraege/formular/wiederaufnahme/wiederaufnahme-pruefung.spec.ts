import { Feldfehler } from '../../../../core/api/api';
import { wiederaufnahmeFehlerTexte, wiederaufnahmePruefen } from './wiederaufnahme-pruefung';

const LEER = {
  datum: '',
  verlaengerung: '',
  laufzeitende: '',
  kuendigungsfristMonate: '',
  betrag: '',
} as const;

const fehler = (
  feld: string,
  code: string,
  parameter: Record<string, unknown> = {},
): Feldfehler => ({
  feld,
  code,
  parameter,
});

describe('Prüfung „Wieder aufnehmen“', () => {
  it('verlangt die Verlängerung nur bei kündbaren Verträgen', () => {
    expect([...wiederaufnahmePruefen(LEER, true).keys()]).toEqual(['datum', 'verlaengerung']);
    expect([...wiederaufnahmePruefen(LEER, false).keys()]).toEqual(['datum']);
  });

  it('nimmt einen leeren Betrag hin, aber keinen unlesbaren', () => {
    const werte = { ...LEER, datum: '2026-12-01', verlaengerung: 'MONATLICH' } as const;
    expect(wiederaufnahmePruefen(werte, true).size).toBe(0);
    expect(wiederaufnahmePruefen({ ...werte, betrag: '1.5' }, true).get('betrag')).toBe(
      'Bitte gib einen gültigen Betrag ein, z. B. 13,99.',
    );
  });

  it('ordnet die Fehler des Backends den Feldern zu, je Feld der erste', () => {
    const texte = wiederaufnahmeFehlerTexte([
      fehler('datum', 'PlausiblesDatum'),
      fehler('datum', 'NachVertragsende', { vertragsende: '2026-05-31' }),
      fehler('verlaengerung', 'NotNull'),
      fehler('laufzeitende', 'LaufzeitendeNachBeginn'),
      fehler('kuendigungsfristMonate', 'Max', { value: 24 }),
      fehler('betrag.waehrung', 'GleicheWaehrung'),
      fehler('version', 'NotNull'),
    ]);
    expect(Object.fromEntries(texte)).toEqual({
      datum: 'Bitte gib ein Datum zwischen dem 01.01.1900 und dem 31.12.2199 ein.',
      verlaengerung: 'Bitte wähle, wie sich der Vertrag verlängert.',
      laufzeitende: 'Das Laufzeitende liegt vor der Wiederaufnahme.',
      kuendigungsfristMonate: 'Höchstens 24 Monate.',
      betrag: 'Der Betrag braucht dieselbe Währung wie die Preise.',
    });
  });

  it('Betrag: größer 0 und nicht doppelt am Tag', () => {
    expect(wiederaufnahmeFehlerTexte([fehler('betrag', 'PositiverBetrag')]).get('betrag')).toBe(
      'Der Betrag muss größer als 0 sein.',
    );
    expect(wiederaufnahmeFehlerTexte([fehler('betrag.wert', 'NotNull')]).get('betrag')).toBe(
      'Bitte gib einen gültigen Betrag ein, z. B. 13,99.',
    );
  });
});
