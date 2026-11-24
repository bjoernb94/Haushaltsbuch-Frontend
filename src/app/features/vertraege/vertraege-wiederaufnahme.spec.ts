import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { provideLocationMocks } from '@angular/common/testing';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, of, throwError } from 'rxjs';
import { VertragAntwort, VertragsuebersichtAntwort } from '../../core/api/api';
import { UngespeicherteEingaben } from '../../core/ungespeichert/ungespeicherte-eingaben';
import { VERTRAEGE_ROUTES } from './vertraege.routes';
import { VertragService } from './vertrag.service';

// Wieder aufnehmen (Dialog als Kind-Route der Details) und die Anzeige von Unterbrechungen in
// Liste und Details. Alles Berechnete kommt aus den Antworten (ADR 0010).

const EUR = (wert: number) => ({ wert, waehrung: 'EUR' });

const KEINE_KUENDIGUNG = {
  art: 'BEENDET',
  dringend: false,
  fristMonate: null,
  kuendigenBis: null,
  zum: null,
} as const;

/** Ein vollständiger Vertrag; jeder Test ändert nur, worauf es ankommt. */
function vertrag(
  mehr: Partial<Omit<VertragAntwort, 'berechnet'>> & {
    berechnet?: Partial<VertragAntwort['berechnet']>;
  },
): VertragAntwort {
  const { berechnet, ...rest } = mehr;
  const beginn = rest.beginn ?? '2024-09-10';
  return {
    id: 'v',
    version: 2,
    anbieter: 'Anbieter',
    bezeichnung: null,
    kategorie: { id: 'k', schluessel: 'STREAMING_ABOS', name: null },
    vertragsnummer: null,
    betrag: EUR(13.99),
    betragErrechnet: false,
    preise: [{ gueltigAb: beginn, betrag: EUR(13.99), art: 'AKTUELL', automatisch: false }],
    anteilProzent: null,
    einmalkosten: [],
    preissteigerung: null,
    preissteigerungBetrachtetBis: null,
    preisgarantieBis: null,
    erinnerungSonderkuendigung: false,
    zahlweise: 'MONATLICH',
    zahlungsweg: null,
    kuendbar: true,
    beginn,
    laufzeitende: null,
    verlaengerung: 'ZAHLUNGSINTERVALL',
    kuendigungsfristMonate: 0,
    gekuendigtZum: null,
    notiz: null,
    unterbrechungen: [],
    ...rest,
    berechnet: {
      status: 'AKTIV',
      aktuellerBeginn: beginn,
      kostenProMonat: EUR(13.99),
      kostenImJahr: EUR(167.88),
      kostenImJahrMitPrognose: false,
      jahr: 2026,
      eigenerAnteil: null,
      einmalkosten: EUR(0),
      naechstePreisaenderung: null,
      preisverlauf: [],
      prognose: [],
      vertragsende: null,
      wiederaufnahme: null,
      kuendigung: { ...KEINE_KUENDIGUNG, art: 'MONATLICH_KUENDBAR', zum: '2026-12-09' },
      ...berechnet,
    },
  };
}

/** Beendet, lässt sich wieder aufnehmen. */
const STREAMING = vertrag({
  id: 'stream',
  anbieter: 'Streamingdienst',
  gekuendigtZum: '2026-05-31',
  berechnet: {
    status: 'BEENDET',
    vertragsende: '2026-05-31',
    kuendigung: KEINE_KUENDIGUNG,
    wiederaufnahme: { fruehestens: '2026-06-01', vorschlag: '2026-11-24' },
  },
});

/** Gekündigt zu einem künftigen Tag. */
const GEKUENDIGT = vertrag({
  id: 'gek',
  anbieter: 'Zeitung',
  gekuendigtZum: '2027-01-31',
  berechnet: {
    status: 'GEKUENDIGT',
    vertragsende: '2027-01-31',
    kuendigung: { ...KEINE_KUENDIGUNG, art: 'GEKUENDIGT', zum: '2027-01-31' },
    wiederaufnahme: { fruehestens: '2027-02-01', vorschlag: '2027-02-01' },
  },
});

/** Nicht kündbar und beendet: ohne „Laufzeit ab dann“. */
const RUNDFUNK = vertrag({
  id: 'rundfunk',
  anbieter: 'Beitragsservice',
  bezeichnung: 'Rundfunkbeitrag eigene Wohnung',
  kuendbar: false,
  verlaengerung: null,
  kuendigungsfristMonate: null,
  laufzeitende: '2026-03-31',
  gekuendigtZum: '2026-03-31',
  berechnet: {
    status: 'BEENDET',
    vertragsende: '2026-03-31',
    kuendigung: KEINE_KUENDIGUNG,
    wiederaufnahme: { fruehestens: '2026-04-01', vorschlag: '2026-11-24' },
  },
});

/** Nach einer Unterbrechung im Sommer wieder aktiv. */
const MUSIK = vertrag({
  id: 'musik',
  anbieter: 'Musikdienst',
  beginn: '2023-04-01',
  betrag: EUR(10.99),
  preise: [
    { gueltigAb: '2023-04-01', betrag: EUR(9.99), art: 'FRUEHER', automatisch: false },
    { gueltigAb: '2025-02-01', betrag: EUR(10.99), art: 'AKTUELL', automatisch: false },
  ],
  unterbrechungen: [{ id: 'u1', von: '2025-06-01', bis: '2025-08-31', art: 'KUENDIGUNG' }],
  berechnet: {
    aktuellerBeginn: '2025-09-01',
    preisverlauf: [
      { ab: '2023-04-01', betrag: EUR(9.99), art: 'GEZAHLT' },
      { ab: '2025-02-01', betrag: EUR(10.99), art: 'GEZAHLT' },
    ],
  },
});

/** Wieder aufgenommen zu einem künftigen Tag: bis dahin unterbrochen. */
const UNTERBROCHEN = vertrag({
  id: 'pause',
  anbieter: 'Fitnessstudio',
  unterbrechungen: [{ id: 'u2', von: '2026-06-01', bis: '2026-12-31', art: 'KUENDIGUNG' }],
  berechnet: {
    status: 'UNTERBROCHEN',
    aktuellerBeginn: '2027-01-01',
    kuendigung: { ...KEINE_KUENDIGUNG, art: 'WIEDER_AB', zum: '2027-01-01' },
  },
});

const UEBERSICHT: VertragsuebersichtAntwort = {
  laufendeVertraege: 1,
  kostenProMonat: [EUR(10.99)],
  kostenImJahr: [EUR(100)],
  kostenImJahrMitPrognose: false,
  einmalkostenImJahr: [],
  hatAnteile: false,
  hatNichtBegonnene: false,
  jahr: 2026,
  naechsteKuendigungsfristen: [],
};

const naechsteRunde = () => new Promise((fertig) => setTimeout(fertig));

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

const schaltflaeche = (element: ParentNode, beschriftung: string) =>
  [...element.querySelectorAll('button')].find((b) => text(b) === beschriftung);

function fehler(status: number, code: string, felder: unknown[] = []) {
  return throwError(() => new HttpErrorResponse({ status, error: { code, felder } }));
}

describe('Vertrag wieder aufnehmen', () => {
  const auflisten = vi.fn();
  const uebersicht = vi.fn();
  const wiederaufnehmen = vi.fn();

  beforeEach(async () => {
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    auflisten.mockReset();
    auflisten.mockReturnValue(of([STREAMING, GEKUENDIGT, RUNDFUNK, MUSIK, UNTERBROCHEN]));
    uebersicht.mockReset();
    uebersicht.mockReturnValue(of(UEBERSICHT));
    wiederaufnehmen.mockReset();
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
          useValue: { auflisten, uebersicht, wiederaufnehmen, vorschau: () => NEVER },
        },
      ],
    }).compileComponents();
    TestBed.inject(Router).setUpLocationChangeListener();
  });

  afterEach(() => TestBed.inject(UngespeicherteEingaben).melden(false));

  async function seite(url: string) {
    const harness = await RouterTestingHarness.create(url);
    const fixture = harness.fixture;
    const element = harness.routeNativeElement as HTMLElement;
    const stabil = async () => {
      await fixture.whenStable();
      await naechsteRunde();
      await fixture.whenStable();
    };
    await stabil();
    const dialog = () =>
      element.querySelector<HTMLDialogElement>('app-vertrag-wiederaufnehmen dialog');
    const feld = <T extends HTMLElement = HTMLInputElement>(name: string) =>
      dialog()?.querySelector<T>(`[formcontrolname="${name}"]`) ?? null;
    const setzen = async (name: string, wert: string) => {
      const control = feld(name)!;
      control.value = wert;
      control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
      await stabil();
    };
    const absenden = async () => {
      dialog()!.querySelector('form')!.dispatchEvent(new Event('submit'));
      await stabil();
    };
    const fehlerText = (name: string) => {
      const ids = feld(name)!.getAttribute('aria-describedby')?.split(' ') ?? [];
      const id = ids.find((i) => i.endsWith('-fehler'));
      return id ? text(document.getElementById(id)) : undefined;
    };
    const panel = () => element.querySelector<HTMLElement>('.panel');
    const zeile = (id: string) =>
      element.querySelector<HTMLElement>(`[data-vertrag="${id}"] .zeile`)!;
    return {
      element,
      stabil,
      dialog,
      feld,
      setzen,
      absenden,
      fehlerText,
      panel,
      zeile,
      url: () => TestBed.inject(Router).url,
    };
  }

  describe('Liste', () => {
    it('zeigt „Wieder seit“ nach einer Wiederaufnahme, sonst „Seit“', async () => {
      const { zeile } = await seite('/vertraege');
      expect(text(zeile('musik').querySelector('.kosten'))).toContain('Wieder seit 01.09.2025');
      expect(text(zeile('gek').querySelector('.kosten'))).toContain('Seit 10.09.2024');
    });

    it('unterbrochen: Zeile, Badge im Info-Ton und gedämpft wie beendete', async () => {
      const { zeile } = await seite('/vertraege');
      const z = zeile('pause');
      expect(text(z.querySelector('.kosten'))).toContain('Gekündigt, wieder ab 01.01.2027');
      expect(text(z.querySelector('.badge'))).toBe('Wieder ab 01.01.2027');
      expect(z.querySelector('.badge')!.classList).toContain('ton-info');
      expect(text(z.querySelector('.zusatz'))).toBe('Gekündigt, wird wieder aufgenommen');
      expect(z.classList).toContain('beendet');
      expect(zeile('musik').classList).not.toContain('beendet');
    });

    it('„Wieder aufnehmen …“ im Kontextmenü nur, wenn das Backend es anbietet', async () => {
      const { zeile, stabil, url, dialog } = await seite('/vertraege');
      const menue = async (id: string) => {
        zeile(id).querySelector<HTMLButtonElement>('.mehr')!.click();
        await stabil();
        return zeile(id).querySelector('[role="menu"]')!;
      };
      expect(schaltflaeche(await menue('musik'), 'Wieder aufnehmen …')).toBeUndefined();
      zeile('musik').querySelector<HTMLButtonElement>('.mehr')!.click();
      await stabil();

      schaltflaeche(await menue('stream'), 'Wieder aufnehmen …')!.click();
      await stabil();
      expect(url()).toBe('/vertraege/stream/wiederaufnehmen');
      expect(dialog()?.open).toBe(true);
    });
  });

  describe('Details', () => {
    it('Leiste „Beendet am …“ bzw. „Gekündigt zum …“ mit „Wieder aufnehmen“', async () => {
      const { panel, stabil, url } = await seite('/vertraege/stream');
      expect(text(panel()!.querySelector('app-wiederaufnahme-leiste'))).toBe(
        'Beendet am 31.05.2026. Wieder aufnehmen',
      );
      schaltflaeche(panel()!, 'Wieder aufnehmen')!.click();
      await stabil();
      expect(url()).toBe('/vertraege/stream/wiederaufnehmen');

      await TestBed.inject(Router).navigateByUrl('/vertraege/gek');
      await stabil();
      expect(text(panel()!.querySelector('app-wiederaufnahme-leiste span'))).toBe(
        'Gekündigt zum 31.01.2027.',
      );
    });

    it('ohne Angebot des Backends keine Leiste', async () => {
      const { panel } = await seite('/vertraege/musik');
      expect(panel()!.querySelector('app-wiederaufnahme-leiste')).toBeNull();
    });

    it('Kachel „Laufzeit“: „wieder seit“ nach einer Wiederaufnahme, „ab“ solange unterbrochen', async () => {
      const { panel, stabil } = await seite('/vertraege/musik');
      const laufzeit = () =>
        text(
          [...panel()!.querySelectorAll('.kachel')]
            .find((k) => text(k.querySelector('.kachel-titel')) === 'Laufzeit')!
            .querySelector('.kachel-wert'),
        );
      expect(laufzeit()).toBe('wieder seit 01.09.2025');
      await TestBed.inject(Router).navigateByUrl('/vertraege/pause');
      await stabil();
      expect(laufzeit()).toBe('ab 01.01.2027');
    });

    it('Tab Laufzeit: Unterbrechungen mit Zeitraum, Art und Info, ohne Entfernen', async () => {
      const { panel, stabil } = await seite('/vertraege/musik?tab=laufzeit');
      const abschnitt = panel()!.querySelector('app-vertrag-unterbrechungen')!;
      expect(text(abschnitt.querySelector('h3'))).toBe('Unterbrechungen');
      expect(text(abschnitt.querySelector('.zeitraum'))).toBe('01.06.2025 – 31.08.2025');
      expect(text(abschnitt.querySelector('.art'))).toBe('Gekündigt, danach wieder aufgenommen');
      expect(abschnitt.querySelector('.entfernen')).toBeNull();
      abschnitt.querySelector<HTMLButtonElement>('[aria-label="Info zu Unterbrechungen"]')!.click();
      await stabil();
      expect([...abschnitt.querySelectorAll('.blase li')].map((li) => li.textContent)).toEqual([
        'In einer Unterbrechung wird nichts abgebucht.',
        'Preise und Erhöhungen gelten nach Kalender weiter.',
      ]);
    });

    it('Status „Unterbrochen“', async () => {
      const { panel } = await seite('/vertraege/pause?tab=laufzeit');
      const status = [...panel()!.querySelectorAll('dl > div')].find(
        (d) => text(d.querySelector('dt')) === 'Status',
      );
      expect(text(status?.querySelector('dd'))).toBe('Unterbrochen');
    });

    it('Diagramm: Unterbrechung als Fläche, Legende „Unterbrochen, nichts gezahlt“', async () => {
      const { panel } = await seite('/vertraege/musik?tab=preise');
      const diagramm = panel()!.querySelector('app-vertrag-preisverlauf')!;
      expect(diagramm.querySelectorAll('.pause')).toHaveLength(1);
      expect(text(diagramm.querySelector('figcaption'))).toContain('Unterbrochen, nichts gezahlt');
    });
  });

  describe('Dialog', () => {
    it('belegt vor: Vorschlag, bisherige Verlängerung und Frist, Betrag als Platzhalter', async () => {
      const { dialog, feld } = await seite('/vertraege/stream/wiederaufnehmen');
      expect(dialog()?.open).toBe(true);
      expect(text(dialog()!.querySelector('h2'))).toBe('„Streamingdienst“ wieder aufnehmen');
      expect(text(dialog()!.querySelector('#wieder-text'))).toBe(
        'Beendet am 31.05.2026. Bis zur Wiederaufnahme gilt er als unterbrochen, ohne Abbuchungen.',
      );
      expect(feld('datum')!.value).toBe('2026-11-24');
      expect(text(dialog()!.querySelector('#wieder-datum-hinweis'))).toBe(
        'Frühestens am 01.06.2026.',
      );
      expect(feld<HTMLSelectElement>('verlaengerung')!.value).toBe('ZAHLUNGSINTERVALL');
      expect(feld<HTMLSelectElement>('kuendigungsfristMonate')!.value).toBe('0');
      expect(feld('laufzeitende')!.value).toBe('');
      expect(feld('betrag')!.value).toBe('');
      expect(feld('betrag')!.placeholder).toBe('13,99');
      expect(text(dialog()!.querySelector('label[for="wieder-betrag"]'))).toBe(
        'Neuer Betrag in € (optional)',
      );
      expect(document.activeElement).toBe(feld('datum'));
      expect(TestBed.inject(UngespeicherteEingaben).vorhanden()).toBe(false);
    });

    it('ohne Verlängerung („KEINE“) bleibt sie leer', async () => {
      auflisten.mockReturnValue(
        of([{ ...STREAMING, verlaengerung: 'KEINE', laufzeitende: '2026-05-31' }]),
      );
      const { feld } = await seite('/vertraege/stream/wiederaufnehmen');
      expect(feld<HTMLSelectElement>('verlaengerung')!.value).toBe('');
    });

    it('nicht kündbar: ohne „Laufzeit ab dann“, schickt keine Laufzeit', async () => {
      wiederaufnehmen.mockReturnValue(of(RUNDFUNK));
      const { dialog, absenden } = await seite('/vertraege/rundfunk/wiederaufnehmen');
      const legenden = [...dialog()!.querySelectorAll('legend')].map(text);
      expect(legenden).toEqual(['Preis']);
      await absenden();
      expect(wiederaufnehmen).toHaveBeenCalledWith('rundfunk', {
        version: 2,
        datum: '2026-11-24',
        laufzeitende: null,
        verlaengerung: null,
        kuendigungsfristMonate: null,
        betrag: null,
      });
    });

    it('Pflichtfelder: Fehler am Feld, Fokus aufs erste, keine Anfrage', async () => {
      const { setzen, absenden, fehlerText, feld } = await seite(
        '/vertraege/stream/wiederaufnehmen',
      );
      await setzen('datum', '');
      await setzen('verlaengerung', '');
      await setzen('betrag', '12.99');
      await absenden();
      expect(wiederaufnehmen).not.toHaveBeenCalled();
      expect(fehlerText('datum')).toBe('Bitte gib das Datum der Wiederaufnahme ein.');
      expect(fehlerText('verlaengerung')).toBe('Bitte wähle, wie sich der Vertrag verlängert.');
      expect(fehlerText('betrag')).toBe('Bitte gib einen gültigen Betrag ein, z. B. 13,99.');
      expect(document.activeElement).toBe(feld('datum'));

      await setzen('datum', '2026-12-01');
      expect(fehlerText('datum')).toBeUndefined();
      expect(fehlerText('verlaengerung')).toBeDefined();
    });

    it('200: schickt die Werte, schließt, lädt neu und meldet in den Details', async () => {
      wiederaufnehmen.mockReturnValue(of(STREAMING));
      const { setzen, absenden, url, dialog, panel } = await seite(
        '/vertraege/stream/wiederaufnehmen',
      );
      await setzen('laufzeitende', '2027-11-30');
      await setzen('kuendigungsfristMonate', '1');
      await setzen('betrag', '15,99');
      expect(TestBed.inject(UngespeicherteEingaben).vorhanden()).toBe(true);
      await absenden();

      expect(wiederaufnehmen).toHaveBeenCalledWith('stream', {
        version: 2,
        datum: '2026-11-24',
        laufzeitende: '2027-11-30',
        verlaengerung: 'ZAHLUNGSINTERVALL',
        kuendigungsfristMonate: 1,
        betrag: EUR(15.99),
      });
      expect(TestBed.inject(UngespeicherteEingaben).vorhanden()).toBe(false);
      expect(url()).toBe('/vertraege/stream');
      expect(dialog()).toBeNull();
      expect(auflisten).toHaveBeenCalledTimes(2);
      expect(text(panel()!.querySelector('.meldung'))).toBe(
        '„Streamingdienst“ wird ab 24.11.2026 wieder aufgenommen.',
      );
    });

    it('400: Fehler nach Regel am Feld, Fokus aufs erste', async () => {
      wiederaufnehmen.mockReturnValue(
        fehler(400, 'VALIDIERUNG', [
          { feld: 'datum', code: 'NachVertragsende', parameter: { vertragsende: '2026-05-31' } },
          { feld: 'verlaengerung', code: 'LaufzeitendeBeiEnde', parameter: {} },
          { feld: 'betrag', code: 'GueltigAbEindeutig', parameter: {} },
        ]),
      );
      const { absenden, fehlerText, feld, url } = await seite('/vertraege/stream/wiederaufnehmen');
      await absenden();
      expect(url()).toBe('/vertraege/stream/wiederaufnehmen');
      expect(fehlerText('datum')).toBe('Das Datum muss nach dem Vertragsende (31.05.2026) liegen.');
      expect(fehlerText('verlaengerung')).toBe(
        'Ohne Laufzeitende kann der Vertrag nicht zum Laufzeitende enden.',
      );
      expect(fehlerText('betrag')).toBe(
        'Für dieses Datum gibt es schon einen Preis. Trag die Änderung im Tab Preisverlauf ein.',
      );
      expect(document.activeElement).toBe(feld('datum'));
    });

    it('500: Hinweis im Dialog, er bleibt offen', async () => {
      wiederaufnehmen.mockReturnValue(fehler(500, 'INTERN'));
      const { absenden, dialog, url } = await seite('/vertraege/stream/wiederaufnehmen');
      await absenden();
      expect(url()).toBe('/vertraege/stream/wiederaufnehmen');
      expect(text(dialog()!.querySelector('.hinweis'))).toBe(
        'Der Vertrag konnte nicht wieder aufgenommen werden. Bitte versuche es später erneut.',
      );
    });

    it('409 KONFLIKT: schließt, lädt neu, Hinweis wie beim Bearbeiten', async () => {
      wiederaufnehmen.mockReturnValue(fehler(409, 'KONFLIKT'));
      const { absenden, url, panel } = await seite('/vertraege/stream/wiederaufnehmen');
      await absenden();
      expect(url()).toBe('/vertraege/stream');
      expect(auflisten).toHaveBeenCalledTimes(2);
      expect(text(panel()!.querySelector('.meldung'))).toBe(
        'Der Vertrag wurde inzwischen geändert. Bitte prüfen und erneut bearbeiten.',
      );
    });

    it('409 WIEDERAUFNAHME_NICHT_MOEGLICH: schließt, lädt neu, Hinweis', async () => {
      wiederaufnehmen.mockReturnValue(fehler(409, 'WIEDERAUFNAHME_NICHT_MOEGLICH'));
      const { absenden, url, panel } = await seite('/vertraege/stream/wiederaufnehmen');
      await absenden();
      expect(url()).toBe('/vertraege/stream');
      expect(auflisten).toHaveBeenCalledTimes(2);
      expect(text(panel()!.querySelector('.meldung'))).toBe(
        'Der Vertrag kann nicht mehr wieder aufgenommen werden.',
      );
    });

    it('ein Link auf einen laufenden Vertrag schließt mit demselben Hinweis', async () => {
      const { url, panel } = await seite('/vertraege/musik/wiederaufnehmen');
      expect(url()).toBe('/vertraege/musik');
      expect(text(panel()!.querySelector('.meldung'))).toBe(
        'Der Vertrag kann nicht mehr wieder aufgenommen werden.',
      );
    });

    it('Esc und ein Klick daneben schließen über die Route', async () => {
      const { dialog, stabil, url } = await seite('/vertraege/stream/wiederaufnehmen');
      const esc = new Event('cancel', { cancelable: true });
      dialog()!.dispatchEvent(esc);
      expect(esc.defaultPrevented).toBe(true);
      await stabil();
      expect(url()).toBe('/vertraege/stream');

      await TestBed.inject(Router).navigateByUrl('/vertraege/stream/wiederaufnehmen');
      await stabil();
      dialog()!.click();
      await stabil();
      expect(url()).toBe('/vertraege/stream');
    });

    it('mit Eingaben fragt Esc nach, „Weiter bearbeiten“ behält sie', async () => {
      const { dialog, setzen, stabil, url, feld } = await seite(
        '/vertraege/stream/wiederaufnehmen',
      );
      const fragen = TestBed.inject(UngespeicherteEingaben);
      await setzen('betrag', '15,99');
      dialog()!.dispatchEvent(new Event('cancel', { cancelable: true }));
      await naechsteRunde();
      expect(fragen.frageOffen()).toBe(true);
      fragen.antworten(false);
      await stabil();
      expect(url()).toBe('/vertraege/stream/wiederaufnehmen');
      expect(feld('betrag')!.value).toBe('15,99');
    });

    it('mit Eingaben fragt die Zurück-Taste nach, „Verwerfen“ schließt', async () => {
      const { setzen, stabil, url } = await seite('/vertraege/stream');
      await TestBed.inject(Router).navigateByUrl('/vertraege/stream/wiederaufnehmen');
      await stabil();
      const fragen = TestBed.inject(UngespeicherteEingaben);
      await setzen('betrag', '15,99');
      TestBed.inject(Location).back();
      await naechsteRunde();
      expect(fragen.frageOffen()).toBe(true);
      fragen.antworten(true);
      await stabil();
      expect(url()).toBe('/vertraege/stream');
    });

    it('„Sichern“ in der Leiste gehört zum Formular', async () => {
      const { dialog } = await seite('/vertraege/stream/wiederaufnehmen');
      expect(schaltflaeche(dialog()!, 'Sichern')!.getAttribute('form')).toBe(
        dialog()!.querySelector('form')!.id,
      );
    });
  });
});
