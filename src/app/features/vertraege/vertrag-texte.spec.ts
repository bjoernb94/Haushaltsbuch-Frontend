import { Kuendigung, VertragAntwort } from '../../core/api/api';
import {
  endeText,
  fristDauerText,
  kategorieText,
  kuendigungAnzeige,
  laufzeitZeile,
  vertragName,
  vorbei,
} from './vertrag-texte';

const LEER: Kuendigung = {
  art: 'BEENDET',
  dringend: false,
  fristMonate: null,
  kuendigenBis: null,
  zum: null,
};

describe('Vertragstexte', () => {
  describe('kuendigungAnzeige', () => {
    const TERMIN = { kuendigenBis: '2026-11-30', zum: '2026-12-31' };

    it('hebt dringende Kündigungstermine hervor', () => {
      expect(
        kuendigungAnzeige({
          ...LEER,
          ...TERMIN,
          art: 'KUENDIGEN_BIS',
          fristMonate: 1,
          dringend: true,
        }),
      ).toEqual({
        text: 'Kündbar bis 30.11.2026',
        zusatz: 'Vertrag endet zum 31.12.2026',
        ton: 'warnung',
      });
    });

    it('zeigt nicht dringende Kündigungstermine grün', () => {
      expect(
        kuendigungAnzeige({ ...LEER, ...TERMIN, art: 'KUENDIGEN_BIS', fristMonate: 3 }),
      ).toEqual({
        text: 'Kündbar bis 30.11.2026',
        zusatz: 'Vertrag endet zum 31.12.2026',
        ton: 'ok',
      });
    });

    it('zeigt monatlich kündbare Verträge', () => {
      expect(
        kuendigungAnzeige({ ...LEER, ...TERMIN, art: 'MONATLICH_KUENDBAR', fristMonate: 1 }),
      ).toEqual({
        text: 'Monatlich kündbar',
        zusatz: 'Kündbar zum 31.12.2026',
        ton: 'ok',
      });
    });

    it('zeigt endende Verträge', () => {
      expect(kuendigungAnzeige({ ...LEER, art: 'ENDET', zum: '2027-03-31' })).toEqual({
        text: 'Endet am 31.03.2027',
        zusatz: 'Verlängert sich nicht',
        ton: 'neutral',
      });
    });

    it('nennt KEINE_LAUFZEIT nicht „keine Laufzeit“', () => {
      expect(kuendigungAnzeige({ ...LEER, art: 'KEINE_LAUFZEIT' })).toEqual({
        text: 'Kein Termin bekannt',
        zusatz: '',
        ton: 'neutral',
      });
    });

    it('zeigt nicht kündbare Verträge', () => {
      expect(kuendigungAnzeige({ ...LEER, art: 'NICHT_KUENDBAR' })).toEqual({
        text: 'Nicht kündbar',
        zusatz: 'Pflichtbeitrag',
        ton: 'neutral',
      });
    });

    it('zeigt gekündigte Verträge', () => {
      expect(kuendigungAnzeige({ ...LEER, art: 'GEKUENDIGT', zum: '2026-12-31' })).toEqual({
        text: 'Gekündigt zum 31.12.2026',
        zusatz: '',
        ton: 'info',
      });
    });

    it('zeigt beendete Verträge', () => {
      expect(kuendigungAnzeige(LEER)).toEqual({ text: 'Beendet', zusatz: '', ton: 'neutral' });
    });
  });

  describe('fristDauerText', () => {
    it('nennt die Dauer und unterscheidet keine Frist von fehlender Angabe', () => {
      expect(fristDauerText(null)).toBeNull();
      expect(fristDauerText(0)).toBe('ohne');
      expect(fristDauerText(1)).toBe('1 Monat');
      expect(fristDauerText(3)).toBe('3 Monate');
    });
  });

  describe('kategorieText', () => {
    it('übersetzt den Schlüssel', () => {
      expect(kategorieText({ id: 'k', schluessel: 'STREAMING_ABOS', name: null })).toBe(
        'Streaming & Abos',
      );
    });

    it('nimmt sonst den Namen', () => {
      expect(kategorieText({ id: 'k', schluessel: null, name: 'Haustiere' })).toBe('Haustiere');
    });
  });

  describe('vertragName', () => {
    it('bevorzugt die Bezeichnung', () => {
      expect(vertragName({ bezeichnung: 'Kfz-Versicherung', anbieter: 'Muster AG' })).toBe(
        'Kfz-Versicherung',
      );
    });

    it('nimmt sonst den Anbieter', () => {
      expect(vertragName({ bezeichnung: null, anbieter: 'Muster AG' })).toBe('Muster AG');
      expect(vertragName({ bezeichnung: '', anbieter: 'Muster AG' })).toBe('Muster AG');
    });
  });

  describe('Unterbrechungen', () => {
    const berechnet = (mehr: Partial<VertragAntwort['berechnet']>) =>
      ({
        status: 'AKTIV',
        aktuellerBeginn: '2023-04-01',
        vertragsende: null,
        kuendigung: {
          art: 'KEINE_LAUFZEIT',
          dringend: false,
          fristMonate: null,
          kuendigenBis: null,
          zum: null,
        },
        ...mehr,
      }) as VertragAntwort['berechnet'];
    const zeile = (mehr: Partial<VertragAntwort['berechnet']>) =>
      laufzeitZeile({ beginn: '2023-04-01', berechnet: berechnet(mehr) } as VertragAntwort);

    it('Badge bei WIEDER_AB im Info-Ton', () => {
      expect(
        kuendigungAnzeige({
          art: 'WIEDER_AB',
          dringend: false,
          fristMonate: null,
          kuendigenBis: null,
          zum: '2027-01-01',
        }),
      ).toEqual({
        text: 'Wieder ab 01.01.2027',
        zusatz: 'Gekündigt, wird wieder aufgenommen',
        ton: 'info',
      });
    });

    it('Zeile der Liste: „Wieder seit“ nur nach einer Wiederaufnahme', () => {
      expect(zeile({})).toBe('Seit 01.04.2023');
      expect(zeile({ aktuellerBeginn: '2025-09-01' })).toBe('Wieder seit 01.09.2025');
      expect(zeile({ status: 'GEKUENDIGT', aktuellerBeginn: '2025-09-01' })).toBe(
        'Wieder seit 01.09.2025',
      );
    });

    it('Zeile der Liste: unterbrochen mit dem Tag der Wiederaufnahme, beendet ab dem Beginn', () => {
      expect(
        zeile({
          status: 'UNTERBROCHEN',
          aktuellerBeginn: '2027-01-01',
          kuendigung: {
            art: 'WIEDER_AB',
            dringend: false,
            fristMonate: null,
            kuendigenBis: null,
            zum: '2027-01-01',
          },
        }),
      ).toBe('Gekündigt, wieder ab 01.01.2027');
      expect(
        zeile({ status: 'BEENDET', aktuellerBeginn: '2025-09-01', vertragsende: '2026-05-31' }),
      ).toBe('01.04.2023 – 31.05.2026');
    });

    it('unterbrochene sind gedämpft wie beendete', () => {
      expect(vorbei(berechnet({ status: 'UNTERBROCHEN' }))).toBe(true);
      expect(vorbei(berechnet({ status: 'GEKUENDIGT' }))).toBe(false);
    });

    it('endeText nach dem Status', () => {
      expect(endeText(berechnet({ status: 'BEENDET', vertragsende: '2026-05-31' }))).toBe(
        'Beendet am 31.05.2026.',
      );
      expect(endeText(berechnet({ status: 'GEKUENDIGT', vertragsende: '2027-01-31' }))).toBe(
        'Gekündigt zum 31.01.2027.',
      );
    });
  });
});
