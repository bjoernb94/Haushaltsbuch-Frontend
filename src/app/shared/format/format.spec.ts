import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BetraegePipe, BetragPipe } from './betrag.pipe';
import { datumText, DatumPipe } from './datum.pipe';

registerLocaleData(localeDe);

describe('Formatierung', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: LOCALE_ID, useValue: 'de-DE' }, BetragPipe, BetraegePipe],
    });
  });

  /** Zwischen Betrag und Währung steht ein geschütztes Leerzeichen. */
  const text = (wert: string) => wert.replaceAll(' ', ' ');

  describe('BetragPipe', () => {
    const betrag = (wert: number, waehrung: string) =>
      text(TestBed.inject(BetragPipe).transform({ wert, waehrung }));

    it('zeigt deutsche Schreibweise mit Währung', () => {
      expect(betrag(586.8, 'EUR')).toBe('586,80 €');
      expect(betrag(1234.5, 'EUR')).toBe('1.234,50 €');
    });

    it('nimmt die Währung des Betrags statt EUR anzunehmen', () => {
      expect(betrag(12, 'USD')).toBe('12,00 $');
      expect(betrag(12, 'CHF')).toBe('12,00 CHF');
    });

    it('nutzt die Nachkommastellen der Währung', () => {
      expect(betrag(1200, 'JPY')).toBe('1.200 ¥');
    });
  });

  describe('BetraegePipe', () => {
    const betraege = (...liste: { wert: number; waehrung: string }[]) =>
      text(TestBed.inject(BetraegePipe).transform(liste));

    it('zeigt eine leere Liste als 0,00 €', () => {
      expect(betraege()).toBe('0,00 €');
    });

    it('zeigt jede Währung und rechnet nichts zusammen', () => {
      expect(betraege({ wert: 202.08, waehrung: 'EUR' }, { wert: 15, waehrung: 'USD' })).toBe(
        '202,08 € · 15,00 $',
      );
    });
  });

  describe('Datum', () => {
    it('zeigt TT.MM.JJJJ', () => {
      expect(new DatumPipe().transform('2026-11-30')).toBe('30.11.2026');
    });

    it('lässt ein fehlendes Datum leer', () => {
      expect(datumText(null)).toBe('');
    });
  });
});
