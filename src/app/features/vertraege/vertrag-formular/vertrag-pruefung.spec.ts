import { VertragAntwort } from '../../../core/api/api';
import {
  anfrageAus,
  anteilLesen,
  vorschauAus,
  betragLesen,
  feldfehlerTexte,
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
  gueltigSeit: '',
  preise: [],
  anteilProzent: '',
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

describe('anteilLesen', () => {
  it.each([
    ['50', 50],
    ['33,3', 33.3],
    [' 100 ', 100],
    ['33,33', 33.33],
    ['0', 0],
    ['150', 150],
  ])('liest „%s“, die Grenzen prüft das Backend', (eingabe, wert) => {
    expect(anteilLesen(eingabe)).toBe(wert);
  });

  it.each(['', 'abc', '33.3', '50 %', ',5', '-5'])('lehnt „%s“ ab', (eingabe) => {
    expect(anteilLesen(eingabe)).toBeNull();
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
      'abbuchungAb',
    ]);
  });

  it('verlangt „Gekündigt zum“ nur mit Haken', () => {
    expect(vertragPruefen(PFLICHT).size).toBe(0);
    expect([...vertragPruefen({ ...PFLICHT, gekuendigt: true }).keys()]).toEqual(['gekuendigtZum']);
  });

  describe('Preise', () => {
    const MIT_BEGINN = { ...PFLICHT, beginn: '2026-01-01' };

    it('verlangt in jeder Zeile Datum und Betrag', () => {
      const fehler = vertragPruefen({
        ...MIT_BEGINN,
        gueltigSeit: '2026-01-01',
        preise: [
          { gueltigAb: '', betrag: '' },
          { gueltigAb: '', betrag: '5' },
        ],
      });
      expect([...fehler.keys()]).toEqual(['preise.0.betrag', 'preise.1.gueltigAb']);
      expect(fehler.get('preise.1.gueltigAb')).toBe('Bitte gib an, ab wann dieser Preis gilt.');
    });

    it('lässt einen Preis ohne Datum zu: den Betrag oder die erste Zeile', () => {
      const ohneSeit = { ...MIT_BEGINN, preise: [{ gueltigAb: '', betrag: '5' }] };
      expect([...vertragPruefen(ohneSeit).keys()]).toEqual(['preise.0.gueltigAb']);
      const mitSeit = { ...ohneSeit, gueltigSeit: '2026-06-01' };
      expect(vertragPruefen(mitSeit).size).toBe(0);
    });

    it('verlangt „Betrag gilt seit“ bei weiteren Preisen nur ohne Vertragsbeginn', () => {
      const preise = [{ gueltigAb: '2027-01-01', betrag: '25' }];
      expect(vertragPruefen({ ...MIT_BEGINN, preise }).size).toBe(0);
      const fehler = vertragPruefen({ ...PFLICHT, preise });
      expect(fehler.get('gueltigSeit')).toBe('Bitte gib an, seit wann der Betrag oben gilt.');
      expect(vertragPruefen(PFLICHT).has('gueltigSeit')).toBe(false);
    });
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
      preise: [{ gueltigAb: null, betrag: { wert: 19.99, waehrung: 'EUR' } }],
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

  it('der Betrag ist der erste Preis, die Liste folgt in ihrer Reihenfolge', () => {
    const anfrage = anfrageAus({
      ...PFLICHT,
      gueltigSeit: '2026-01-01',
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
    [
      'preise[0].gueltigAb',
      'GueltigAbPflicht',
      {},
      'gueltigSeit',
      'Bitte gib an, seit wann der Betrag oben gilt.',
    ],
    [
      'preise[0].gueltigAb',
      'PreisNichtVorBeginn',
      {},
      'gueltigSeit',
      'Ein Preis kann nicht vor dem Vertragsbeginn gelten.',
    ],
    [
      'preise[1].gueltigAb',
      'GueltigAbPflicht',
      {},
      'preise.0.gueltigAb',
      'Bitte gib an, ab wann dieser Preis gilt.',
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
    preise: [{ gueltigAb: null, betrag: { wert: 586.8, waehrung: 'USD' }, art: 'AKTUELL' }],
    anteilProzent: null,
    einmalkosten: [],
    preissteigerung: null,
    preisgarantieBis: null,
    erinnerungSonderkuendigung: true,
    zahlweise: 'MONATLICH',
    abbuchungAb: '2026-01-31',
    zahlungsweg: null,
    kuendbar: true,
    beginn: null,
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
      naechsteAbbuchung: { am: '2026-11-30', betrag: { wert: 586.8, waehrung: 'USD' } },
      naechstePreisaenderung: null,
      preisverlauf: [],
      prognose: [],
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
    it('belegt mit der nächsten Abbuchung vor, der Betrag steht mit Komma', () => {
      expect(werteAus(VERTRAG)).toMatchObject({
        abbuchungAb: '2026-11-30',
        betrag: '586,80',
        kategorieId: 'k1',
        bezeichnung: '',
        kuendigungsfristMonate: '',
        nichtKuendbar: false,
        gekuendigt: false,
      });
    });

    it('der aktuelle Preis steht unter „Betrag“, die übrigen in der Liste', () => {
      const usd = (wert: number) => ({ wert, waehrung: 'USD' });
      const werte = werteAus({
        ...VERTRAG,
        betrag: usd(20),
        preise: [
          { gueltigAb: null, betrag: usd(10), art: 'FRUEHER' },
          { gueltigAb: '2026-01-01', betrag: usd(20), art: 'AKTUELL' },
          { gueltigAb: '2027-01-01', betrag: usd(25.5), art: 'ANGEKUENDIGT' },
        ],
      });
      expect(werte).toMatchObject({
        betrag: '20,00',
        gueltigSeit: '2026-01-01',
        preise: [
          { gueltigAb: '', betrag: '10,00' },
          { gueltigAb: '2027-01-01', betrag: '25,50' },
        ],
      });
    });

    it('belegt den Anteil mit Komma vor, ohne Anteil leer', () => {
      expect(werteAus({ ...VERTRAG, anteilProzent: 50 }).anteilProzent).toBe('50');
      expect(werteAus({ ...VERTRAG, anteilProzent: 33.3 }).anteilProzent).toBe('33,3');
      expect(werteAus(VERTRAG).anteilProzent).toBe('');
    });

    it('nimmt abbuchungAb, wenn es keine nächste Abbuchung gibt', () => {
      const beendet = {
        ...VERTRAG,
        berechnet: { ...VERTRAG.berechnet, naechsteAbbuchung: null },
      };
      expect(werteAus(beendet).abbuchungAb).toBe('2026-01-31');
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
        abbuchungAb: null,
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

    it('lässt Preise weg, die das Backend sicher ablehnt', () => {
      const anfrage = vorschauAus({
        ...PFLICHT,
        betrag: '0',
        preise: [
          { gueltigAb: '2027-01-01', betrag: '25' },
          { gueltigAb: '', betrag: '30' },
          { gueltigAb: '2028-01-01', betrag: '' },
        ],
      });
      expect(anfrage.preise).toEqual([
        { gueltigAb: '2027-01-01', betrag: { wert: 25, waehrung: 'EUR' } },
        { gueltigAb: null, betrag: { wert: 30, waehrung: 'EUR' } },
      ]);
    });

    it('behält nur den ersten Preis ohne Datum', () => {
      const anfrage = vorschauAus({
        ...PFLICHT,
        gueltigSeit: '2026-01-01',
        preise: [
          { gueltigAb: '', betrag: '10' },
          { gueltigAb: '', betrag: '30' },
        ],
      });
      expect(anfrage.preise?.map(({ betrag }) => betrag?.wert)).toEqual([19.99, 10]);
    });

    it('nimmt den gespeicherten Anker, solange Datum und Zahlweise unverändert sind', () => {
      const werte = werteAus(VERTRAG);
      expect(vorschauAus(werte, VERTRAG)?.abbuchungAb).toBe('2026-01-31');
      expect(vorschauAus({ ...werte, abbuchungAb: '2027-03-01' }, VERTRAG)?.abbuchungAb).toBe(
        '2027-03-01',
      );
      expect(vorschauAus({ ...werte, zahlweise: 'JAEHRLICH' }, VERTRAG)?.abbuchungAb).toBe(
        werte.abbuchungAb,
      );
    });
  });

  describe('anfrageAus mit gespeichertem Vertrag', () => {
    it('schickt ohne Änderung alle Felder unverändert, auch den Anker', () => {
      expect(anfrageAus(werteAus(VERTRAG), VERTRAG)).toEqual({
        anbieter: 'Anbieter',
        bezeichnung: null,
        kategorieId: 'k1',
        vertragsnummer: null,
        preise: [{ gueltigAb: null, betrag: { wert: 586.8, waehrung: 'USD' } }],
        zahlweise: 'MONATLICH',
        abbuchungAb: '2026-01-31',
        zahlungsweg: null,
        kuendbar: true,
        beginn: null,
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

    it('übernimmt Felder, die das Formular noch nicht zeigt, wie gespeichert', () => {
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

    it('der Anker bleibt, wenn sich nur ein anderes Feld ändert', () => {
      const werte = { ...werteAus(VERTRAG), notiz: 'Neu' };
      expect(anfrageAus(werte, VERTRAG).abbuchungAb).toBe('2026-01-31');
    });

    it('ein geändertes Datum wird neuer Anker', () => {
      const werte = { ...werteAus(VERTRAG), abbuchungAb: '2026-12-15' };
      expect(anfrageAus(werte, VERTRAG).abbuchungAb).toBe('2026-12-15');
    });

    it('bei geänderter Zahlweise gilt das Feld als neuer Anker', () => {
      const werte: VertragWerte = { ...werteAus(VERTRAG), zahlweise: 'JAEHRLICH' };
      expect(anfrageAus(werte, VERTRAG).abbuchungAb).toBe('2026-11-30');
    });

    it('zurückgenommene Änderungen lassen den Anker unberührt', () => {
      const werte = {
        ...werteAus(VERTRAG),
        abbuchungAb: '2026-11-30',
        zahlweise: 'MONATLICH' as const,
      };
      expect(anfrageAus(werte, VERTRAG).abbuchungAb).toBe('2026-01-31');
    });

    it('übernimmt die Währung des Vertrags, nicht EUR', () => {
      const werte = { ...werteAus(VERTRAG), betrag: '10,00' };
      expect(anfrageAus(werte, VERTRAG).preise[0].betrag).toEqual({ wert: 10, waehrung: 'USD' });
    });
  });
});
