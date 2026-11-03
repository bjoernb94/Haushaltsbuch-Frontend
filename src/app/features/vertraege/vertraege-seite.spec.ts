import { HttpErrorResponse } from '@angular/common/http';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { VertragAntwort, VertragsuebersichtAntwort } from '../../core/api/api';
import { VertraegeSeite } from './vertraege-seite';
import { VertragService } from './vertrag.service';

const EUR = (wert: number) => ({ wert, waehrung: 'EUR' });

const LEER = {
  bezeichnung: null,
  vertragsnummer: null,
  zahlungsweg: null,
  beginn: null,
  laufzeitende: null,
  verlaengerung: null,
  kuendigungsfristMonate: null,
  gekuendigtZum: null,
  notiz: null,
  kuendbar: true,
  version: 0,
  abbuchungAb: '2025-01-01',
  kategorie: { id: 'k', schluessel: 'VERSICHERUNG', name: null },
  zahlweise: 'MONATLICH',
  betrag: EUR(10),
} as const;

const KEINE_KUENDIGUNG = {
  art: 'KEINE_LAUFZEIT',
  dringend: false,
  fristMonate: null,
  kuendigenBis: null,
  zum: null,
} as const;

const JAEHRLICH: VertragAntwort = {
  ...LEER,
  id: 'kfz',
  anbieter: 'Musterversicherung AG',
  bezeichnung: 'Kfz-Versicherung',
  vertragsnummer: 'KFZ-1',
  zahlungsweg: 'LASTSCHRIFT',
  beginn: '2023-01-01',
  laufzeitende: '2023-12-31',
  verlaengerung: 'ZWOELF_MONATE',
  kuendigungsfristMonate: 1,
  notiz: 'Wichtig',
  zahlweise: 'JAEHRLICH',
  betrag: EUR(586.8),
  berechnet: {
    status: 'AKTIV',
    kostenProMonat: EUR(48.9),
    kostenProJahr: EUR(586.8),
    naechsteAbbuchung: '2027-01-01',
    kuendigung: {
      art: 'KUENDIGEN_BIS',
      dringend: true,
      fristMonate: 1,
      kuendigenBis: '2026-11-30',
      zum: '2026-12-31',
    },
  },
};

const BEENDET: VertragAntwort = {
  ...LEER,
  id: 'alt',
  anbieter: 'Alt GmbH',
  berechnet: {
    status: 'BEENDET',
    kostenProMonat: EUR(10),
    kostenProJahr: EUR(120),
    naechsteAbbuchung: null,
    kuendigung: { ...KEINE_KUENDIGUNG, art: 'BEENDET' },
  },
};

const PFLICHT: VertragAntwort = {
  ...LEER,
  id: 'rundfunk',
  anbieter: 'Beitragsservice',
  kuendbar: false,
  berechnet: {
    status: 'AKTIV',
    kostenProMonat: EUR(10),
    kostenProJahr: EUR(120),
    naechsteAbbuchung: '2027-01-15',
    kuendigung: { ...KEINE_KUENDIGUNG, art: 'NICHT_KUENDBAR' },
  },
};

const UEBERSICHT: VertragsuebersichtAntwort = {
  laufendeVertraege: 2,
  kostenProMonat: [EUR(58.9), { wert: 5, waehrung: 'USD' }],
  kostenProJahr: [EUR(706.8)],
  naechsteKuendigungsfristen: [],
};

describe('VertraegeSeite', () => {
  const auflisten = vi.fn();
  const uebersicht = vi.fn();

  beforeEach(async () => {
    auflisten.mockReset();
    uebersicht.mockReset();
    auflisten.mockReturnValue(of([JAEHRLICH, BEENDET, PFLICHT]));
    uebersicht.mockReturnValue(of(UEBERSICHT));
    await TestBed.configureTestingModule({
      imports: [VertraegeSeite],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'de-DE' },
        { provide: VertragService, useValue: { auflisten, uebersicht } },
      ],
    }).compileComponents();
  });

  async function seite() {
    const fixture = TestBed.createComponent(VertraegeSeite);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const text = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim();

  const details = (element: HTMLElement) =>
    Object.fromEntries(
      [...element.querySelectorAll('dl > div')].map((d) => [
        text(d.querySelector('dt')),
        text(d.querySelector('dd')),
      ]),
    );

  it('zeigt die Kennzahlen je Währung vollständig', async () => {
    const kennzahlen = (await seite()).element.querySelectorAll('.kennzahl');
    expect(text(kennzahlen[0])).toBe('Laufende Verträge2');
    expect(text(kennzahlen[1])).toBe('Kosten pro Monat58,90 € · 5,00 $');
    expect(text(kennzahlen[2])).toBe('Kosten pro Jahr706,80 €');
  });

  it('behält die Reihenfolge des Backends', async () => {
    const namen = [...(await seite()).element.querySelectorAll('.name')].map(text);
    expect(namen).toEqual(['Kfz-Versicherung', 'Alt GmbH', 'Beitragsservice']);
  });

  it('zeigt eine Zeile mit Angaben, Kosten und Badge', async () => {
    const zeile = (await seite()).element.querySelector('app-vertrag-zeile')!;
    expect(text(zeile.querySelector('.meta'))).toBe(
      'Musterversicherung AG · Versicherung · Nr. KFZ-1',
    );
    expect(text(zeile.querySelector('.notiz'))).toBe('Wichtig');
    expect(text(zeile.querySelector('.betrag'))).toBe('586,80 €');
    expect(text(zeile.querySelectorAll('.klein')[0])).toBe('jährlich · 48,90 €/Monat');
    expect(text(zeile.querySelectorAll('.klein')[1])).toBe('Nächste Abbuchung 01.01.2027');
    expect(text(zeile.querySelector('.badge'))).toBe('Kündbar bis 30.11.2026');
    expect(zeile.querySelector('.badge')?.classList).toContain('ton-warnung');
    expect(text(zeile.querySelector('.zusatz'))).toBe('zum 31.12.2026, 1 Monat Frist');
  });

  it('rechnet bei monatlicher Zahlung nicht um und nennt fehlende Abbuchungen', async () => {
    const zeile = (await seite()).element.querySelectorAll('app-vertrag-zeile')[1];
    expect(text(zeile.querySelector('.meta'))).toBe('Versicherung');
    expect(text(zeile.querySelectorAll('.klein')[0])).toBe('monatlich');
    expect(text(zeile.querySelectorAll('.klein')[1])).toBe('Keine weiteren Abbuchungen');
    expect(zeile.querySelector('.zeile')?.classList).toContain('beendet');
  });

  it('klappt Details auf und lässt höchstens eine offen', async () => {
    const { fixture, element } = await seite();
    const knoepfe = element.querySelectorAll<HTMLButtonElement>('.details-knopf');
    expect(knoepfe[0].getAttribute('aria-expanded')).toBe('false');
    expect(knoepfe[0].getAttribute('aria-label')).toBe('Details zu Kfz-Versicherung anzeigen');

    knoepfe[0].click();
    await fixture.whenStable();
    expect(knoepfe[0].getAttribute('aria-expanded')).toBe('true');
    expect(knoepfe[0].getAttribute('aria-label')).toBe('Details zu Kfz-Versicherung ausblenden');
    expect(element.querySelectorAll('.details').length).toBe(1);

    knoepfe[1].click();
    await fixture.whenStable();
    expect(knoepfe[0].getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelectorAll('.details').length).toBe(1);
    expect(element.querySelector('.details')?.getAttribute('aria-label')).toBe(
      'Details zu Alt GmbH',
    );

    knoepfe[1].click();
    await fixture.whenStable();
    expect(element.querySelector('.details')).toBeNull();
  });

  it('zeigt alle Details aus den Vertragsdaten', async () => {
    const { fixture, element } = await seite();
    element.querySelector<HTMLButtonElement>('.details-knopf')!.click();
    await fixture.whenStable();
    expect(details(element)).toEqual({
      Anbieter: 'Musterversicherung AG',
      Bezeichnung: 'Kfz-Versicherung',
      Kategorie: 'Versicherung',
      'Vertrags- oder Kundennummer': 'KFZ-1',
      Betrag: '586,80 € jährlich',
      'Pro Monat': '48,90 €',
      'Pro Jahr': '586,80 €',
      'Nächste Abbuchung': '01.01.2027',
      Zahlungsweg: 'Lastschrift',
      Vertragsbeginn: '01.01.2023',
      Laufzeitende: '31.12.2023',
      Verlängerung: 'Nach Laufzeitende um 12 Monate',
      Kündigungsfrist: '1 Monat',
      Kündigung: 'Kündbar bis 30.11.2026 (zum 31.12.2026, 1 Monat Frist)',
      Status: 'Aktiv',
      Notiz: 'Wichtig',
    });
  });

  it('nennt fehlende Angaben und lässt Felder weg, die nicht passen', async () => {
    const { fixture, element } = await seite();
    element.querySelectorAll<HTMLButtonElement>('.details-knopf')[1].click();
    await fixture.whenStable();
    expect(details(element)).toMatchObject({
      'Vertrags- oder Kundennummer': 'Nicht hinterlegt',
      'Nächste Abbuchung': 'Keine weiteren Abbuchungen',
      Zahlungsweg: 'Nicht hinterlegt',
      Vertragsbeginn: 'Nicht hinterlegt',
      Laufzeitende: 'Keine Mindestlaufzeit',
      Verlängerung: 'Nicht hinterlegt',
      Kündigungsfrist: 'Nicht hinterlegt',
      Status: 'Beendet',
    });
    expect(details(element)).not.toHaveProperty('Bezeichnung');
    expect(details(element)).not.toHaveProperty('Notiz');

    element.querySelectorAll<HTMLButtonElement>('.details-knopf')[2].click();
    await fixture.whenStable();
    expect(details(element)).not.toHaveProperty('Laufzeitende');
    expect(details(element)).not.toHaveProperty('Verlängerung');
    expect(details(element)).not.toHaveProperty('Kündigungsfrist');
  });

  it('zeigt den Leerzustand', async () => {
    auflisten.mockReturnValue(of([]));
    expect(text((await seite()).element.querySelector('.leer'))).toBe(
      'Noch keine VerträgeLege mit „Neuer Vertrag“ deinen ersten Vertrag an.',
    );
  });

  it('zeigt den Ladezustand', async () => {
    auflisten.mockReturnValue(NEVER);
    expect(text((await seite()).element.querySelector('[role="status"]'))).toBe('Wird geladen …');
  });

  it.each([
    ['Liste', auflisten],
    ['Übersicht', uebersicht],
  ])('bietet einen neuen Versuch an, wenn die %s nicht lädt', async (_name, aufruf) => {
    aufruf.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { fixture, element } = await seite();
    expect(text(element.querySelector('[role="alert"]'))).toBe(
      'Die Verträge konnten nicht geladen werden.',
    );
    expect(element.querySelector('.kennzahlen')).toBeNull();

    aufruf.mockReturnValue(aufruf === auflisten ? of([JAEHRLICH]) : of(UEBERSICHT));
    element.querySelector<HTMLButtonElement>('.fehler button')!.click();
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelector('.kennzahlen')).not.toBeNull();
  });
});
