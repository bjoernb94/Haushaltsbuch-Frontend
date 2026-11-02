import { Kuendigung } from '../../core/api/api';
import { fristDauerText, kategorieText, kuendigungAnzeige, vertragName } from './vertrag-texte';

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
        zusatz: 'zum 31.12.2026, 1 Monat Frist',
        ton: 'warnung',
      });
    });

    it('zeigt nicht dringende Kündigungstermine grün', () => {
      expect(
        kuendigungAnzeige({ ...LEER, ...TERMIN, art: 'KUENDIGEN_BIS', fristMonate: 3 }),
      ).toEqual({
        text: 'Kündbar bis 30.11.2026',
        zusatz: 'zum 31.12.2026, 3 Monate Frist',
        ton: 'ok',
      });
    });

    it('zeigt eine fehlende oder leere Frist als „ohne Frist“', () => {
      for (const fristMonate of [null, 0]) {
        expect(
          kuendigungAnzeige({ ...LEER, ...TERMIN, art: 'KUENDIGEN_BIS', fristMonate }).zusatz,
        ).toBe('zum 31.12.2026, ohne Frist');
      }
    });

    it('zeigt monatlich kündbare Verträge', () => {
      expect(
        kuendigungAnzeige({ ...LEER, ...TERMIN, art: 'MONATLICH_KUENDBAR', fristMonate: 1 }),
      ).toEqual({
        text: 'Monatlich kündbar',
        zusatz: '1 Monat Frist, nächstmöglich zum 31.12.2026',
        ton: 'ok',
      });
    });

    it('zeigt endende Verträge', () => {
      expect(kuendigungAnzeige({ ...LEER, art: 'ENDET', zum: '2027-03-31' })).toEqual({
        text: 'Endet am 31.03.2027',
        zusatz: 'ohne Verlängerung',
        ton: 'neutral',
      });
    });

    it('nennt KEINE_LAUFZEIT nicht „keine Laufzeit“', () => {
      expect(kuendigungAnzeige({ ...LEER, art: 'KEINE_LAUFZEIT' })).toEqual({
        text: 'Kein Kündigungstermin bestimmbar',
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
        zusatz: 'läuft noch aus',
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
});
