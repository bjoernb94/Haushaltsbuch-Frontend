import { HttpErrorResponse } from '@angular/common/http';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { VertragsuebersichtAntwort } from '../../../core/api/api';
import { VertragService } from '../../vertraege/vertrag.service';
import { VertragKachel } from './vertrag-kachel';

const UEBERSICHT: VertragsuebersichtAntwort = {
  laufendeVertraege: 9,
  kostenProMonat: [{ wert: 202.08, waehrung: 'EUR' }],
  kostenProJahr: [{ wert: 2424.96, waehrung: 'EUR' }],
  naechsteKuendigungsfristen: [
    {
      id: 'kfz',
      anbieter: 'Musterversicherung AG',
      bezeichnung: 'Kfz-Versicherung',
      betrag: { wert: 586.8, waehrung: 'EUR' },
      zahlweise: 'JAEHRLICH',
      kuendigenBis: '2026-11-30',
      zum: '2026-12-31',
      dringend: true,
    },
    {
      id: 'handy',
      anbieter: 'Mobilfunk GmbH',
      bezeichnung: null,
      betrag: { wert: 19.99, waehrung: 'EUR' },
      zahlweise: 'MONATLICH',
      kuendigenBis: '2027-02-14',
      zum: '2027-03-14',
      dringend: false,
    },
  ],
};

function problem(status: number, code: string) {
  return throwError(() => new HttpErrorResponse({ status, error: { status, code } }));
}

describe('VertragKachel', () => {
  const uebersicht = vi.fn();

  beforeEach(async () => {
    uebersicht.mockReset();
    await TestBed.configureTestingModule({
      imports: [VertragKachel],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'de-DE' },
        { provide: VertragService, useValue: { uebersicht } },
      ],
    }).compileComponents();
  });

  async function kachel() {
    const fixture = TestBed.createComponent(VertragKachel);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  /** Geschützte und mehrfache Leerzeichen vereinheitlichen. */
  const text = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim();

  it('zeigt die Kennzahlen aus dem Backend', async () => {
    uebersicht.mockReturnValue(of(UEBERSICHT));
    const { element } = await kachel();
    const kennzahlen = element.querySelectorAll('.kennzahl');
    expect(text(kennzahlen[0])).toBe('Laufende Verträge9');
    expect(text(kennzahlen[1])).toBe('Kosten pro Monat202,08 €');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/vertraege');
  });

  it('zeigt jede Währung und bei leerer Liste 0,00 €', async () => {
    uebersicht.mockReturnValue(
      of({
        ...UEBERSICHT,
        kostenProMonat: [
          { wert: 10, waehrung: 'EUR' },
          { wert: 5, waehrung: 'USD' },
        ],
      }),
    );
    expect(text((await kachel()).element.querySelectorAll('.kennzahl')[1])).toBe(
      'Kosten pro Monat10,00 € · 5,00 $',
    );

    uebersicht.mockReturnValue(of({ ...UEBERSICHT, kostenProMonat: [] }));
    expect(text((await kachel()).element.querySelectorAll('.kennzahl')[1])).toBe(
      'Kosten pro Monat0,00 €',
    );
  });

  it('zeigt die Fristen in der Reihenfolge des Backends', async () => {
    uebersicht.mockReturnValue(of(UEBERSICHT));
    const { element } = await kachel();
    const fristen = element.querySelectorAll('.frist');
    expect(text(fristen[0])).toBe('Kfz-Versicherung586,80 €/Jahr bis 30.11.2026');
    expect(text(fristen[1])).toBe('Mobilfunk GmbH19,99 €/Monat bis 14.02.2027');
    expect(fristen[0].querySelector('.termin')?.classList).toContain('dringend');
    expect(fristen[1].querySelector('.termin')?.classList).not.toContain('dringend');
  });

  it('zeigt den Leerzustand ohne Fristen', async () => {
    uebersicht.mockReturnValue(of({ ...UEBERSICHT, naechsteKuendigungsfristen: [] }));
    expect(text((await kachel()).element.querySelector('.keine'))).toBe(
      'Gerade steht keine Kündigungsfrist an.',
    );
  });

  it('zeigt den Ladezustand', async () => {
    uebersicht.mockReturnValue(NEVER);
    expect(text((await kachel()).element.querySelector('[role="status"]'))).toBe('Wird geladen …');
  });

  it('bietet nach einem Fehler einen neuen Versuch an', async () => {
    uebersicht.mockReturnValue(problem(500, 'INTERN'));
    const { fixture, element } = await kachel();
    expect(text(element.querySelector('[role="alert"]'))).toBe(
      'Die Vertragsübersicht konnte nicht geladen werden.',
    );

    uebersicht.mockReturnValue(of(UEBERSICHT));
    element.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelectorAll('.frist').length).toBe(2);
  });

  it('blendet die Kachel bei KEIN_ZUGRIFF aus statt einen Fehler zu zeigen', async () => {
    uebersicht.mockReturnValue(problem(403, 'KEIN_ZUGRIFF'));
    const { element } = await kachel();
    expect(element.querySelector('section')).toBeNull();
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });
});
