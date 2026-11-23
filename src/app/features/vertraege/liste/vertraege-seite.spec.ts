import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, of, Subject, throwError } from 'rxjs';
import { VertragAntwort, VertragsuebersichtAntwort } from '../../../core/api/api';
import { UngespeicherteEingaben } from '../../../core/ungespeichert/ungespeicherte-eingaben';
import { VERTRAEGE_ROUTES } from '../vertraege.routes';
import { VertraegeSeite } from './vertraege-seite';
import {
  INFO_KALENDERJAHR,
  INFO_KALENDERJAHR_MIT_PROGNOSE,
  INFO_NUR_ANTEIL,
  INFO_OHNE_NICHT_BEGONNENE,
  INFO_RUNDUNG,
  INFO_RUNDUNG_DETAILS,
  INFO_RUNDUNG_PROGNOSE,
} from '../vertrag-texte';
import { VertragService } from '../vertrag.service';

const EUR = (wert: number) => ({ wert, waehrung: 'EUR' });

const LEER = {
  betragErrechnet: false,
  preissteigerungBetrachtetBis: null,
  bezeichnung: null,
  vertragsnummer: null,
  zahlungsweg: null,
  beginn: '2025-01-01',
  laufzeitende: null,
  verlaengerung: null,
  kuendigungsfristMonate: null,
  gekuendigtZum: null,
  notiz: null,
  kuendbar: true,
  version: 0,
  kategorie: { id: 'k', schluessel: 'VERSICHERUNG', name: null },
  zahlweise: 'MONATLICH',
  betrag: EUR(10),
  preise: [
    { gueltigAb: '2025-01-01', betrag: EUR(10), art: 'AKTUELL', automatisch: false },
  ] as VertragAntwort['preise'],
  anteilProzent: null,
  einmalkosten: [] as VertragAntwort['einmalkosten'],
  preissteigerung: null,
  preisgarantieBis: null,
  erinnerungSonderkuendigung: true,
} as const;

/** Was in `berechnet` für diese Tests keine Rolle spielt. */
const BERECHNET: Omit<
  VertragAntwort['berechnet'],
  'status' | 'kostenProMonat' | 'kostenImJahr' | 'kuendigung'
> = {
  kostenImJahrMitPrognose: false,
  jahr: 2026,
  eigenerAnteil: null,
  einmalkosten: EUR(0),
  naechstePreisaenderung: null,
  preisverlauf: [],
  prognose: [],
  vertragsende: null,
};

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
  preise: [{ gueltigAb: '2023-01-01', betrag: EUR(586.8), art: 'AKTUELL', automatisch: false }],
  berechnet: {
    ...BERECHNET,
    status: 'AKTIV',
    kostenProMonat: EUR(48.9),
    kostenImJahr: EUR(586.8),
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
    ...BERECHNET,
    status: 'BEENDET',
    kostenProMonat: EUR(10),
    kostenImJahr: EUR(120),
    kuendigung: { ...KEINE_KUENDIGUNG, art: 'BEENDET' },
    vertragsende: '2025-12-31',
  },
};

const PFLICHT: VertragAntwort = {
  ...LEER,
  id: 'rundfunk',
  anbieter: 'Beitragsservice',
  kuendbar: false,
  berechnet: {
    ...BERECHNET,
    status: 'AKTIV',
    kostenProMonat: EUR(10),
    kostenImJahr: EUR(120),
    kuendigung: { ...KEINE_KUENDIGUNG, art: 'NICHT_KUENDBAR' },
  },
};

/** Beginnt erst später, ohne Verlängerung. */
const SPAETER: VertragAntwort = {
  ...LEER,
  id: 'spaeter',
  anbieter: 'Später GmbH',
  beginn: '2027-03-01',
  laufzeitende: '2028-02-29',
  verlaengerung: 'KEINE',
  berechnet: {
    ...BERECHNET,
    status: 'NICHT_BEGONNEN',
    kostenProMonat: EUR(10),
    kostenImJahr: EUR(0),
    kuendigung: { ...KEINE_KUENDIGUNG, art: 'ENDET', zum: '2028-02-29' },
    vertragsende: '2028-02-29',
  },
};

/** Vor dem Beginn gekündigt. */
const STORNIERT: VertragAntwort = {
  ...LEER,
  id: 'storniert',
  anbieter: 'Storno AG',
  beginn: '2027-03-01',
  gekuendigtZum: '2027-02-28',
  berechnet: {
    ...BERECHNET,
    status: 'STORNIERT',
    kostenProMonat: EUR(10),
    kostenImJahr: EUR(0),
    kuendigung: { ...KEINE_KUENDIGUNG, art: 'STORNIERT' },
    vertragsende: '2027-02-28',
  },
};

/** Mit früherem, angekündigtem und nie geltendem Preis sowie Prognose. */
const MIT_PREISEN: VertragAntwort = {
  ...JAEHRLICH,
  id: 'strom',
  bezeichnung: 'Strom',
  betrag: EUR(600),
  preise: [
    { gueltigAb: '2023-01-01', betrag: EUR(549), art: 'FRUEHER', automatisch: false },
    { gueltigAb: '2026-01-01', betrag: EUR(600), art: 'AKTUELL', automatisch: false },
    { gueltigAb: '2027-01-01', betrag: EUR(620), art: 'ANGEKUENDIGT', automatisch: false },
    { gueltigAb: '2031-01-01', betrag: EUR(700), art: 'NACH_ENDE', automatisch: false },
  ],
  berechnet: {
    ...JAEHRLICH.berechnet,
    naechstePreisaenderung: { ab: '2027-01-01', betrag: EUR(620), art: 'ANGEKUENDIGT' },
    prognose: [{ ab: '2028-01-01', betrag: EUR(635.5) }],
  },
};

/** Zur Hälfte geteilt. */
const GETEILT: VertragAntwort = {
  ...JAEHRLICH,
  id: 'geteilt',
  bezeichnung: 'Geteilt',
  anteilProzent: 33.3,
  berechnet: {
    ...JAEHRLICH.berechnet,
    eigenerAnteil: { betrag: EUR(195.4), kostenProMonat: EUR(16.28), kostenImJahr: EUR(195.4) },
  },
};

const UEBERSICHT: VertragsuebersichtAntwort = {
  laufendeVertraege: 2,
  kostenProMonat: [EUR(58.9), { wert: 5, waehrung: 'USD' }],
  kostenImJahr: [EUR(706.8)],
  kostenImJahrMitPrognose: false,
  einmalkostenImJahr: [],
  hatAnteile: false,
  hatNichtBegonnene: false,
  jahr: 2026,
  naechsteKuendigungsfristen: [],
};

/** Die Antwort auf die Rückfrage kommt als Promise, danach erst geht es weiter. */
const naechsteRunde = () => new Promise((fertig) => setTimeout(fertig));

describe('VertraegeSeite', () => {
  const auflisten = vi.fn();
  const uebersicht = vi.fn();
  const aendern = vi.fn();
  const kategorien = vi.fn();
  const loeschen = vi.fn();

  beforeEach(async () => {
    // Beides gibt es in jsdom nicht; das Scrollen selbst prüfen die E2E-Tests.
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    aendern.mockReset();
    loeschen.mockReset();
    kategorien.mockReset();
    kategorien.mockReturnValue(of([LEER.kategorie]));
    auflisten.mockReset();
    uebersicht.mockReset();
    auflisten.mockReturnValue(of([JAEHRLICH, BEENDET, PFLICHT]));
    uebersicht.mockReturnValue(of(UEBERSICHT));
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'vertraege', children: VERTRAEGE_ROUTES }],
          withComponentInputBinding(),
        ),
        provideLocationMocks(),
        { provide: LOCALE_ID, useValue: 'de-DE' },
        {
          provide: VertragService,
          useValue: { auflisten, uebersicht, aendern, kategorien, loeschen, vorschau: () => NEVER },
        },
      ],
    }).compileComponents();
    // Sonst nur beim Start der App: Ohne folgt der Router der Zurück-Taste (location.back) nicht.
    TestBed.inject(Router).setUpLocationChangeListener();
  });

  afterEach(() => TestBed.inject(UngespeicherteEingaben).melden(false));

  async function seite(url = '/vertraege') {
    const harness = await RouterTestingHarness.create(url);
    const fixture = harness.fixture;
    const element = harness.routeNativeElement as HTMLElement;
    const stabil = async () => {
      await fixture.whenStable();
      await naechsteRunde();
      await fixture.whenStable();
    };
    await stabil();
    /** Öffnet den Info-Knopf, liest die Sätze der Blase und schließt ihn wieder; ohne Knopf null. */
    const info = async (beschriftung: string) => {
      const knopf = element.querySelector<HTMLButtonElement>(
        `button[aria-label="Info zu ${beschriftung}"]`,
      );
      if (!knopf) {
        return null;
      }
      knopf.click();
      await stabil();
      const saetze = [...element.querySelectorAll('.blase li')].map((li) => li.textContent);
      knopf.click();
      await stabil();
      return saetze;
    };
    return {
      harness,
      fixture,
      element,
      stabil,
      info,
      url: () => TestBed.inject(Router).url,
      instanz: () => harness.routeDebugElement!.componentInstance as VertraegeSeite,
    };
  }

  const text = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim();

  const zeilen = (element: HTMLElement) =>
    element.querySelectorAll<HTMLElement>('app-vertrag-zeile');

  const knopf = (element: HTMLElement, name: string) =>
    element.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;

  const schaltflaeche = (element: ParentNode, beschriftung: string) =>
    [...element.querySelectorAll('button')].find((b) => text(b) === beschriftung)!;

  const panel = (element: HTMLElement) => element.querySelector<HTMLElement>('.panel');

  const eintraege = (element: HTMLElement) =>
    Object.fromEntries(
      [...element.querySelectorAll('.panel dl > div')].map((d) => [
        text(d.querySelector('dt')),
        text(d.querySelector('dd')),
      ]),
    );

  describe('Liste', () => {
    it('zeigt die Kennzahlen je Währung vollständig, ohne Hinweiszeilen', async () => {
      const { element } = await seite();
      const kennzahlen = element.querySelectorAll('.kennzahl');
      expect(text(kennzahlen[0])).toBe('Laufende Verträge2');
      expect(text(kennzahlen[1])).toBe('Kosten pro Monat58,90 € · 5,00 $');
      expect(text(kennzahlen[2])).toBe('Kosten 2026706,80 €');
      expect(text(kennzahlen[3])).toBe('Einmalkosten 20260,00 €');
      expect(element.querySelector('.kennzahl small')).toBeNull();
    });

    it('erklärt die Kennzahlen im Info-Knopf, nur die zutreffenden Sätze', async () => {
      const { info } = await seite();
      expect(await info('Kosten pro Monat')).toEqual([INFO_RUNDUNG]);
      expect(await info('Kosten 2026')).toEqual([INFO_KALENDERJAHR, INFO_RUNDUNG]);
      expect(await info('Einmalkosten 2026')).toBeNull();
    });

    it('nennt die Prognose bei „Kosten <Jahr>“, wenn das Backend es meldet', async () => {
      uebersicht.mockReturnValue(of({ ...UEBERSICHT, kostenImJahrMitPrognose: true }));
      const { info } = await seite();
      expect(await info('Kosten 2026')).toEqual([INFO_KALENDERJAHR_MIT_PROGNOSE, INFO_RUNDUNG]);
    });

    it('zeigt die Einmalkosten im Jahr des Backends je Währung', async () => {
      uebersicht.mockReturnValue(
        of({
          ...UEBERSICHT,
          jahr: 2027,
          einmalkostenImJahr: [EUR(149.9), { wert: 20, waehrung: 'USD' }],
        }),
      );
      const kennzahlen = (await seite()).element.querySelectorAll('.kennzahl');
      expect(text(kennzahlen[3])).toBe('Einmalkosten 2027149,90 € · 20,00 $');
    });

    it('nennt bei „Kosten pro Monat“, dass später beginnende fehlen', async () => {
      uebersicht.mockReturnValue(of({ ...UEBERSICHT, hatNichtBegonnene: true }));
      const { info } = await seite();
      expect(await info('Kosten pro Monat')).toEqual([INFO_OHNE_NICHT_BEGONNENE, INFO_RUNDUNG]);
      expect(await info('Kosten 2026')).toEqual([INFO_KALENDERJAHR, INFO_RUNDUNG]);
    });

    it('nennt bei geteilten Verträgen an allen Kosten „nur dein Anteil“', async () => {
      uebersicht.mockReturnValue(of({ ...UEBERSICHT, hatAnteile: true, hatNichtBegonnene: true }));
      const { info } = await seite();
      expect(await info('Kosten pro Monat')).toEqual([
        INFO_NUR_ANTEIL,
        INFO_OHNE_NICHT_BEGONNENE,
        INFO_RUNDUNG,
      ]);
      expect(await info('Kosten 2026')).toEqual([INFO_KALENDERJAHR, INFO_NUR_ANTEIL, INFO_RUNDUNG]);
      expect(await info('Einmalkosten 2026')).toEqual([INFO_NUR_ANTEIL, INFO_RUNDUNG]);
    });

    it('behält die Reihenfolge des Backends', async () => {
      const namen = [...(await seite()).element.querySelectorAll('.name')].map(text);
      expect(namen).toEqual(['Kfz-Versicherung', 'Alt GmbH', 'Beitragsservice']);
    });

    it('zeigt eine Zeile mit Angaben, Kosten und Badge', async () => {
      const zeile = zeilen((await seite()).element)[0];
      expect(text(zeile.querySelector('.meta'))).toBe(
        'Musterversicherung AG · Versicherung · Nr. KFZ-1',
      );
      expect(text(zeile.querySelector('.notiz'))).toBe('Wichtig');
      expect(text(zeile.querySelector('.betrag'))).toBe('586,80 €');
      expect(text(zeile.querySelectorAll('.klein')[0])).toBe('jährlich · 48,90 €/Monat');
      expect(text(zeile.querySelectorAll('.klein')[1])).toBe('Seit 01.01.2023');
      expect(text(zeile.querySelector('.badge'))).toBe('Kündbar bis 30.11.2026');
      expect(zeile.querySelector('.badge')?.classList).toContain('ton-warnung');
      expect(text(zeile.querySelector('.zusatz'))).toBe('Vertrag endet zum 31.12.2026');
    });

    it('rechnet bei monatlicher Zahlung nicht um und nennt bei beendeten Beginn und Ende', async () => {
      const zeile = zeilen((await seite()).element)[1];
      expect(text(zeile.querySelector('.meta'))).toBe('Versicherung');
      expect(text(zeile.querySelectorAll('.klein')[0])).toBe('monatlich');
      expect(text(zeile.querySelectorAll('.klein')[1])).toBe('01.01.2025 – 31.12.2025');
      expect(zeile.querySelector('.zeile')?.classList).toContain('beendet');
    });

    it('nennt den späteren Beginn und stornierte Verträge, diese ausgegraut', async () => {
      auflisten.mockReturnValue(of([SPAETER, STORNIERT]));
      const [spaeter, storniert] = zeilen((await seite()).element);
      expect(text(spaeter.querySelectorAll('.klein')[1])).toBe('Beginnt am 01.03.2027');
      expect(spaeter.querySelector('.zeile')?.classList).not.toContain('beendet');
      expect(text(storniert.querySelectorAll('.klein')[1])).toBe(
        'Storniert, Beginn wäre 01.03.2027',
      );
      expect(text(storniert.querySelector('.badge'))).toBe('Storniert');
      expect(storniert.querySelector('.badge')?.classList).toContain('ton-neutral');
      expect(storniert.querySelector('.zeile')?.classList).toContain('beendet');
    });

    it('zeigt den Leerzustand mit Link zum ersten Vertrag', async () => {
      auflisten.mockReturnValue(of([]));
      const leer = (await seite()).element.querySelector('.leer');
      expect(text(leer)).toBe(
        'Noch keine VerträgeHier siehst du später alle Abos, Versicherungen und Beiträge auf einen Blick. Ersten Vertrag anlegen',
      );
      expect(leer?.querySelector('a')?.getAttribute('href')).toBe('/vertraege/neu');
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
      const { element, stabil } = await seite();
      expect(text(element.querySelector('[role="alert"]'))).toBe(
        'Die Verträge konnten nicht geladen werden.',
      );
      expect(element.querySelector('.kennzahlen')).toBeNull();

      aufruf.mockReturnValue(aufruf === auflisten ? of([JAEHRLICH]) : of(UEBERSICHT));
      element.querySelector<HTMLButtonElement>('.fehler button')!.click();
      await stabil();

      expect(element.querySelector('[role="alert"]')).toBeNull();
      expect(element.querySelector('.kennzahlen')).not.toBeNull();
    });

    it('nennt das Kürzel für „Neuer Vertrag“', async () => {
      const neu = [...(await seite()).element.querySelectorAll('.kopf a')].find(
        (a) => text(a) === 'Neuer Vertrag',
      )!;
      expect(neu.getAttribute('aria-keyshortcuts')).toBe('n');
      expect(neu.getAttribute('title')).toBe('Neuer Vertrag (N)');
    });

    it('ein älterer Ladevorgang überschreibt keinen neueren', async () => {
      const langsam = new Subject<VertragAntwort[]>();
      const { instanz, element, stabil } = await seite();
      auflisten.mockReturnValueOnce(langsam).mockReturnValueOnce(of([BEENDET]));
      instanz().laden();
      instanz().laden();
      await stabil();
      langsam.next([JAEHRLICH, PFLICHT]);
      langsam.complete();
      await stabil();
      expect(zeilen(element)).toHaveLength(1);
    });
  });

  describe('nach dem Anlegen', () => {
    const naviAus = (trigger: string, state: Record<string, unknown>) =>
      vi
        .spyOn(TestBed.inject(Router), 'currentNavigation')
        .mockReturnValue({ trigger, extras: { state } } as never);
    const STATE = { meldung: '„Neu“ wurde gespeichert.', vertragId: 'alt' };

    beforeEach(() => vi.mocked(Element.prototype.scrollIntoView).mockClear());

    it('zeigt die Meldung an der Zeile, fokussiert sie und holt die Zeile ins Bild', async () => {
      naviAus('imperative', STATE);
      const { element } = await seite();
      const meldung = zeilen(element)[1].querySelector('.meldung');
      expect(meldung?.textContent).toContain('„Neu“ wurde gespeichert.');
      expect(element.querySelector(':scope > .meldung')).toBeNull();
      expect(document.activeElement).toBe(meldung);
      expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toEqual([
        zeilen(element)[1].querySelector('.zeile'),
      ]);
    });

    it('zeigt die Meldung oben, wenn die Zeile fehlt, und scrollt nicht', async () => {
      naviAus('imperative', { ...STATE, vertragId: 'unbekannt' });
      const { element } = await seite();
      expect(element.querySelector(':scope > .meldung')?.textContent).toContain('„Neu“');
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it('zeigt die Meldung oben, wenn das Laden scheitert; der neue Versuch holt die Zeile ins Bild', async () => {
      naviAus('imperative', STATE);
      auflisten.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      const { element, stabil } = await seite();
      expect(element.querySelector(':scope > .meldung')?.textContent).toContain('„Neu“');
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

      auflisten.mockReturnValue(of([JAEHRLICH, BEENDET, PFLICHT]));
      element.querySelector<HTMLButtonElement>('.fehler button')!.click();
      await stabil();
      expect(element.querySelector(':scope > .meldung')).toBeNull();
      expect(zeilen(element)[1].querySelector('.meldung')?.textContent).toContain('„Neu“');
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledOnce();
    });

    it('zeigt und scrollt nichts beim Zurückblättern', async () => {
      naviAus('popstate', STATE);
      const { element } = await seite();
      expect(element.querySelector('.meldung')).toBeNull();
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });
  });

  describe('Details', () => {
    const NAME = 'Kfz-Versicherung';

    it('ein Klick auf die Zeile öffnet sie, ein zweiter schließt sie', async () => {
      const { element, stabil, url } = await seite();
      const tippen = knopf(element, `Details zu ${NAME} anzeigen`);
      expect(tippen.getAttribute('aria-expanded')).toBe('false');

      tippen.click();
      await stabil();
      expect(url()).toBe('/vertraege/kfz');
      expect(tippen.getAttribute('aria-expanded')).toBe('true');
      expect(tippen.getAttribute('aria-label')).toBe(`Details zu ${NAME} schließen`);
      expect(zeilen(element)[0].querySelector('.zeile')?.classList).toContain('offen');
      expect(text(panel(element)?.querySelector('h2'))).toBe(NAME);
      expect(document.activeElement).toBe(panel(element));

      tippen.click();
      await stabil();
      expect(url()).toBe('/vertraege');
      expect(panel(element)).toBeNull();
      expect(document.activeElement).toBe(tippen);
    });

    it('zeigt Kacheln und die Tabs Allgemein, Kosten, Laufzeit und Preisverlauf', async () => {
      const { element, stabil, url, info } = await seite('/vertraege/kfz');
      expect([...element.querySelectorAll('.kachel')].map(text)).toEqual([
        'Pro Monat48,90 €',
        'Laufzeitseit 01.01.2023Mindestlaufzeit bis 31.12.2023',
        'KündigungKündbar bis 30.11.2026Vertrag endet zum 31.12.2026',
        'Nächste PreisänderungKeine bekannt',
      ]);
      expect(element.querySelectorAll('.kachel button[aria-label^="Info zu"]')).toHaveLength(1);
      expect(await info('Pro Monat')).toEqual([INFO_RUNDUNG_DETAILS]);
      const tabs = [...element.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      expect(tabs.map(text)).toEqual(['Allgemein', 'Kosten', 'Laufzeit', 'Preisverlauf']);
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
      expect(element.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe(
        tabs[0].id,
      );
      expect(eintraege(element)).toEqual({
        Anbieter: 'Musterversicherung AG',
        Bezeichnung: 'Kfz-Versicherung',
        Kategorie: 'Versicherung',
        'Vertrags- oder Kundennummer': 'KFZ-1',
        Notiz: 'Wichtig',
      });

      tabs[1].click();
      await stabil();
      expect(url()).toBe('/vertraege/kfz?tab=kosten');
      expect(eintraege(element)).toEqual({
        'Aktueller Betrag': '586,80 € jährlich',
        'Pro Monat': '48,90 €',
        'Kosten 2026': '586,80 €',
        Zahlungsweg: 'Lastschrift',
      });

      tabs[2].click();
      await stabil();
      expect(url()).toBe('/vertraege/kfz?tab=laufzeit');
      expect(eintraege(element)).toEqual({
        Vertragsbeginn: '01.01.2023',
        Laufzeitende: '31.12.2023',
        Verlängerung: 'Nach Laufzeitende um 12 Monate',
        Kündigungsfrist: '1 Monat',
        Kündigung: 'Kündbar bis 30.11.2026. Vertrag endet zum 31.12.2026',
        Status: 'Aktiv',
      });

      tabs[0].click();
      await stabil();
      expect(url()).toBe('/vertraege/kfz');
    });

    it('wählt Tabs mit den Pfeiltasten', async () => {
      const { element, stabil, url } = await seite('/vertraege/kfz');
      const tabs = () => [...element.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      tabs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await stabil();
      expect(url()).toBe('/vertraege/kfz?tab=preise');
      expect(document.activeElement).toBe(tabs()[3]);
      expect(tabs().map((t) => t.tabIndex)).toEqual([-1, -1, -1, 0]);
    });

    it('Tab Preisverlauf: alle Preise mit Art und Prognose, Kachel und Chip zur nächsten Änderung', async () => {
      auflisten.mockReturnValue(of([MIT_PREISEN, BEENDET]));
      const { element, info } = await seite('/vertraege/strom?tab=preise');
      expect([...element.querySelectorAll('app-vertrag-preise li')].map(text)).toEqual([
        'ab 01.01.2023: 549,00 €',
        'ab 01.01.2026: 600,00 € · aktuell',
        'ab 01.01.2027: 620,00 € · angekündigt',
        'ab 01.01.2031: 700,00 € · nach Vertragsende',
        'ab 01.01.2028: 635,50 € · Prognose',
      ]);
      expect(text(element.querySelectorAll('.kachel')[3])).toBe(
        'Nächste Preisänderungab 01.01.2027620,00 € · angekündigt',
      );
      expect(text(zeilen(element)[0].querySelector('.chip'))).toBe('Preis ↑ ab 01.01.2027');
      expect(zeilen(element)[1].querySelector('.chip')).toBeNull();
      expect(await info('Preise')).toEqual([INFO_RUNDUNG_PROGNOSE]);
    });

    it('Tab Preisverlauf: Diagramm ab zwei Punkten, darunter Garantie, Regel und Erinnerung', async () => {
      auflisten.mockReturnValue(
        of([
          {
            ...MIT_PREISEN,
            preisgarantieBis: '2026-12-31',
            preissteigerung: {
              art: 'PROZENT',
              prozent: 2.5,
              betrag: null,
              rhythmus: 'JAEHRLICH',
              naechsteAm: '2025-01-01',
            },
            erinnerungSonderkuendigung: false,
            berechnet: {
              ...MIT_PREISEN.berechnet,
              kostenImJahrMitPrognose: true,
              preisverlauf: [
                { ab: '2023-01-01', betrag: EUR(549), art: 'GEZAHLT' },
                { ab: '2026-01-01', betrag: EUR(600), art: 'GEZAHLT' },
                { ab: '2027-01-01', betrag: EUR(620), art: 'ANGEKUENDIGT' },
                { ab: '2028-01-01', betrag: EUR(635.5), art: 'PROGNOSE' },
              ],
            },
          },
        ]),
      );
      const { element, stabil } = await seite('/vertraege/strom?tab=preise');
      expect(element.querySelector('app-vertrag-preisverlauf [role="img"]')).not.toBeNull();
      expect(eintraege(element)).toEqual({
        'Preisgarantie bis': '31.12.2026',
        'Regelmäßige Erhöhung': 'Jährlich um 2,5 %',
        'Erinnerung Sonderkündigungsrecht': 'Aus',
      });

      element.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
      await stabil();
      expect(eintraege(element)['Kosten 2026']).toBe('586,80 € inkl. Prognose');
    });

    it('Tab Preisverlauf ohne Regel und Änderungen: Hinweis statt Diagramm, Erinnerung fehlt', async () => {
      const { element } = await seite('/vertraege/kfz?tab=preise');
      expect(element.querySelector('app-vertrag-preisverlauf')).toBeNull();
      expect(element.querySelector('.keine-preise')).not.toBeNull();
      expect(eintraege(element)).toEqual({
        'Preisgarantie bis': 'Keine',
        'Regelmäßige Erhöhung': 'Nein',
      });
    });

    it('geteilter Vertrag: Chip, Kachel „Pro Monat“ und „Dein Anteil“ im Tab Kosten', async () => {
      auflisten.mockReturnValue(of([GETEILT, BEENDET]));
      const { element } = await seite('/vertraege/geteilt?tab=kosten');
      expect(text(zeilen(element)[0].querySelector('app-vertrag-chips'))).toBe('Anteil 33,3 %');
      expect(zeilen(element)[1].querySelector('app-vertrag-chips')).toBeNull();
      expect(text(element.querySelectorAll('.kachel')[0])).toBe(
        'Pro Monat48,90 €Dein Anteil 16,28 € (33,3 %)',
      );
      expect(eintraege(element)['Dein Anteil']).toBe('33,3 % = 16,28 € pro Monat');
    });

    it('Tab Kosten: Einmalkosten in der Reihenfolge des Backends, Gesamt ohne Anteil', async () => {
      auflisten.mockReturnValue(
        of([
          {
            ...GETEILT,
            einmalkosten: [
              { bezeichnung: 'Router', betrag: EUR(99), faelligAm: '2026-01-15' },
              { bezeichnung: 'Anschluss', betrag: EUR(49.9), faelligAm: '2026-02-01' },
            ],
            berechnet: { ...GETEILT.berechnet, einmalkosten: EUR(148.9) },
          },
        ]),
      );
      const { element, stabil } = await seite('/vertraege/geteilt?tab=kosten');
      const einmal = () => element.querySelector('app-vertrag-einmalkosten');
      expect([...einmal()!.querySelectorAll('li')].map(text)).toEqual([
        'Router · fällig am 15.01.202699,00 €',
        'Anschluss · fällig am 01.02.202649,90 €',
      ]);
      expect(text(einmal()!.querySelector('.gesamt'))).toBe('Gesamt 148,90 €');

      element.querySelectorAll<HTMLButtonElement>('[role="tab"]')[0].click();
      await stabil();
      expect(einmal()).toBeNull();
    });

    it('Tab Kosten ohne Einmalkosten: Hinweis statt Liste', async () => {
      const { element } = await seite('/vertraege/kfz?tab=kosten');
      expect(text(element.querySelector('app-vertrag-einmalkosten'))).toBe(
        'EinmalkostenKeine Einmalkosten hinterlegt.',
      );
    });

    it('ohne Anteil kein Untertitel und keine Zeile „Dein Anteil“', async () => {
      const { element } = await seite('/vertraege/kfz?tab=kosten');
      expect(text(element.querySelectorAll('.kachel')[0])).toBe('Pro Monat48,90 €');
      expect(eintraege(element)['Dein Anteil']).toBeUndefined();
    });

    it('Chip: Pfeil nach unten bei günstigerem Preis, Hinweis bei Prognose', async () => {
      const guenstiger = {
        ...MIT_PREISEN,
        berechnet: {
          ...MIT_PREISEN.berechnet,
          naechstePreisaenderung: { ab: '2027-01-01', betrag: EUR(500), art: 'ANGEKUENDIGT' },
        },
      } satisfies VertragAntwort;
      const prognose = {
        ...MIT_PREISEN,
        id: 'prognose',
        berechnet: {
          ...MIT_PREISEN.berechnet,
          naechstePreisaenderung: { ab: '2028-01-01', betrag: EUR(635.5), art: 'PROGNOSE' },
        },
      } satisfies VertragAntwort;
      auflisten.mockReturnValue(of([guenstiger, prognose]));
      const { element } = await seite();
      expect([...zeilen(element)].map((z) => text(z.querySelector('.chip')))).toEqual([
        'Preis ↓ ab 01.01.2027',
        'Preis ↑ ab 01.01.2028 (Prognose)',
      ]);
    });

    it('Tab Preisverlauf: automatische Preise zusammengeklappt, errechnete Stufe als aktuell', async () => {
      const stufe = (jahr: number, wert: number) => ({
        gueltigAb: `${jahr}-11-12`,
        betrag: EUR(wert),
        art: 'FRUEHER' as const,
        automatisch: true,
      });
      const automatisch: VertragAntwort = {
        ...JAEHRLICH,
        id: 'auto',
        bezeichnung: 'Automatisch',
        betrag: EUR(110.4),
        betragErrechnet: true,
        preise: [
          { gueltigAb: '2020-11-12', betrag: EUR(100), art: 'FRUEHER', automatisch: false },
          stufe(2021, 102),
          stufe(2022, 104.04),
          stufe(2023, 106.12),
          stufe(2024, 108.24),
          { ...stufe(2025, 108.24), art: 'AKTUELL' },
        ],
        berechnet: {
          ...JAEHRLICH.berechnet,
          preisverlauf: [
            { ab: '2020-11-12', betrag: EUR(100), art: 'GEZAHLT' },
            { ab: '2026-11-12', betrag: EUR(110.4), art: 'ERRECHNET' },
          ],
          prognose: [{ ab: '2027-11-12', betrag: EUR(112.61) }],
        },
      };
      auflisten.mockReturnValue(of([automatisch]));
      const { element, stabil } = await seite('/vertraege/auto?tab=preise');
      const liste = () =>
        [...element.querySelectorAll('app-vertrag-preise .preise > ul > li')].map(text);
      expect(liste()).toEqual([
        'ab 12.11.2020: 100,00 €',
        '5 automatische Preise, 2021–2025',
        'ab 12.11.2026: 110,40 € · aktuell · errechnet',
        'ab 12.11.2027: 112,61 € · Prognose',
      ]);
      const knopf = element.querySelector<HTMLButtonElement>('app-vertrag-preise .gruppe button')!;
      expect(knopf.getAttribute('aria-expanded')).toBe('false');
      knopf.click();
      await stabil();
      expect(knopf.getAttribute('aria-expanded')).toBe('true');
      expect([...element.querySelectorAll('app-vertrag-preise .gruppe li')].map(text)).toEqual([
        'ab 12.11.2021: 102,00 € · automatisch',
        'ab 12.11.2022: 104,04 € · automatisch',
        'ab 12.11.2023: 106,12 € · automatisch',
        'ab 12.11.2024: 108,24 € · automatisch',
        'ab 12.11.2025: 108,24 € · automatisch',
      ]);

      element.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
      await stabil();
      expect(eintraege(element)['Aktueller Betrag']).toBe('110,40 € jährlich · errechnet');
    });

    it('Tab Preisverlauf ohne Änderungen: „Preis hinzufügen“ öffnet Bearbeiten im Tab Preisverlauf', async () => {
      const { element, stabil, url } = await seite('/vertraege/kfz?tab=preise');
      expect(element.querySelector('app-vertrag-preise li')).toBeNull();
      expect(element.querySelector('app-vertrag-preise app-info-knopf button')).toBeNull();
      expect(text(element.querySelector('.keine-preise span'))).toBe(
        'Noch keine Preisänderungen hinterlegt.',
      );
      schaltflaeche(element.querySelector('app-vertrag-preise')!, 'Preis hinzufügen').click();
      await stabil();
      expect(url()).toBe('/vertraege/kfz/bearbeiten');
      const formular = element.querySelector('app-vertrag-bearbeiten')!;
      expect(text(formular.querySelector('[role="tab"][aria-selected="true"]'))).toBe(
        'Preisverlauf',
      );
      expect(formular.querySelectorAll('.preis:not(.erster)')).toHaveLength(1);
    });

    it('Kachel „Laufzeit“ je nach Status, Mindestlaufzeit und Verlängerung', async () => {
      const offen: VertragAntwort = { ...JAEHRLICH, id: 'offen', laufzeitende: null };
      auflisten.mockReturnValue(of([BEENDET, PFLICHT, SPAETER, STORNIERT, offen]));
      const { element, stabil } = await seite('/vertraege/alt');
      const laufzeit = () => text(element.querySelectorAll('.kachel')[1]);
      expect(laufzeit()).toBe('Laufzeit01.01.2025 – 31.12.2025');

      const erwartet = {
        rundfunk: 'Laufzeitseit 01.01.2025',
        spaeter: 'Laufzeitab 01.03.2027Endet am 29.02.2028',
        storniert: 'LaufzeitStorniert',
        offen: 'Laufzeitseit 01.01.2023Keine Mindestlaufzeit',
      };
      for (const [id, kachel] of Object.entries(erwartet)) {
        await TestBed.inject(Router).navigateByUrl(`/vertraege/${id}`);
        await stabil();
        expect(laufzeit()).toBe(kachel);
      }
    });

    it('nennt im Tab Laufzeit die neuen Status', async () => {
      auflisten.mockReturnValue(of([SPAETER, STORNIERT]));
      const { element, stabil } = await seite('/vertraege/spaeter?tab=laufzeit');
      expect(eintraege(element)).toMatchObject({ Status: 'Noch nicht begonnen' });
      await TestBed.inject(Router).navigateByUrl('/vertraege/storniert?tab=laufzeit');
      await stabil();
      expect(eintraege(element)).toMatchObject({ Kündigung: 'Storniert', Status: 'Storniert' });
    });

    it('zeigt bei unbekanntem Tab „Allgemein“', async () => {
      const { element } = await seite('/vertraege/kfz?tab=unbekannt');
      expect(text(element.querySelector('[role="tab"][aria-selected="true"]'))).toBe('Allgemein');
    });

    it('nennt fehlende Angaben und lässt Felder weg, die nicht passen', async () => {
      const { element, stabil } = await seite('/vertraege/alt?tab=kosten');
      expect(eintraege(element)).toMatchObject({ Zahlungsweg: 'Nicht hinterlegt' });
      expect(eintraege(element)).not.toHaveProperty('Nächste Abbuchung');
      await TestBed.inject(Router).navigateByUrl('/vertraege/alt?tab=laufzeit');
      await stabil();
      expect(eintraege(element)).toMatchObject({
        Vertragsbeginn: '01.01.2025',
        Laufzeitende: 'Keine Mindestlaufzeit',
        Verlängerung: 'Nicht hinterlegt',
        Kündigungsfrist: 'Nicht hinterlegt',
        Status: 'Beendet',
      });
      await TestBed.inject(Router).navigateByUrl('/vertraege/alt');
      await stabil();
      expect(eintraege(element)).toMatchObject({
        'Vertrags- oder Kundennummer': 'Nicht hinterlegt',
      });
      expect(eintraege(element)).not.toHaveProperty('Bezeichnung');
      expect(eintraege(element)).not.toHaveProperty('Notiz');

      await TestBed.inject(Router).navigateByUrl('/vertraege/rundfunk?tab=laufzeit');
      await stabil();
      expect(eintraege(element)).not.toHaveProperty('Laufzeitende');
      expect(eintraege(element)).not.toHaveProperty('Verlängerung');
      expect(eintraege(element)).not.toHaveProperty('Kündigungsfrist');
    });

    it('Wechsel zu einem anderen Vertrag ersetzt den Eintrag im Verlauf, Schließen geht zurück', async () => {
      const { element, stabil, url } = await seite();
      const location = TestBed.inject(Location);
      const back = vi.spyOn(location, 'back');
      knopf(element, `Details zu ${NAME} anzeigen`).click();
      await stabil();
      knopf(element, 'Details zu Alt GmbH anzeigen').click();
      await stabil();
      expect(url()).toBe('/vertraege/alt');
      expect(text(panel(element)?.querySelector('h2'))).toBe('Alt GmbH');

      knopf(element, 'Details schließen').click();
      expect(back).toHaveBeenCalledOnce();
    });

    it('ein geteilter Link schließt zur Liste, ohne den Verlauf zu verlassen', async () => {
      const { element, stabil, url } = await seite('/vertraege/kfz');
      const back = vi.spyOn(TestBed.inject(Location), 'back');
      schaltflaeche(element, 'Verträge').click();
      await stabil();
      expect(back).not.toHaveBeenCalled();
      expect(url()).toBe('/vertraege');
    });

    it('Esc im Panel schließt', async () => {
      const { element, stabil, url } = await seite('/vertraege/kfz');
      panel(element)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await stabil();
      expect(url()).toBe('/vertraege');
    });

    it('ein Link auf einen unbekannten Vertrag zeigt oben einen Hinweis', async () => {
      const { element, url } = await seite('/vertraege/gibt-es-nicht');
      expect(url()).toBe('/vertraege');
      expect(element.querySelector(':scope > .meldung')?.textContent).toContain(
        'Diesen Vertrag gibt es nicht mehr.',
      );
    });

    it('zeigt die Meldung des offenen Vertrags im Panel statt an der Zeile', async () => {
      aendern.mockReturnValue(of(JAEHRLICH));
      const { element, instanz, stabil } = await seite('/vertraege/kfz');
      instanz().gespeichert(JAEHRLICH);
      await stabil();
      expect(panel(element)?.querySelector('.meldung')?.textContent).toContain(
        '„Kfz-Versicherung“ wurde gespeichert.',
      );
      expect(zeilen(element)[0].querySelector('.meldung')).toBeNull();
    });
  });

  describe('Kontextmenü', () => {
    const menue = (element: HTMLElement) => element.querySelector<HTMLElement>('[role="menu"]');
    const eintraegeImMenue = (element: HTMLElement) => [
      ...menue(element)!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    ];
    const taste = (ziel: Element, key: string) =>
      ziel.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

    async function offen() {
      const s = await seite();
      knopf(s.element, 'Aktionen für Kfz-Versicherung').click();
      await s.stabil();
      return s;
    }

    it('öffnet über „…“ mit dem Fokus auf dem ersten Eintrag', async () => {
      const { element } = await offen();
      const mehr = knopf(element, 'Aktionen für Kfz-Versicherung');
      expect(mehr.getAttribute('aria-expanded')).toBe('true');
      expect(mehr.getAttribute('aria-controls')).toBe(menue(element)?.id);
      expect(eintraegeImMenue(element).map(text)).toEqual([
        'Details anzeigen',
        'Bearbeiten …',
        'Löschen …',
      ]);
      expect(document.activeElement).toBe(eintraegeImMenue(element)[0]);
    });

    it('Pfeiltasten wandern, Esc schließt und gibt den Fokus an „…“ zurück', async () => {
      const { element, stabil } = await offen();
      const [details, bearbeiten, loeschenEintrag] = eintraegeImMenue(element);
      taste(details, 'ArrowDown');
      expect(document.activeElement).toBe(bearbeiten);
      taste(bearbeiten, 'End');
      expect(document.activeElement).toBe(loeschenEintrag);
      taste(loeschenEintrag, 'ArrowDown');
      expect(document.activeElement).toBe(details);
      taste(details, 'ArrowUp');
      expect(document.activeElement).toBe(loeschenEintrag);

      taste(loeschenEintrag, 'Escape');
      await stabil();
      expect(menue(element)).toBeNull();
      expect(document.activeElement).toBe(knopf(element, 'Aktionen für Kfz-Versicherung'));
    });

    it('ein Klick daneben schließt', async () => {
      const { element, stabil } = await offen();
      element.querySelector<HTMLButtonElement>('.hintergrund')!.click();
      await stabil();
      expect(menue(element)).toBeNull();
    });

    it('„Details anzeigen“ öffnet die Details', async () => {
      const { element, stabil, url } = await offen();
      eintraegeImMenue(element)[0].click();
      await stabil();
      expect(url()).toBe('/vertraege/kfz');
    });

    it('„Bearbeiten …“ öffnet das Sheet', async () => {
      const { element, stabil, url } = await offen();
      eintraegeImMenue(element)[1].click();
      await stabil();
      expect(url()).toBe('/vertraege/kfz/bearbeiten');
    });

    it('„Löschen …“ fragt nach', async () => {
      const { element, stabil } = await offen();
      eintraegeImMenue(element)[2].click();
      await stabil();
      expect(text(element.querySelector('app-bestaetigen-dialog dialog[open] h2'))).toBe(
        '„Kfz-Versicherung“ löschen?',
      );
    });

    it('Rechtsklick öffnet es ab 901 px, darunter bleibt das Menü des Browsers', async () => {
      const { element, stabil } = await seite();
      const zeile = zeilen(element)[0].querySelector('.zeile')!;
      const rechtsklick = () => {
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        zeile.dispatchEvent(event);
        return event.defaultPrevented;
      };

      expect(rechtsklick()).toBe(false);
      await stabil();
      expect(menue(element)).toBeNull();

      vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
      expect(rechtsklick()).toBe(true);
      await stabil();
      expect(menue(element)).not.toBeNull();
    });
  });

  describe('Kürzel N', () => {
    const druecken = (ziel: EventTarget, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', {
        key: 'n',
        bubbles: true,
        cancelable: true,
        ...init,
      });
      ziel.dispatchEvent(event);
      return event;
    };

    it('öffnet „Neuer Vertrag“', async () => {
      const { stabil, url } = await seite();
      expect(druecken(document.body).defaultPrevented).toBe(true);
      await stabil();
      expect(url()).toBe('/vertraege/neu');
    });

    it.each([
      ['Strg', { ctrlKey: true }],
      ['⌘', { metaKey: true }],
      ['Alt', { altKey: true }],
      ['gehalten', { repeat: true }],
    ])('nicht mit %s', async (_, init) => {
      const { stabil, url } = await seite();
      expect(druecken(document.body, init).defaultPrevented).toBe(false);
      await stabil();
      expect(url()).toBe('/vertraege');
    });

    it('nicht beim Tippen', async () => {
      const { stabil, url } = await seite();
      const feld = document.createElement('input');
      document.body.appendChild(feld);
      druecken(feld);
      await stabil();
      expect(url()).toBe('/vertraege');
      feld.remove();
    });

    it('nicht, solange das Sheet offen ist', async () => {
      const { stabil, url } = await seite('/vertraege/kfz/bearbeiten');
      druecken(document.body);
      await stabil();
      expect(url()).toBe('/vertraege/kfz/bearbeiten');
    });
  });

  describe('Bearbeiten', () => {
    const NAME = 'Kfz-Versicherung';
    const sheet = (element: HTMLElement) =>
      element.querySelector<HTMLDialogElement>('app-vertrag-bearbeiten dialog');

    async function geoeffnet(url = '/vertraege/kfz/bearbeiten') {
      const s = await seite(url);
      const eingeben = async (wert: string) => {
        const notiz = s.element.querySelector<HTMLTextAreaElement>('[formcontrolname="notiz"]')!;
        notiz.value = wert;
        notiz.dispatchEvent(new Event('input'));
        await s.stabil();
      };
      const sichern = async () => {
        schaltflaeche(sheet(s.element)!, 'Sichern').click();
        await s.stabil();
      };
      return { ...s, eingeben, sichern };
    }

    it('öffnet aus den Details das Sheet mit vorbelegtem Formular', async () => {
      const { element, stabil, url } = await seite('/vertraege/kfz');
      schaltflaeche(panel(element)!, 'Bearbeiten').click();
      await stabil();
      expect(url()).toBe('/vertraege/kfz/bearbeiten');
      expect(sheet(element)?.open).toBe(true);
      expect(text(sheet(element)?.querySelector('h2'))).toBe('Vertrag bearbeiten');
      expect(text(sheet(element)?.querySelector('.name'))).toBe(NAME);
      expect(element.querySelector<HTMLInputElement>('[formcontrolname="anbieter"]')!.value).toBe(
        'Musterversicherung AG',
      );
      expect(schaltflaeche(sheet(element)!, 'Sichern').getAttribute('form')).toBe(
        element.querySelector('app-vertrag-bearbeiten form')!.id,
      );
    });

    it('lädt die Kategorien erst beim ersten Bearbeiten und nur einmal', async () => {
      const { stabil } = await seite();
      expect(kategorien).not.toHaveBeenCalled();
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/vertraege/kfz/bearbeiten');
      await stabil();
      await router.navigateByUrl('/vertraege/kfz');
      await stabil();
      await router.navigateByUrl('/vertraege/alt/bearbeiten');
      await stabil();
      expect(kategorien).toHaveBeenCalledOnce();
    });

    it('lädt nach einem Fehler beim nächsten Versuch neu', async () => {
      kategorien.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
      const { element, stabil } = await geoeffnet();
      expect(element.textContent).toContain('Die Kategorien konnten nicht geladen werden.');
      expect(element.querySelector('app-vertrag-bearbeiten form')).toBeNull();
      expect(schaltflaeche(sheet(element)!, 'Sichern').disabled).toBe(true);

      element.querySelector<HTMLButtonElement>('app-vertrag-bearbeiten .fehler button')!.click();
      await stabil();
      expect(element.querySelector('app-vertrag-bearbeiten form')).not.toBeNull();
    });

    it('„Abbrechen“ fragt bei Änderungen nach, „Weiter bearbeiten“ behält sie', async () => {
      const { element, stabil, eingeben, url } = await geoeffnet();
      const fragen = TestBed.inject(UngespeicherteEingaben);
      await eingeben('Neu');
      schaltflaeche(sheet(element)!, 'Abbrechen').click();
      // Nicht auf Stabilität warten: Die Navigation wartet auf die Antwort.
      await naechsteRunde();
      expect(fragen.frageOffen()).toBe(true);

      fragen.antworten(false);
      await stabil();
      expect(url()).toBe('/vertraege/kfz/bearbeiten');
      expect(element.querySelector<HTMLTextAreaElement>('[formcontrolname="notiz"]')!.value).toBe(
        'Neu',
      );
    });

    it('nach „Verwerfen“ schließt es zu den Details', async () => {
      const { element, stabil, eingeben, url } = await geoeffnet();
      const fragen = TestBed.inject(UngespeicherteEingaben);
      await eingeben('Neu');
      schaltflaeche(sheet(element)!, 'Abbrechen').click();
      await naechsteRunde();
      fragen.antworten(true);
      await stabil();
      expect(url()).toBe('/vertraege/kfz');
      expect(sheet(element)).toBeNull();
    });

    it('Esc und ein Klick daneben schließen wie „Abbrechen“', async () => {
      const { element, stabil, url } = await geoeffnet();
      const esc = new Event('cancel', { cancelable: true });
      sheet(element)!.dispatchEvent(esc);
      expect(esc.defaultPrevented).toBe(true);
      await stabil();
      expect(url()).toBe('/vertraege/kfz');

      await TestBed.inject(Router).navigateByUrl('/vertraege/kfz/bearbeiten');
      await stabil();
      sheet(element)!.click();
      await stabil();
      expect(url()).toBe('/vertraege/kfz');
    });

    it('ein Klick im Sheet schließt nicht', async () => {
      const { element, stabil, url } = await geoeffnet();
      sheet(element)!.querySelector<HTMLElement>('.inhalt')!.click();
      await stabil();
      expect(url()).toBe('/vertraege/kfz/bearbeiten');
    });

    it('fragt auch beim Wechsel zu einem anderen Vertrag', async () => {
      const { stabil, eingeben, url } = await geoeffnet();
      await eingeben('Neu');
      void TestBed.inject(Router).navigateByUrl('/vertraege/alt');
      await naechsteRunde();
      expect(TestBed.inject(UngespeicherteEingaben).frageOffen()).toBe(true);
      TestBed.inject(UngespeicherteEingaben).antworten(false);
      await stabil();
      expect(url()).toBe('/vertraege/kfz/bearbeiten');
    });

    it('200: schließt, lädt neu und zeigt die Meldung in den Details', async () => {
      aendern.mockReturnValue(of(JAEHRLICH));
      const { element, sichern, url, eingeben } = await geoeffnet();
      await eingeben('Neu');
      expect(auflisten).toHaveBeenCalledOnce();
      await sichern();

      expect(aendern).toHaveBeenCalledWith(
        'kfz',
        expect.objectContaining({ version: 0, beginn: '2023-01-01', kategorieId: 'k' }),
      );
      expect(TestBed.inject(UngespeicherteEingaben).vorhanden()).toBe(false);
      expect(url()).toBe('/vertraege/kfz');
      expect(sheet(element)).toBeNull();
      expect(auflisten).toHaveBeenCalledTimes(2);
      expect(uebersicht).toHaveBeenCalledTimes(2);
      expect(panel(element)?.querySelector('.meldung')?.textContent).toContain(
        '„Kfz-Versicherung“ wurde gespeichert.',
      );
    });

    it('aus der Liste geöffnet geht es danach zurück zur Liste', async () => {
      aendern.mockReturnValue(of(JAEHRLICH));
      const { element, stabil, sichern } = await geoeffnet('/vertraege');
      const back = vi.spyOn(TestBed.inject(Location), 'back');
      knopf(element, 'Aktionen für Kfz-Versicherung').click();
      await stabil();
      schaltflaeche(element.querySelector('[role="menu"]')!, 'Bearbeiten …').click();
      await stabil();
      await sichern();
      expect(back).toHaveBeenCalledOnce();
    });

    it('400: Sheet bleibt offen, Fehler am Feld', async () => {
      aendern.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: {
                code: 'VALIDIERUNG',
                felder: [{ feld: 'notiz', code: 'Size', parameter: { max: 1000 } }],
              },
            }),
        ),
      );
      const { element, sichern, url } = await geoeffnet();
      await sichern();
      expect(url()).toBe('/vertraege/kfz/bearbeiten');
      expect(element.textContent).toContain('Höchstens 1000 Zeichen.');
      expect(auflisten).toHaveBeenCalledOnce();
    });

    it('409: schließt, lädt neu und zeigt den Hinweis in den Details', async () => {
      aendern.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'KONFLIKT' } })),
      );
      const { element, sichern, url } = await geoeffnet();
      await sichern();
      expect(url()).toBe('/vertraege/kfz');
      expect(auflisten).toHaveBeenCalledTimes(2);
      expect(panel(element)?.querySelector('.meldung [role="alert"]')?.textContent).toContain(
        'Der Vertrag wurde inzwischen geändert. Bitte prüfen und erneut bearbeiten.',
      );
    });

    it('404: schließt zur Liste und zeigt den Hinweis oben', async () => {
      aendern.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'NICHT_GEFUNDEN' } })),
      );
      const { element, sichern, url } = await geoeffnet();
      auflisten.mockReturnValue(of([BEENDET, PFLICHT]));
      await sichern();
      expect(url()).toBe('/vertraege');
      expect(zeilen(element)).toHaveLength(2);
      expect(element.querySelector(':scope > .meldung')?.textContent).toContain(
        'Diesen Vertrag gibt es nicht mehr.',
      );
    });
  });

  describe('Löschen', () => {
    const fehlerAntwort = (status: number, code?: string) =>
      throwError(() => new HttpErrorResponse({ status, error: code ? { code } : null }));
    const dialog = (element: HTMLElement) =>
      element.querySelector<HTMLDialogElement>(':scope > app-bestaetigen-dialog dialog')!;

    async function gefragt(name = 'Kfz-Versicherung', url = '/vertraege') {
      const s = await seite(url);
      knopf(s.element, `Aktionen für ${name}`).click();
      await s.stabil();
      schaltflaeche(s.element.querySelector('[role="menu"]')!, 'Löschen …').click();
      await s.stabil();
      return s;
    }

    async function bestaetigt(name?: string, url?: string) {
      const s = await gefragt(name, url);
      schaltflaeche(dialog(s.element), 'Ja, löschen').click();
      await s.stabil();
      return s;
    }

    it('fragt im Dialog und nennt den Vertrag', async () => {
      const { element } = await gefragt();
      expect(dialog(element).open).toBe(true);
      expect(dialog(element).textContent).toContain('„Kfz-Versicherung“ löschen?');
      expect(loeschen).not.toHaveBeenCalled();
    });

    it('„Abbrechen“ löscht nicht', async () => {
      const { element, stabil } = await gefragt();
      schaltflaeche(dialog(element), 'Abbrechen').click();
      await stabil();
      expect(loeschen).not.toHaveBeenCalled();
      expect(dialog(element).open).toBe(false);
    });

    it('schickt die Version und lädt danach neu', async () => {
      loeschen.mockReturnValue(of(undefined));
      await bestaetigt();
      expect(loeschen).toHaveBeenCalledExactlyOnceWith('kfz', 0);
      expect(auflisten).toHaveBeenCalledTimes(2);
      expect(uebersicht).toHaveBeenCalledTimes(2);
    });

    it('aus den Details: fragt, löscht und schließt sie', async () => {
      loeschen.mockReturnValue(of(undefined));
      auflisten
        .mockReturnValueOnce(of([JAEHRLICH, BEENDET, PFLICHT]))
        .mockReturnValueOnce(of([BEENDET, PFLICHT]));
      const { element, stabil, url } = await seite('/vertraege/kfz');
      schaltflaeche(panel(element)!, 'Vertrag löschen').click();
      await stabil();
      expect(dialog(element).open).toBe(true);
      schaltflaeche(dialog(element), 'Ja, löschen').click();
      await stabil();
      expect(url()).toBe('/vertraege');
      expect(zeilen(element)[0].querySelector('.meldung')?.textContent).toContain(
        '„Kfz-Versicherung“ wurde gelöscht.',
      );
      expect(element.textContent).not.toContain('Diesen Vertrag gibt es nicht mehr.');
    });

    it('zeigt die Meldung über dem nächsten Vertrag', async () => {
      loeschen.mockReturnValue(of(undefined));
      auflisten
        .mockReturnValueOnce(of([JAEHRLICH, BEENDET, PFLICHT]))
        .mockReturnValueOnce(of([BEENDET, PFLICHT]));
      const { element } = await bestaetigt();
      const meldung = zeilen(element)[0].querySelector('.meldung');
      expect(meldung?.textContent).toContain('„Kfz-Versicherung“ wurde gelöscht.');
      expect(meldung?.classList.contains('unten')).toBe(false);
      expect(meldung?.classList.contains('abgesetzt')).toBe(true);
    });

    it('zeigt die Meldung beim letzten Vertrag unter dem davor', async () => {
      loeschen.mockReturnValue(of(undefined));
      auflisten
        .mockReturnValueOnce(of([JAEHRLICH, BEENDET, PFLICHT]))
        .mockReturnValueOnce(of([JAEHRLICH, BEENDET]));
      const { element } = await bestaetigt('Beitragsservice');
      const meldung = zeilen(element)[1].querySelector('.meldung');
      expect(meldung?.textContent).toContain('„Beitragsservice“ wurde gelöscht.');
      expect(meldung?.classList.contains('unten')).toBe(true);
      expect(meldung?.classList.contains('abgesetzt')).toBe(true);
    });

    it('zeigt die Meldung oben, wenn die Liste danach leer ist', async () => {
      loeschen.mockReturnValue(of(undefined));
      auflisten.mockReturnValueOnce(of([JAEHRLICH])).mockReturnValueOnce(of([]));
      const { element } = await bestaetigt();
      expect(element.querySelector(':scope > .meldung')?.textContent).toContain('wurde gelöscht.');
      expect(element.textContent).toContain('Noch keine Verträge');
    });

    it('404 gilt als gelöscht, ohne Fehlermeldung', async () => {
      loeschen.mockReturnValue(fehlerAntwort(404, 'NICHT_GEFUNDEN'));
      auflisten.mockReturnValueOnce(of([JAEHRLICH, BEENDET])).mockReturnValueOnce(of([BEENDET]));
      const { element } = await bestaetigt();
      expect(element.querySelector('.meldung')?.textContent).toContain('wurde gelöscht.');
      expect(element.querySelector('.meldung [role="alert"]')).toBeNull();
      expect(auflisten).toHaveBeenCalledTimes(2);
    });

    it('409: Hinweis an der Zeile, Vertrag bleibt, Liste neu geladen', async () => {
      loeschen.mockReturnValue(fehlerAntwort(409, 'KONFLIKT'));
      const { element } = await bestaetigt();
      expect(zeilen(element)[0].querySelector('.meldung [role="alert"]')?.textContent).toContain(
        'Der Vertrag wurde inzwischen geändert. Bitte prüfen und erneut löschen.',
      );
      expect(zeilen(element)[0].querySelector('.meldung.abgesetzt')).toBeNull();
      expect(auflisten).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['400', fehlerAntwort(400, 'ANFRAGE_UNGUELTIG')],
      ['500', fehlerAntwort(500, 'INTERNER_FEHLER')],
      ['keine Verbindung', fehlerAntwort(0)],
    ])('%s: allgemeiner Text an der Zeile, ohne Neuladen', async (_, antwort) => {
      loeschen.mockReturnValue(antwort);
      const { element } = await bestaetigt();
      expect(zeilen(element)[0].querySelector('.meldung [role="alert"]')?.textContent).toContain(
        'Der Vertrag konnte nicht gelöscht werden.',
      );
      expect(auflisten).toHaveBeenCalledOnce();
      expect(knopf(element, 'Aktionen für Kfz-Versicherung').disabled).toBe(false);
    });

    it('sperrt die Aktionen, solange die Anfrage läuft', async () => {
      loeschen.mockReturnValue(NEVER);
      const { element } = await bestaetigt();
      const mehr = knopf(element, 'Aktionen für Kfz-Versicherung');
      expect(mehr.disabled).toBe(true);
      expect(mehr.getAttribute('aria-busy')).toBe('true');
    });
  });
});
