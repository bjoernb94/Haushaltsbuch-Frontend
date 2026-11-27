import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BetraegePipe, BetragPipe } from './betrag.pipe';
import { datumText, DatumPipe } from './datum.pipe';
import { vergangenText } from './vergangen';
import { zeitpunktText } from './zeitpunkt';

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

  describe('zeitpunktText', () => {
    it('zeigt Datum und Uhrzeit des Browsers', () => {
      expect(zeitpunktText('2026-11-08T15:26:00Z', 'de-DE')).toBe(
        new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date('2026-11-08T15:26:00Z'),
        ),
      );
    });

    it('gibt einen ungültigen Wert unverändert zurück', () => {
      expect(zeitpunktText('kein Datum', 'de-DE')).toBe('kein Datum');
    });
  });

  it('nennt, wie lange etwas her ist', () => {
    const jetzt = new Date(2026, 10, 27, 12, 0).getTime();
    const minuten = (n: number) => jetzt - n * 60_000;
    expect(vergangenText(minuten(0.5), jetzt, 'de-DE')).toBe('Gerade eben');
    expect(vergangenText(minuten(5), jetzt, 'de-DE')).toBe('Vor 5 Min.');
    expect(vergangenText(minuten(59), jetzt, 'de-DE')).toBe('Vor 59 Min.');
    expect(vergangenText(minuten(60), jetzt, 'de-DE')).toBe('Vor 1 Std.');
    expect(vergangenText(minuten(23 * 60 + 59), jetzt, 'de-DE')).toBe('Vor 23 Std.');
    expect(vergangenText(minuten(30 * 60), jetzt, 'de-DE')).toBe('Gestern');
    expect(vergangenText(minuten(3 * 24 * 60), jetzt, 'de-DE')).toBe('24.11.2026');
  });
});
