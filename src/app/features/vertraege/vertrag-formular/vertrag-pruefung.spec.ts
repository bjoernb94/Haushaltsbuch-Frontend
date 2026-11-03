import {
  anfrageAus,
  betragLesen,
  feldfehlerTexte,
  vertragPruefen,
  VertragWerte,
} from './vertrag-pruefung';

const LEER: VertragWerte = {
  anbieter: '',
  bezeichnung: '',
  kategorieId: '',
  vertragsnummer: '',
  betrag: '',
  zahlweise: '',
  abbuchungAb: '',
  zahlungsweg: '',
  nichtKuendbar: false,
  beginn: '',
  laufzeitende: '',
  verlaengerung: '',
  kuendigungsfristMonate: '',
  gekuendigt: false,
  gekuendigtZum: '',
  notiz: '',
};

const PFLICHT: VertragWerte = {
  ...LEER,
  anbieter: 'Anbieter',
  kategorieId: 'k1',
  betrag: '19,99',
  zahlweise: 'MONATLICH',
  abbuchungAb: '2027-01-01',
};

describe('betragLesen', () => {
  it.each([
    ['19,99', 19.99],
    ['19', 19],
    [' 19,5 ', 19.5],
    ['1.234,56', 1234.56],
    ['1.234', 1234],
    ['1.000.000,00', 1000000],
    ['-5,00', -5],
    ['0', 0],
  ])('liest „%s“', (eingabe, wert) => {
    expect(betragLesen(eingabe)).toBe(wert);
  });

  it('rundet nicht, das Backend lehnt zu viele Nachkommastellen ab', () => {
    expect(betragLesen('19,999')).toBe(19.999);
  });

  it.each(['', 'abc', '12.50', '1.23', '1234.567', '1,2,3', '19,', ',5', '19 €', '1e5'])(
    'lehnt „%s“ ab, statt zu raten',
    (eingabe) => {
      expect(betragLesen(eingabe)).toBeNull();
    },
  );

  it('lehnt Beträge ab, die eine JSON-Zahl nicht genau wiedergibt', () => {
    expect(betragLesen('1234567890123,45')).toBe(1234567890123.45);
    expect(betragLesen('12345678901234567,89')).toBeNull();
  });
});

describe('vertragPruefen', () => {
  it('meldet alle leeren Pflichtfelder, Text bei Leerzeichen genügt nicht', () => {
    expect([...vertragPruefen({ ...LEER, anbieter: '  ' }).keys()]).toEqual([
      'anbieter',
      'kategorieId',
      'betrag',
      'zahlweise',
      'abbuchungAb',
    ]);
  });

  it('verlangt „Gekündigt zum“ nur mit Haken', () => {
    expect(vertragPruefen(PFLICHT).size).toBe(0);
    expect([...vertragPruefen({ ...PFLICHT, gekuendigt: true }).keys()]).toEqual(['gekuendigtZum']);
  });

  it('überlässt fachliche Regeln und nicht lesbare Beträge dem Backend', () => {
    const werte = {
      ...PFLICHT,
      betrag: '-1',
      beginn: '2027-01-01',
      laufzeitende: '2026-01-01',
    };
    expect(vertragPruefen(werte).size).toBe(0);
    expect(vertragPruefen({ ...PFLICHT, betrag: 'abc' }).size).toBe(0);
  });
});

describe('anfrageAus', () => {
  it('schickt leere Felder als null, nie als ""', () => {
    expect(anfrageAus(PFLICHT)).toEqual({
      anbieter: 'Anbieter',
      bezeichnung: null,
      kategorieId: 'k1',
      vertragsnummer: null,
      betrag: { wert: 19.99, waehrung: 'EUR' },
      zahlweise: 'MONATLICH',
      abbuchungAb: '2027-01-01',
      zahlungsweg: null,
      kuendbar: true,
      beginn: null,
      laufzeitende: null,
      verlaengerung: null,
      kuendigungsfristMonate: null,
      gekuendigtZum: null,
      notiz: null,
    });
    expect(Object.values(anfrageAus(LEER))).not.toContain('');
  });

  it('kürzt Texte und liest nur aus Leerzeichen bestehende als null', () => {
    const anfrage = anfrageAus({ ...PFLICHT, anbieter: ' A ', bezeichnung: '  ', notiz: ' N ' });
    expect(anfrage).toMatchObject({ anbieter: 'A', bezeichnung: null, notiz: 'N' });
  });

  it.each(['', 'abc', '12.50'])('schickt den Betrag „%s“ als null, nie als { wert: null }', (b) => {
    expect(anfrageAus({ ...PFLICHT, betrag: b }).betrag).toBeNull();
  });

  it('schickt die Frist als Zahl, auch 0', () => {
    expect(anfrageAus({ ...PFLICHT, kuendigungsfristMonate: '0' }).kuendigungsfristMonate).toBe(0);
    expect(anfrageAus({ ...PFLICHT, kuendigungsfristMonate: '3' }).kuendigungsfristMonate).toBe(3);
  });

  it('nicht kündbar: invertiert, ohne Verlängerung und Frist, aber mit Beginn und Laufzeitende', () => {
    const anfrage = anfrageAus({
      ...PFLICHT,
      nichtKuendbar: true,
      beginn: '2013-01-01',
      laufzeitende: '2030-12-31',
      verlaengerung: 'MONATLICH',
      kuendigungsfristMonate: '3',
    });
    expect(anfrage).toMatchObject({
      kuendbar: false,
      beginn: '2013-01-01',
      laufzeitende: '2030-12-31',
      verlaengerung: null,
      kuendigungsfristMonate: null,
    });
  });

  it('schickt „Gekündigt zum“ nur mit Haken', () => {
    const werte = { ...PFLICHT, gekuendigtZum: '2027-06-30' };
    expect(anfrageAus(werte).gekuendigtZum).toBeNull();
    expect(anfrageAus({ ...werte, gekuendigt: true }).gekuendigtZum).toBe('2027-06-30');
  });
});

describe('feldfehlerTexte', () => {
  const text = (feld: string, code: string, parameter = {}) =>
    feldfehlerTexte([{ feld, code, parameter }]);

  it.each([
    ['betrag', 'NotNull', {}, 'betrag', 'Bitte gib einen gültigen Betrag ein, z. B. 19,99.'],
    ['betrag', 'PositiverBetrag', {}, 'betrag', 'Der Betrag muss größer als 0 sein.'],
    ['betrag.wert', 'Digits', { fraction: 2 }, 'betrag', 'Höchstens 2 Nachkommastellen.'],
    ['betrag.waehrung', 'ErlaubteWaehrung', {}, 'betrag', 'Diese Währung ist nicht möglich.'],
    ['anbieter', 'NotBlank', {}, 'anbieter', 'Bitte gib den Anbieter ein.'],
    ['notiz', 'Size', { max: 1000 }, 'notiz', 'Höchstens 1000 Zeichen.'],
    [
      'kategorieId',
      'Unbekannt',
      {},
      'kategorieId',
      'Diese Kategorie gibt es nicht mehr. Bitte wähle eine andere.',
    ],
    [
      'laufzeitende',
      'LaufzeitendeNachBeginn',
      {},
      'laufzeitende',
      'Das Laufzeitende liegt vor dem Vertragsbeginn.',
    ],
    [
      'beginn',
      'PlausiblesDatum',
      {},
      'beginn',
      'Bitte gib ein Datum zwischen dem 01.01.1900 und dem 31.12.2199 ein.',
    ],
    [
      'kuendigungsfristMonate',
      'Max',
      { value: 24 },
      'kuendigungsfristMonate',
      'Höchstens 24 Monate.',
    ],
    [
      'kuendigungsfristMonate',
      'Min',
      { value: 0 },
      'kuendigungsfristMonate',
      'Mindestens 0 Monate.',
    ],
    ['notiz', 'NeuerCode', {}, 'notiz', 'Bitte prüfe diese Eingabe.'],
  ])('%s %s', (feld, code, parameter, formularfeld, erwartet) => {
    expect(text(feld, code, parameter).get(formularfeld as 'notiz')).toBe(erwartet);
  });

  it('übergeht Fehler ohne passendes Feld', () => {
    expect(feldfehlerTexte([{ code: 'Regel', parameter: {} }]).size).toBe(0);
    expect(text('unbekanntesFeld', 'NotNull').size).toBe(0);
  });

  it('zeigt je Feld den ersten Fehler', () => {
    const texte = feldfehlerTexte([
      { feld: 'betrag', code: 'PositiverBetrag', parameter: {} },
      { feld: 'betrag.wert', code: 'Digits', parameter: { fraction: 2 } },
    ]);
    expect(texte.get('betrag')).toBe('Der Betrag muss größer als 0 sein.');
  });
});
