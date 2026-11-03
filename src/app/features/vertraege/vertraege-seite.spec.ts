import { HttpErrorResponse } from '@angular/common/http';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, Subject, throwError } from 'rxjs';
import { VertragAntwort, VertragsuebersichtAntwort } from '../../core/api/api';
import { UngespeicherteEingaben } from '../../core/ungespeichert/ungespeicherte-eingaben';
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
      imports: [VertraegeSeite],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'de-DE' },
        {
          provide: VertragService,
          useValue: { auflisten, uebersicht, aendern, kategorien, loeschen, vorschau: () => NEVER },
        },
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
    expect(text(zeile.querySelector('.zusatz'))).toBe('Vertrag endet zum 31.12.2026');
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
    const knoepfe = element.querySelectorAll<HTMLButtonElement>('button[aria-label^="Details zu"]');
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
    element.querySelector<HTMLButtonElement>('button[aria-label^="Details zu"]')!.click();
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
      Kündigung: 'Kündbar bis 30.11.2026. Vertrag endet zum 31.12.2026',
      Status: 'Aktiv',
      Notiz: 'Wichtig',
    });
  });

  it('nennt fehlende Angaben und lässt Felder weg, die nicht passen', async () => {
    const { fixture, element } = await seite();
    element.querySelectorAll<HTMLButtonElement>('button[aria-label^="Details zu"]')[1].click();
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

    element.querySelectorAll<HTMLButtonElement>('button[aria-label^="Details zu"]')[2].click();
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

  describe('Bearbeiten', () => {
    const knopf = (element: HTMLElement, name: string) =>
      element.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
    const zeile = (element: HTMLElement, i: number) =>
      element.querySelectorAll('app-vertrag-zeile')[i] as HTMLElement;
    const NAME = 'Kfz-Versicherung';

    async function geoeffnet() {
      const { fixture, element } = await seite();
      knopf(element, `${NAME} bearbeiten`).click();
      await fixture.whenStable();
      const eingeben = async (wert: string) => {
        const notiz = element.querySelector<HTMLTextAreaElement>('[formcontrolname="notiz"]')!;
        notiz.value = wert;
        notiz.dispatchEvent(new Event('input'));
        await fixture.whenStable();
      };
      const absenden = async () => {
        element.querySelector('form')!.dispatchEvent(new Event('submit'));
        await fixture.whenStable();
      };
      return { fixture, element, eingeben, absenden };
    }

    it('lädt die Kategorien erst beim ersten Bearbeiten und nur einmal', async () => {
      const { fixture, element } = await seite();
      expect(kategorien).not.toHaveBeenCalled();

      knopf(element, `${NAME} bearbeiten`).click();
      await fixture.whenStable();
      knopf(element, `${NAME} bearbeiten`).click();
      await fixture.whenStable();
      knopf(element, `${NAME} bearbeiten`).click();
      await fixture.whenStable();
      expect(element.querySelector('form')).not.toBeNull();
      expect(kategorien).toHaveBeenCalledOnce();
    });

    it('lädt nach einem Fehler beim nächsten Versuch neu', async () => {
      kategorien.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
      const { fixture, element } = await seite();
      knopf(element, `${NAME} bearbeiten`).click();
      await fixture.whenStable();
      expect(element.textContent).toContain('Die Kategorien konnten nicht geladen werden.');
      expect(element.querySelector('form')).toBeNull();

      element.querySelector<HTMLButtonElement>('app-vertrag-bearbeiten .fehler button')!.click();
      await fixture.whenStable();
      expect(element.querySelector('form')).not.toBeNull();
    });

    it('zeigt höchstens ein Formular und schließt die Details', async () => {
      const { fixture, element } = await seite();
      knopf(element, `Details zu ${NAME} anzeigen`).click();
      await fixture.whenStable();
      knopf(element, `${NAME} bearbeiten`).click();
      await fixture.whenStable();
      expect(element.querySelector('.details')).toBeNull();
      expect(knopf(element, `${NAME} bearbeiten`).getAttribute('aria-expanded')).toBe('true');

      knopf(element, 'Beitragsservice bearbeiten').click();
      await fixture.whenStable();
      expect(element.querySelectorAll('form')).toHaveLength(1);
      expect(knopf(element, `${NAME} bearbeiten`).getAttribute('aria-expanded')).toBe('false');
    });

    it('fragt bei geänderten Eingaben nach und behält sie bei „Weiter bearbeiten“', async () => {
      const { fixture, element, eingeben } = await geoeffnet();
      const fragen = TestBed.inject(UngespeicherteEingaben);
      await eingeben('Neu');

      knopf(element, 'Beitragsservice bearbeiten').click();
      await fixture.whenStable();
      expect(fragen.frageOffen()).toBe(true);
      expect(knopf(element, `${NAME} bearbeiten`).getAttribute('aria-expanded')).toBe('true');

      fragen.antworten(false);
      await fixture.whenStable();
      expect(knopf(element, `${NAME} bearbeiten`).getAttribute('aria-expanded')).toBe('true');
      expect(element.querySelector<HTMLTextAreaElement>('[formcontrolname="notiz"]')!.value).toBe(
        'Neu',
      );
    });

    it('führt nach „Verwerfen“ die Aktion aus', async () => {
      const { fixture, element, eingeben } = await geoeffnet();
      const fragen = TestBed.inject(UngespeicherteEingaben);
      await eingeben('Neu');

      knopf(element, 'Beitragsservice bearbeiten').click();
      await fixture.whenStable();
      fragen.antworten(true);
      await naechsteRunde();
      await fixture.whenStable();
      expect(knopf(element, 'Beitragsservice bearbeiten').getAttribute('aria-expanded')).toBe(
        'true',
      );
      expect(element.querySelector<HTMLTextAreaElement>('[formcontrolname="notiz"]')!.value).toBe(
        '',
      );
      expect(fragen.vorhanden()).toBe(false);
    });

    it('fragt nicht nach, wenn die Eingabe wieder dem Stand entspricht', async () => {
      const { fixture, element, eingeben } = await geoeffnet();
      await eingeben('Neu');
      await eingeben('Wichtig');
      knopf(element, 'Beitragsservice bearbeiten').click();
      await fixture.whenStable();
      expect(TestBed.inject(UngespeicherteEingaben).frageOffen()).toBe(false);
    });

    it('„Abbrechen“ fragt bei Änderungen nach und schließt erst danach', async () => {
      const { fixture, element, eingeben } = await geoeffnet();
      const fragen = TestBed.inject(UngespeicherteEingaben);
      await eingeben('Neu');
      [...element.querySelectorAll('button')]
        .find((b) => b.textContent?.trim() === 'Abbrechen')!
        .click();
      await fixture.whenStable();
      expect(fragen.frageOffen()).toBe(true);
      expect(element.querySelector('form')).not.toBeNull();

      fragen.antworten(true);
      await naechsteRunde();
      await fixture.whenStable();
      expect(element.querySelector('form')).toBeNull();
    });

    it('„Abbrechen“ schließt ohne Änderung sofort', async () => {
      const { fixture, element } = await geoeffnet();
      [...element.querySelectorAll('button')]
        .find((b) => b.textContent?.trim() === 'Abbrechen')!
        .click();
      await fixture.whenStable();
      expect(element.querySelector('form')).toBeNull();
      expect(TestBed.inject(UngespeicherteEingaben).frageOffen()).toBe(false);
    });

    it('meldet nach dem Speichern keine ungespeicherten Eingaben mehr', async () => {
      aendern.mockReturnValue(of(JAEHRLICH));
      const { fixture, eingeben, absenden } = await geoeffnet();
      await eingeben('Neu');
      expect(TestBed.inject(UngespeicherteEingaben).vorhanden()).toBe(true);
      await absenden();
      await fixture.whenStable();
      expect(TestBed.inject(UngespeicherteEingaben).vorhanden()).toBe(false);
    });

    it('200: schließt, lädt neu und zeigt die Meldung an der Zeile', async () => {
      aendern.mockReturnValue(of(JAEHRLICH));
      const { fixture, element, absenden } = await geoeffnet();
      expect(auflisten).toHaveBeenCalledOnce();
      await absenden();
      await fixture.whenStable();

      expect(aendern).toHaveBeenCalledWith(
        'kfz',
        expect.objectContaining({ version: 0, abbuchungAb: '2025-01-01', kategorieId: 'k' }),
      );
      expect(element.querySelector('form')).toBeNull();
      expect(auflisten).toHaveBeenCalledTimes(2);
      expect(uebersicht).toHaveBeenCalledTimes(2);
      const meldung = zeile(element, 0).querySelector('.meldung');
      expect(meldung?.textContent).toContain('„Kfz-Versicherung“ wurde gespeichert.');
      expect(element.querySelector(':scope > .meldung')).toBeNull();
    });

    it('400: Formular bleibt offen, Fehler am Feld, keine Meldung an der Zeile', async () => {
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
      const { element, absenden } = await geoeffnet();
      await absenden();
      expect(element.querySelector('form')).not.toBeNull();
      expect(element.textContent).toContain('Höchstens 1000 Zeichen.');
      expect(auflisten).toHaveBeenCalledOnce();
    });

    it('409: schließt, lädt neu und zeigt den Hinweis an der Zeile', async () => {
      aendern.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'KONFLIKT' } })),
      );
      const { fixture, element, absenden } = await geoeffnet();
      await absenden();
      await fixture.whenStable();
      expect(element.querySelector('form')).toBeNull();
      expect(auflisten).toHaveBeenCalledTimes(2);
      expect(zeile(element, 0).querySelector('.meldung [role="alert"]')?.textContent).toContain(
        'Der Vertrag wurde inzwischen geändert. Bitte prüfen und erneut bearbeiten.',
      );
    });

    it('404: lädt neu und zeigt den Hinweis oben, weil die Zeile fort ist', async () => {
      aendern.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'NICHT_GEFUNDEN' } })),
      );
      const { fixture, element, absenden } = await geoeffnet();
      auflisten.mockReturnValue(of([BEENDET, PFLICHT]));
      await absenden();
      await fixture.whenStable();
      expect(element.querySelectorAll('app-vertrag-zeile')).toHaveLength(2);
      expect(element.querySelector('app-vertrag-zeile .meldung')).toBeNull();
      expect(element.querySelector('.meldung')?.textContent).toContain(
        'Diesen Vertrag gibt es nicht mehr.',
      );
    });

    it('zeigt die Meldung oben, wenn das Neuladen danach scheitert', async () => {
      aendern.mockReturnValue(of(JAEHRLICH));
      const { fixture, element, absenden } = await geoeffnet();
      auflisten.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      await absenden();
      await fixture.whenStable();
      expect(element.querySelector('.meldung')?.textContent).toContain('wurde gespeichert.');
      expect(element.textContent).toContain('Die Verträge konnten nicht geladen werden.');
    });

    it('ein älterer Ladevorgang überschreibt keinen neueren', async () => {
      const langsam = new Subject<VertragAntwort[]>();
      auflisten.mockReturnValueOnce(of([JAEHRLICH])).mockReturnValueOnce(langsam);
      aendern.mockReturnValue(of(JAEHRLICH));
      const { fixture, element, absenden } = await geoeffnet();
      await absenden();
      auflisten.mockReturnValue(of([BEENDET]));
      fixture.componentInstance['laden']();
      await fixture.whenStable();
      langsam.next([JAEHRLICH, PFLICHT]);
      langsam.complete();
      await fixture.whenStable();
      expect(element.querySelectorAll('app-vertrag-zeile')).toHaveLength(1);
    });
  });

  describe('Löschen', () => {
    const fehlerAntwort = (status: number, code?: string) =>
      throwError(() => new HttpErrorResponse({ status, error: code ? { code } : null }));
    const zeilen = (element: HTMLElement) =>
      element.querySelectorAll<HTMLElement>('app-vertrag-zeile');
    const schaltflaeche = (element: HTMLElement, text: string) =>
      [...element.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;

    async function gefragt(name = 'Kfz-Versicherung') {
      const { fixture, element } = await seite();
      element.querySelector<HTMLButtonElement>(`button[aria-label="${name} löschen"]`)!.click();
      await fixture.whenStable();
      return { fixture, element };
    }

    async function bestaetigt(name?: string) {
      const { fixture, element } = await gefragt(name);
      schaltflaeche(element, 'Ja, löschen').click();
      await fixture.whenStable();
      return { fixture, element };
    }

    it('fragt im Dialog und nennt den Vertrag', async () => {
      const { element } = await gefragt();
      const dialog = element.querySelector<HTMLDialogElement>(
        ':scope > app-bestaetigen-dialog dialog',
      )!;
      expect(dialog.open).toBe(true);
      expect(dialog.textContent).toContain('„Kfz-Versicherung“ löschen?');
      expect(loeschen).not.toHaveBeenCalled();
    });

    it('„Abbrechen“ löscht nicht', async () => {
      const { fixture, element } = await gefragt();
      schaltflaeche(element, 'Abbrechen').click();
      await fixture.whenStable();
      expect(loeschen).not.toHaveBeenCalled();
      expect(element.querySelector<HTMLDialogElement>('dialog')!.open).toBe(false);
    });

    it('schickt die Version und lädt danach neu', async () => {
      loeschen.mockReturnValue(of(undefined));
      await bestaetigt();
      expect(loeschen).toHaveBeenCalledExactlyOnceWith('kfz', 0);
      expect(auflisten).toHaveBeenCalledTimes(2);
      expect(uebersicht).toHaveBeenCalledTimes(2);
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
      expect(
        element.querySelector<HTMLButtonElement>('button[aria-label="Kfz-Versicherung löschen"]')!
          .disabled,
      ).toBe(false);
    });

    it('sperrt den Knopf, solange die Anfrage läuft', async () => {
      loeschen.mockReturnValue(NEVER);
      const { element } = await bestaetigt();
      const knopf = element.querySelector<HTMLButtonElement>(
        'button[aria-label="Kfz-Versicherung löschen"]',
      )!;
      expect(knopf.disabled).toBe(true);
      expect(knopf.getAttribute('aria-busy')).toBe('true');
    });
  });
});
