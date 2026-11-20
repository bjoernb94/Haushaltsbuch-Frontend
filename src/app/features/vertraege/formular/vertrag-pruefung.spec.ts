import { VertragAntwort } from '../../../core/api/api';
import {
  anfrageAus,
  prozentLesen,
  vorschauAus,
  betragLesen,
  feldfehlerTexte,
  OHNE_STEIGERUNG,
  vertragPruefen,
  VertragWerte,
  werteAus,
} from './vertrag-pruefung';

const LEER: VertragWerte = {
  anbieter: '',
  bezeichnung: '',
  kategorieId: '',
  vertragsnummer: '',
  betrag: '',
  preise: [],
  anteilProzent: '',
  zahlweise: '',
  beginn: '',
  zahlungsweg: '',
  nichtKuendbar: false,
  laufzeitende: '',
  verlaengerung: '',
  kuendigungsfristMonate: '',
  gekuendigt: false,
  gekuendigtZum: '',
  notiz: '',
  einmalkosten: [],
  preisgarantieBis: '',
  ...OHNE_STEIGERUNG,
  erinnerungSonderkuendigung: true,
};

const PFLICHT: VertragWerte = {
  ...LEER,
  anbieter: 'Anbieter',
  kategorieId: 'k1',
  betrag: '19,99',
  zahlweise: 'MONATLICH',
  beginn: '2027-01-01',
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

describe('prozentLesen', () => {
  it.each([
    ['50', 50],
    ['33,3', 33.3],
    [' 100 ', 100],
    ['33,33', 33.33],
    ['0', 0],
    ['150', 150],
  ])('liest „%s“, die Grenzen prüft das Backend', (eingabe, wert) => {
    expect(prozentLesen(eingabe)).toBe(wert);
  });

  it.each(['', 'abc', '33.3', '50 %', ',5', '-5'])('lehnt „%s“ ab', (eingabe) => {
    expect(prozentLesen(eingabe)).toBeNull();
  });
});

describe('vertragPruefen', () => {
  it('meldet einen Anteil, der sich nicht lesen lässt; leer ist 100 %', () => {
    expect(vertragPruefen({ ...PFLICHT, anteilProzent: 'abc' }).get('anteilProzent')).toBe(
      'Bitte eine Zahl von 1 bis 100 mit höchstens einer Nachkommastelle.',
    );
    expect(vertragPruefen({ ...PFLICHT, anteilProzent: '' }).size).toBe(0);
    expect(vertragPruefen({ ...PFLICHT, anteilProzent: '150' }).size).toBe(0);
  });

  it('meldet alle leeren Pflichtfelder, Text bei Leerzeichen genügt nicht', () => {
    expect([...vertragPruefen({ ...LEER, anbieter: '  ' }).keys()]).toEqual([
      'anbieter',
      'kategorieId',
      'betrag',
      'zahlweise',
      'beginn',
    ]);
  });

  it('verlangt „Gekündigt zum“ nur mit Haken', () => {
    expect(vertragPruefen(PFLICHT).size).toBe(0);
    expect([...vertragPruefen({ ...PFLICHT, gekuendigt: true }).keys()]).toEqual(['gekuendigtZum']);
  });

  describe('Preise', () => {
    const MIT_BEGINN = { ...PFLICHT, beginn: '2026-01-01' };

    it('verlangt in jeder Zeile Datum und einen lesbaren Betrag, auch in der ersten', () => {
      const fehler = vertragPruefen({
        ...MIT_BEGINN,
        preise: [
          { gueltigAb: '', betrag: '' },
          { gueltigAb: '2026-06-01', betrag: '12.50' },
        ],
      });
      expect([...fehler.entries()]).toEqual([
        ['preise.0.gueltigAb', 'Bitte gib an, ab wann dieser Preis gilt.'],
        ['preise.0.betrag', 'Bitte gib einen gültigen Betrag ein, z. B. 19,99.'],
        ['preise.1.betrag', 'Bitte gib einen gültigen Betrag ein, z. B. 19,99.'],
      ]);
    });

    it('der Betrag braucht kein Datum, er gilt ab Vertragsbeginn', () => {
      const preise = [{ gueltigAb: '2027-01-01', betrag: '25' }];
      expect(vertragPruefen({ ...MIT_BEGINN, preise }).size).toBe(0);
    });
  });

  describe('Preissteigerung', () => {
    it('verlangt Wert und Datum nur mit eingeschaltetem Schalter', () => {
      expect(vertragPruefen(PFLICHT).size).toBe(0);
      expect([...vertragPruefen({ ...PFLICHT, steigt: true }).entries()]).toEqual([
        ['steigerungswert', 'Bitte gib an, um wie viel der Preis steigt.'],
        ['naechsteErhoehungAm', 'Bitte gib an, wann der Preis das nächste Mal steigt.'],
      ]);
      const regel = { steigerungswert: '2,5', naechsteErhoehungAm: '2027-01-01' };
      expect(vertragPruefen({ ...PFLICHT, steigt: true, ...regel }).size).toBe(0);
    });

    it('verlangt bei der Erhöhung als Betrag einen lesbaren Betrag', () => {
      const regel = { ...PFLICHT, steigt: true, naechsteErhoehungAm: '2027-01-01' };
      const betrag = { ...regel, steigerungsart: 'BETRAG' as const, steigerungswert: '1.50' };
      expect([...vertragPruefen(betrag).entries()]).toEqual([
        ['steigerungswert', 'Bitte gib einen gültigen Betrag ein, z. B. 19,99.'],
      ]);
      expect(vertragPruefen({ ...betrag, steigerungswert: '1,50' }).size).toBe(0);
    });
  });

  describe('Einmalkosten', () => {
    it('verlangt in jeder Zeile Wofür, Betrag und Fällig am', () => {
      const fehler = vertragPruefen({
        ...PFLICHT,
        einmalkosten: [
          { bezeichnung: ' ', betrag: '', faelligAm: '' },
          { bezeichnung: 'Router', betrag: '0', faelligAm: '2026-03-01' },
          { bezeichnung: 'Anschluss', betrag: 'abc', faelligAm: '2026-03-01' },
        ],
      });
      expect([...fehler.entries()]).toEqual([
        ['einmalkosten.0.bezeichnung', 'Bitte gib an, wofür die Kosten anfallen.'],
        ['einmalkosten.0.betrag', 'Bitte gib einen gültigen Betrag ein, z. B. 19,99.'],
        ['einmalkosten.0.faelligAm', 'Bitte gib an, wann die Kosten fällig sind.'],
        ['einmalkosten.2.betrag', 'Bitte gib einen gültigen Betrag ein, z. B. 19,99.'],
      ]);
    });
  });

  it('überlässt fachliche Regeln dem Backend, auch Beträge nicht größer 0', () => {
    const werte = {
      ...PFLICHT,
      betrag: '-1',
      beginn: '2027-01-01',
      laufzeitende: '2026-01-01',
    };
    expect(vertragPruefen(werte).size).toBe(0);
  });

  it.each(['abc', '12.50', '1,2,3'])('meldet den nicht lesbaren Betrag „%s“', (betrag) => {
    expect([...vertragPruefen({ ...PFLICHT, betrag }).entries()]).toEqual([
      ['betrag', 'Bitte gib einen gültigen Betrag ein, z. B. 19,99.'],
    ]);
  });
});

describe('anfrageAus', () => {
  it('schickt leere Felder als null, nie als ""', () => {
    expect(anfrageAus(PFLICHT)).toEqual({
      anbieter: 'Anbieter',
      bezeichnung: null,
      kategorieId: 'k1',
      vertragsnummer: null,
      preise: [{ gueltigAb: '2027-01-01', betrag: { wert: 19.99, waehrung: 'EUR' } }],
      zahlweise: 'MONATLICH',
      beginn: '2027-01-01',
      zahlungsweg: null,
      kuendbar: true,
      laufzeitende: null,
      verlaengerung: null,
      kuendigungsfristMonate: null,
      gekuendigtZum: null,
      notiz: null,
      anteilProzent: null,
      einmalkosten: [],
      preissteigerung: null,
      preisgarantieBis: null,
      erinnerungSonderkuendigung: true,
    });
    expect(Object.values(anfrageAus(LEER))).not.toContain('');
  });

  it('kürzt Texte und liest nur aus Leerzeichen bestehende als null', () => {
    const anfrage = anfrageAus({ ...PFLICHT, anbieter: ' A ', bezeichnung: '  ', notiz: ' N ' });
    expect(anfrage).toMatchObject({ anbieter: 'A', bezeichnung: null, notiz: 'N' });
  });

  it.each(['', 'abc', '12.50'])('schickt den Betrag „%s“ als null, nie als { wert: null }', (b) => {
    expect(anfrageAus({ ...PFLICHT, betrag: b }).preise[0].betrag).toBeNull();
  });

  it('der Betrag ist der erste Preis ab Vertragsbeginn, die Liste folgt in ihrer Reihenfolge', () => {
    const anfrage = anfrageAus({
      ...PFLICHT,
      beginn: '2026-01-01',
      preise: [
        { gueltigAb: '2027-01-01', betrag: '24,99' },
        { gueltigAb: '2025-01-01', betrag: '' },
      ],
    });
    expect(anfrage.preise).toEqual([
      { gueltigAb: '2026-01-01', betrag: { wert: 19.99, waehrung: 'EUR' } },
      { gueltigAb: '2027-01-01', betrag: { wert: 24.99, waehrung: 'EUR' } },
      { gueltigAb: '2025-01-01', betrag: null },
    ]);
  });

  it('schickt die Einmalkosten in der Währung der Preise, Leeres als null', () => {
    const anfrage = anfrageAus({
      ...PFLICHT,
      einmalkosten: [
        { bezeichnung: ' Router ', betrag: '1.049,50', faelligAm: '2026-03-01' },
        { bezeichnung: '', betrag: 'abc', faelligAm: '' },
      ],
    });
    expect(anfrage.einmalkosten).toEqual([
      { bezeichnung: 'Router', betrag: { wert: 1049.5, waehrung: 'EUR' }, faelligAm: '2026-03-01' },
      { bezeichnung: null, betrag: null, faelligAm: null },
    ]);
    expect(anfrageAus(PFLICHT).einmalkosten).toEqual([]);
  });

  it('schickt die Regel nur mit eingeschaltetem Schalter, zur Art nur den passenden Wert', () => {
    const regel = {
      ...PFLICHT,
      steigerungswert: '2,75',
      rhythmus: 'VIERTELJAEHRLICH' as const,
      naechsteErhoehungAm: '2027-01-01',
      preisgarantieBis: '2026-12-31',
      erinnerungSonderkuendigung: false,
    };
    expect(anfrageAus(regel)).toMatchObject({
      preissteigerung: null,
      preisgarantieBis: '2026-12-31',
      erinnerungSonderkuendigung: false,
    });
    expect(anfrageAus({ ...regel, steigt: true }).preissteigerung).toEqual({
      art: 'PROZENT',
      prozent: 2.75,
      betrag: null,
      rhythmus: 'VIERTELJAEHRLICH',
      naechsteAm: '2027-01-01',
    });
    expect(
      anfrageAus({ ...regel, steigt: true, steigerungsart: 'BETRAG', steigerungswert: '1,50' })
        .preissteigerung,
    ).toMatchObject({ prozent: null, betrag: { wert: 1.5, waehrung: 'EUR' } });
    expect(
      anfrageAus({ ...regel, steigt: true, steigerungswert: 'x', naechsteErhoehungAm: '' })
        .preissteigerung,
    ).toMatchObject({ prozent: null, naechsteAm: null });
  });

  it('schickt den Anteil als Zahl, leer als null', () => {
    expect(anfrageAus({ ...PFLICHT, anteilProzent: '33,3' }).anteilProzent).toBe(33.3);
    expect(anfrageAus({ ...PFLICHT, anteilProzent: ' ' }).anteilProzent).toBeNull();
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
    [
      'preise[0].betrag',
      'NotNull',
      {},
      'betrag',
      'Bitte gib einen gültigen Betrag ein, z. B. 19,99.',
    ],
    ['preise[0].betrag', 'PositiverBetrag', {}, 'betrag', 'Der Betrag muss größer als 0 sein.'],
    ['preise[0].betrag.wert', 'Digits', { fraction: 2 }, 'betrag', 'Höchstens 2 Nachkommastellen.'],
    [
      'preise[0].betrag.waehrung',
      'ErlaubteWaehrung',
      {},
      'betrag',
      'Diese Währung ist nicht möglich.',
    ],
    ['preise', 'NotEmpty', {}, 'betrag', 'Bitte gib einen gültigen Betrag ein, z. B. 19,99.'],
    ['preise', 'Size', { max: 100 }, 'betrag', 'Höchstens 100 Preise.'],
    ['preise[0].gueltigAb', 'NotNull', {}, 'beginn', 'Bitte gib an, wann der Vertrag beginnt.'],
    [
      'preise[0].gueltigAb',
      'ErsterPreisAbBeginn',
      {},
      'beginn',
      'Der früheste Preis muss ab Vertragsbeginn gelten.',
    ],
    [
      'preise[1].gueltigAb',
      'PreisNichtVorBeginn',
      {},
      'preise.0.gueltigAb',
      'Ein Preis kann nicht vor dem Vertragsbeginn gelten.',
    ],
    [
      'preise[1].gueltigAb',
      'NotNull',
      {},
      'preise.0.gueltigAb',
      'Bitte gib an, ab wann dieser Preis gilt.',
    ],
    [
      'preise[1].gueltigAb',
      'ErsterPreisAbBeginn',
      {},
      'preise.0.gueltigAb',
      'Der früheste Preis muss ab Vertragsbeginn gelten.',
    ],
    [
      'preise[2].gueltigAb',
      'GueltigAbEindeutig',
      {},
      'preise.1.gueltigAb',
      'Für dieses Datum gibt es schon einen Preis.',
    ],
    [
      'preise[1].betrag',
      'NotNull',
      {},
      'preise.0.betrag',
      'Bitte gib einen gültigen Betrag ein, z. B. 19,99.',
    ],
    [
      'preise[1].betrag.waehrung',
      'GleicheWaehrung',
      {},
      'preise.0.betrag',
      'Alle Preise brauchen dieselbe Währung.',
    ],
    [
      'einmalkosten[1].bezeichnung',
      'NotBlank',
      {},
      'einmalkosten.1.bezeichnung',
      'Bitte gib an, wofür die Kosten anfallen.',
    ],
    [
      'einmalkosten[0].bezeichnung',
      'Size',
      { max: 200 },
      'einmalkosten.0.bezeichnung',
      'Höchstens 200 Zeichen.',
    ],
    [
      'einmalkosten[0].betrag',
      'NotNull',
      {},
      'einmalkosten.0.betrag',
      'Bitte gib einen gültigen Betrag ein, z. B. 19,99.',
    ],
    [
      'einmalkosten[0].betrag',
      'PositiverBetrag',
      {},
      'einmalkosten.0.betrag',
      'Der Betrag muss größer als 0 sein.',
    ],
    [
      'einmalkosten[2].betrag.waehrung',
      'GleicheWaehrung',
      {},
      'einmalkosten.2.betrag',
      'Einmalkosten brauchen dieselbe Währung wie die Preise.',
    ],
    [
      'einmalkosten[0].faelligAm',
      'NotNull',
      {},
      'einmalkosten.0.faelligAm',
      'Bitte gib an, wann die Kosten fällig sind.',
    ],
    [
      'einmalkosten[0].faelligAm',
      'PlausiblesDatum',
      {},
      'einmalkosten.0.faelligAm',
      'Bitte gib ein Datum zwischen dem 01.01.1900 und dem 31.12.2199 ein.',
    ],
    ['einmalkosten', 'Size', { max: 100 }, 'einmalkosten', 'Höchstens 100 Einmalkosten.'],
    [
      'preissteigerung.prozent',
      'PassenderWert',
      {},
      'steigerungswert',
      'Bitte gib an, um wie viel der Preis steigt.',
    ],
    [
      'preissteigerung.prozent',
      'DecimalMax',
      {},
      'steigerungswert',
      'Bitte eine Zahl größer 0 bis 100 mit höchstens zwei Nachkommastellen.',
    ],
    [
      'preissteigerung.prozent',
      'Digits',
      {},
      'steigerungswert',
      'Bitte eine Zahl größer 0 bis 100 mit höchstens zwei Nachkommastellen.',
    ],
    [
      'preissteigerung.betrag',
      'PositiverBetrag',
      {},
      'steigerungswert',
      'Der Betrag muss größer als 0 sein.',
    ],
    [
      'preissteigerung.betrag.waehrung',
      'GleicheWaehrung',
      {},
      'steigerungswert',
      'Die Erhöhung braucht dieselbe Währung wie die Preise.',
    ],
    [
      'preissteigerung.naechsteAm',
      'NotNull',
      {},
      'naechsteErhoehungAm',
      'Bitte gib an, wann der Preis das nächste Mal steigt.',
    ],
    [
      'preisgarantieBis',
      'PlausiblesDatum',
      {},
      'preisgarantieBis',
      'Bitte gib ein Datum zwischen dem 01.01.1900 und dem 31.12.2199 ein.',
    ],
    ['preissteigerung.rhythmus', 'NotNull', {}, 'rhythmus', 'Bitte fülle dieses Feld aus.'],
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
    [
      'anteilProzent',
      'DecimalMin',
      {},
      'anteilProzent',
      'Bitte eine Zahl von 1 bis 100 mit höchstens einer Nachkommastelle.',
    ],
    [
      'anteilProzent',
      'DecimalMax',
      {},
      'anteilProzent',
      'Bitte eine Zahl von 1 bis 100 mit höchstens einer Nachkommastelle.',
    ],
    [
      'anteilProzent',
      'Digits',
      {},
      'anteilProzent',
      'Bitte eine Zahl von 1 bis 100 mit höchstens einer Nachkommastelle.',
    ],
  ])('%s %s', (feld, code, parameter, formularfeld, erwartet) => {
    expect(text(feld, code, parameter).get(formularfeld as 'notiz')).toBe(erwartet);
  });

  it('übergeht Fehler ohne passendes Feld', () => {
    expect(feldfehlerTexte([{ code: 'Regel', parameter: {} }]).size).toBe(0);
    expect(text('unbekanntesFeld', 'NotNull').size).toBe(0);
  });

  it('zeigt je Feld den ersten Fehler', () => {
    const texte = feldfehlerTexte([
      { feld: 'preise[0].betrag', code: 'PositiverBetrag', parameter: {} },
      { feld: 'preise[0].betrag.wert', code: 'Digits', parameter: { fraction: 2 } },
    ]);
    expect(texte.get('betrag')).toBe('Der Betrag muss größer als 0 sein.');
  });
});

describe('Bearbeiten', () => {
  const VERTRAG: VertragAntwort = {
    id: 'v1',
    version: 4,
    anbieter: 'Anbieter',
    bezeichnung: null,
    kategorie: { id: 'k1', schluessel: 'VERSICHERUNG', name: null },
    vertragsnummer: null,
    betrag: { wert: 586.8, waehrung: 'USD' },
    preise: [{ gueltigAb: '2026-01-31', betrag: { wert: 586.8, waehrung: 'USD' }, art: 'AKTUELL' }],
    anteilProzent: null,
    einmalkosten: [],
    preissteigerung: null,
    preisgarantieBis: null,
    erinnerungSonderkuendigung: true,
    zahlweise: 'MONATLICH',
    beginn: '2026-01-31',
    zahlungsweg: null,
    kuendbar: true,
    laufzeitende: null,
    verlaengerung: null,
    kuendigungsfristMonate: null,
    gekuendigtZum: null,
    notiz: null,
    berechnet: {
      status: 'AKTIV',
      kostenProMonat: { wert: 586.8, waehrung: 'USD' },
      kostenImJahr: { wert: 7041.6, waehrung: 'USD' },
      kostenImJahrMitPrognose: false,
      jahr: 2026,
      eigenerAnteil: null,
      einmalkosten: { wert: 0, waehrung: 'USD' },
      naechstePreisaenderung: null,
      preisverlauf: [],
      prognose: [],
      vertragsende: null,
      kuendigung: {
        art: 'KEINE_LAUFZEIT',
        dringend: false,
        fristMonate: null,
        kuendigenBis: null,
        zum: null,
      },
    },
  };

  describe('werteAus', () => {
    it('belegt mit dem Vertragsbeginn vor, der Betrag steht mit Komma', () => {
      expect(werteAus(VERTRAG)).toMatchObject({
        beginn: '2026-01-31',
        betrag: '586,80',
        kategorieId: 'k1',
        bezeichnung: '',
        kuendigungsfristMonate: '',
        nichtKuendbar: false,
        gekuendigt: false,
      });
    });

    it('der erste Preis steht unter „Betrag“, auch wenn ein späterer aktuell ist', () => {
      const usd = (wert: number) => ({ wert, waehrung: 'USD' });
      const werte = werteAus({
        ...VERTRAG,
        betrag: usd(20),
        preise: [
          { gueltigAb: '2026-01-31', betrag: usd(10), art: 'FRUEHER' },
          { gueltigAb: '2026-01-01', betrag: usd(20), art: 'AKTUELL' },
          { gueltigAb: '2027-01-01', betrag: usd(25.5), art: 'ANGEKUENDIGT' },
        ],
      });
      expect(werte).toMatchObject({
        betrag: '10,00',
        preise: [
          { gueltigAb: '2026-01-01', betrag: '20,00' },
          { gueltigAb: '2027-01-01', betrag: '25,50' },
        ],
      });
    });

    it('belegt die Einmalkosten in der Reihenfolge der Antwort vor, Beträge mit Komma', () => {
      const werte = werteAus({
        ...VERTRAG,
        einmalkosten: [
          { bezeichnung: 'Router', betrag: { wert: 99, waehrung: 'USD' }, faelligAm: '2026-01-15' },
          {
            bezeichnung: 'Anschluss',
            betrag: { wert: 49.9, waehrung: 'USD' },
            faelligAm: '2026-02-01',
          },
        ],
      });
      expect(werte.einmalkosten).toEqual([
        { bezeichnung: 'Router', betrag: '99,00', faelligAm: '2026-01-15' },
        { bezeichnung: 'Anschluss', betrag: '49,90', faelligAm: '2026-02-01' },
      ]);
    });

    it('belegt Regel, Garantie und Erinnerung vor; ohne Regel Prozent und jährlich', () => {
      expect(werteAus(VERTRAG)).toMatchObject({
        ...OHNE_STEIGERUNG,
        preisgarantieBis: '',
        erinnerungSonderkuendigung: true,
      });
      const regel = {
        art: 'PROZENT' as const,
        prozent: 2.75,
        betrag: null,
        rhythmus: 'ZWEIJAEHRLICH' as const,
        naechsteAm: '2025-01-01',
      };
      expect(
        werteAus({
          ...VERTRAG,
          preissteigerung: regel,
          preisgarantieBis: '2026-12-31',
          erinnerungSonderkuendigung: false,
        }),
      ).toMatchObject({
        steigt: true,
        steigerungsart: 'PROZENT',
        steigerungswert: '2,75',
        rhythmus: 'ZWEIJAEHRLICH',
        naechsteErhoehungAm: '2025-01-01',
        preisgarantieBis: '2026-12-31',
        erinnerungSonderkuendigung: false,
      });
      const betrag = {
        ...regel,
        art: 'BETRAG' as const,
        prozent: null,
        betrag: { wert: 1, waehrung: 'USD' },
      };
      expect(werteAus({ ...VERTRAG, preissteigerung: betrag }).steigerungswert).toBe('1,00');
    });

    it('belegt den Anteil mit Komma vor, ohne Anteil leer', () => {
      expect(werteAus({ ...VERTRAG, anteilProzent: 50 }).anteilProzent).toBe('50');
      expect(werteAus({ ...VERTRAG, anteilProzent: 33.3 }).anteilProzent).toBe('33,3');
      expect(werteAus(VERTRAG).anteilProzent).toBe('');
    });

    it('leitet „Gekündigt“ und „Nicht kündbar“ ab, Frist 0 bleibt erhalten', () => {
      const werte = werteAus({
        ...VERTRAG,
        kuendbar: false,
        gekuendigtZum: '2027-06-30',
        kuendigungsfristMonate: 0,
      });
      expect(werte).toMatchObject({
        nichtKuendbar: true,
        gekuendigt: true,
        gekuendigtZum: '2027-06-30',
        kuendigungsfristMonate: '0',
      });
    });
  });

  describe('vorschauAus', () => {
    it('schickt das Formular, leere Werte als null', () => {
      expect(vorschauAus(LEER)).toEqual({
        kuendbar: true,
        preise: [],
        anteilProzent: null,
        einmalkosten: [],
        preissteigerung: null,
        preisgarantieBis: null,
        zahlweise: null,
        beginn: null,
        laufzeitende: null,
        verlaengerung: null,
        kuendigungsfristMonate: null,
        gekuendigtZum: null,
      });
    });

    it('fragt auch bei „Nicht kündbar“, ohne Verlängerung und Frist', () => {
      expect(
        vorschauAus({ ...PFLICHT, nichtKuendbar: true, kuendigungsfristMonate: '3' }),
      ).toMatchObject({ kuendbar: false, kuendigungsfristMonate: null });
    });

    it.each([
      ['33,3', 33.3],
      ['100', 100],
      ['33,33', null],
      ['0', null],
      ['150', null],
      ['abc', null],
    ])('schickt den Anteil „%s“ nur, wenn das Backend ihn annimmt', (eingabe, erwartet) => {
      expect(vorschauAus({ ...PFLICHT, anteilProzent: eingabe }).anteilProzent).toBe(erwartet);
    });

    it('lässt Preise weg, die das Backend sicher ablehnt; ohne Datum ignoriert es sie selbst', () => {
      const anfrage = vorschauAus({
        ...PFLICHT,
        preise: [
          { gueltigAb: '2027-06-01', betrag: '25' },
          { gueltigAb: '', betrag: '30' },
          { gueltigAb: '2028-01-01', betrag: '' },
          { gueltigAb: '2028-01-01', betrag: '-1' },
          { gueltigAb: '2026-12-31', betrag: '15' },
        ],
      });
      expect(anfrage.preise).toEqual([
        { gueltigAb: '2027-01-01', betrag: { wert: 19.99, waehrung: 'EUR' } },
        { gueltigAb: '2027-06-01', betrag: { wert: 25, waehrung: 'EUR' } },
        { gueltigAb: null, betrag: { wert: 30, waehrung: 'EUR' } },
      ]);
    });

    it.each(['', '0', '12.50'])(
      'schickt ohne brauchbaren ersten Preis („%s“) keine Preise',
      (betrag) => {
        const preise = [{ gueltigAb: '2027-06-01', betrag: '25' }];
        expect(vorschauAus({ ...PFLICHT, betrag, preise }).preise).toEqual([]);
      },
    );

    it('lässt Einmalkosten mit Betrag nicht größer 0 weg, unvollständige bleiben', () => {
      const anfrage = vorschauAus({
        ...PFLICHT,
        einmalkosten: [
          { bezeichnung: 'Gutschrift', betrag: '-5', faelligAm: '2026-03-01' },
          { bezeichnung: 'Router', betrag: '', faelligAm: '' },
          { bezeichnung: 'Anschluss', betrag: '49', faelligAm: '2026-03-01' },
        ],
      });
      expect(anfrage.einmalkosten).toEqual([
        { bezeichnung: 'Router', betrag: null, faelligAm: null },
        {
          bezeichnung: 'Anschluss',
          betrag: { wert: 49, waehrung: 'EUR' },
          faelligAm: '2026-03-01',
        },
      ]);
    });

    it('lässt Werte der Erhöhung weg, die das Backend sicher ablehnt', () => {
      const regel = { ...PFLICHT, steigt: true, naechsteErhoehungAm: '2027-01-01' };
      const prozent = (wert: string) =>
        vorschauAus({ ...regel, steigerungswert: wert }).preissteigerung?.prozent;
      expect(prozent('2,75')).toBe(2.75);
      expect(prozent('100')).toBe(100);
      expect(prozent('2,755')).toBeNull();
      expect(prozent('101')).toBeNull();
      expect(prozent('0')).toBeNull();
      expect(prozent('abc')).toBeNull();
      const betrag = (wert: string) =>
        vorschauAus({ ...regel, steigerungsart: 'BETRAG', steigerungswert: wert }).preissteigerung
          ?.betrag;
      expect(betrag('1,00')).toEqual({ wert: 1, waehrung: 'EUR' });
      expect(betrag('0')).toBeNull();
      expect(vorschauAus(PFLICHT).preissteigerung).toBeNull();
    });
  });

  describe('anfrageAus mit gespeichertem Vertrag', () => {
    it('schickt ohne Änderung alle Felder unverändert', () => {
      expect(anfrageAus(werteAus(VERTRAG), VERTRAG)).toEqual({
        anbieter: 'Anbieter',
        bezeichnung: null,
        kategorieId: 'k1',
        vertragsnummer: null,
        preise: [{ gueltigAb: '2026-01-31', betrag: { wert: 586.8, waehrung: 'USD' } }],
        zahlweise: 'MONATLICH',
        beginn: '2026-01-31',
        zahlungsweg: null,
        kuendbar: true,
        laufzeitende: null,
        verlaengerung: null,
        kuendigungsfristMonate: null,
        gekuendigtZum: null,
        notiz: null,
        anteilProzent: null,
        einmalkosten: [],
        preissteigerung: null,
        preisgarantieBis: null,
        erinnerungSonderkuendigung: true,
      });
    });

    it('schickt Anteil, Einmalkosten, Regel, Garantie und Erinnerung ohne Änderung zurück', () => {
      const gespeichert: VertragAntwort = {
        ...VERTRAG,
        anteilProzent: 50,
        einmalkosten: [
          {
            bezeichnung: 'Anschluss',
            faelligAm: '2026-02-01',
            betrag: { wert: 49, waehrung: 'USD' },
          },
        ],
        preissteigerung: {
          art: 'PROZENT',
          prozent: 2.5,
          betrag: null,
          rhythmus: 'JAEHRLICH',
          naechsteAm: '2027-01-01',
        },
        preisgarantieBis: '2026-12-31',
        erinnerungSonderkuendigung: false,
      };
      expect(anfrageAus(werteAus(gespeichert), gespeichert)).toMatchObject({
        anteilProzent: 50,
        einmalkosten: gespeichert.einmalkosten,
        preissteigerung: gespeichert.preissteigerung,
        preisgarantieBis: '2026-12-31',
        erinnerungSonderkuendigung: false,
      });
    });

    it('übernimmt die Währung des Vertrags, nicht EUR', () => {
      const werte = { ...werteAus(VERTRAG), betrag: '10,00' };
      expect(anfrageAus(werte, VERTRAG).preise[0].betrag).toEqual({ wert: 10, waehrung: 'USD' });
    });
  });
});
