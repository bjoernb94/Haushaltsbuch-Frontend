import { HttpErrorResponse } from '@angular/common/http';
import { Component, LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, ReplaySubject, Subject } from 'rxjs';
import {
  Kuendigung,
  VertragAntwort,
  VertragKategorieAntwort,
  VertragVorschauAnfrage,
  VertragVorschauAntwort,
} from '../../../core/api/api';
import { UngespeicherteEingaben } from '../../../core/ungespeichert/ungespeicherte-eingaben';
import { INFO_RUNDUNG, INFO_RUNDUNG_PROGNOSE } from '../vertrag-texte';
import { VertragEingabe, VertragService } from '../vertrag.service';
import { VertragFormular } from './vertrag-formular';

const KEINE: Kuendigung = {
  art: 'KEINE_LAUFZEIT',
  dringend: false,
  fristMonate: null,
  kuendigenBis: null,
  zum: null,
};

const KATEGORIEN: VertragKategorieAntwort[] = [
  { id: 'k1', schluessel: 'VERSICHERUNG', name: null },
  { id: 'k2', schluessel: null, name: 'Eigene Kategorie' },
];

/** Vorschau, in der nur die Kündigung und ggf. die Preise zählen. */
function vorschauPreis(
  gueltigAb: string,
  wert: number,
  art: VertragVorschauAntwort['preise'][number]['art'],
  mehr: { automatisch?: boolean; neu?: boolean } = {},
): VertragVorschauAntwort['preise'][number] {
  return {
    gueltigAb,
    betrag: { wert, waehrung: 'EUR' },
    art,
    automatisch: false,
    neu: false,
    ...mehr,
  };
}

function vorschauAntwort(
  kuendigung: Kuendigung,
  mehr: Partial<VertragVorschauAntwort> = {},
): VertragVorschauAntwort {
  return {
    betrag: null,
    eigenerAnteil: null,
    einmalkosten: null,
    kostenProMonat: null,
    naechstePreisaenderung: null,
    preise: [],
    prognose: [],
    kuendigung,
    vorschlagNaechsteAm: null,
    ...mehr,
  };
}

/** Öffnet den Info-Knopf, liest die Sätze der Blase und schließt ihn wieder; ohne Knopf null. */
function info(el: HTMLElement, beschriftung: string): (string | null)[] | null {
  TestBed.tick();
  const knopf = el.querySelector<HTMLButtonElement>(`button[aria-label="Info zu ${beschriftung}"]`);
  if (!knopf) {
    return null;
  }
  knopf.click();
  TestBed.tick();
  const saetze = [...el.querySelectorAll('.blase li')].map((li) => li.textContent);
  knopf.click();
  TestBed.tick();
  return saetze;
}

function validierung(...felder: [string, string][]): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 400,
    error: {
      code: 'VALIDIERUNG',
      felder: felder.map(([feld, code]) => ({ feld, code, parameter: {} })),
    },
  });
}

@Component({
  imports: [VertragFormular],
  template: `
    <app-vertrag-formular
      [kategorien]="kategorien"
      [sendet]="sendet()"
      [fehlerAntwort]="fehler()"
      (speichern)="gespeichert.push($event)"
      (abbrechen)="abgebrochen = abgebrochen + 1"
    />
    @if (zweites()) {
      <app-vertrag-formular [kategorien]="kategorien" />
    }
  `,
})
class Host {
  readonly kategorien = KATEGORIEN;
  readonly sendet = signal(false);
  readonly fehler = signal<unknown>(null);
  readonly zweites = signal(false);
  readonly gespeichert: Required<VertragEingabe>[] = [];
  abgebrochen = 0;
}

async function erstellen() {
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;

  const feld = <T extends HTMLElement = HTMLInputElement>(name: string) =>
    el.querySelector<T>(`[formcontrolname="${name}"]`)!;
  const setzen = (name: string, wert: string) => {
    const control = feld<HTMLInputElement>(name);
    control.value = wert;
    control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
  };
  const ankreuzen = async (name: string) => {
    feld(name).click();
    await fixture.whenStable();
  };
  const pflichtfelderFuellen = () => {
    setzen('anbieter', 'Anbieter');
    setzen('kategorieId', 'k1');
    setzen('betrag', '19,99');
    setzen('zahlweise', 'MONATLICH');
    setzen('beginn', '2026-01-01');
  };
  const absenden = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  const fehlerText = (name: string) => {
    const ids = feld(name).getAttribute('aria-describedby')?.split(' ') ?? [];
    const fehlerId = ids.find((id) => id.endsWith('-fehler'));
    return fehlerId ? document.getElementById(fehlerId)?.textContent : undefined;
  };
  const box = () => el.querySelector('app-hinweis-box [role="alert"]')?.textContent?.trim();
  return {
    fixture,
    el,
    host: fixture.componentInstance,
    feld,
    setzen,
    ankreuzen,
    absenden,
    pflichtfelderFuellen,
    fehlerText,
    box,
  };
}

describe('VertragFormular', () => {
  const vorschau = vi.fn<(a: VertragVorschauAnfrage) => unknown>();

  beforeEach(() => {
    vorschau.mockReset();
    vorschau.mockReturnValue(NEVER);
    TestBed.configureTestingModule({
      providers: [{ provide: VertragService, useValue: { vorschau } }],
    });
  });
  afterEach(() => document.body.replaceChildren());

  describe('Vorschau des Kündigungstermins', () => {
    const ERGEBNIS: Kuendigung = {
      art: 'KUENDIGEN_BIS',
      dringend: false,
      fristMonate: 1,
      kuendigenBis: '2026-11-30',
      zum: '2026-12-31',
    };
    const OHNE_EINGABEN = {
      kuendbar: true,
      preise: [],
      anteilProzent: null,
      einmalkosten: [],
      preissteigerung: null,
      preisgarantieBis: null,
      zahlweise: null,
      beginn: null,
      laufzeitende: null,
      verlaengerung: null,
      kuendigungsfristMonate: null,
      gekuendigtZum: null,
      preissteigerungBetrachtetBis: null,
      unterbrechungen: [],
    };
    const fehler400 = () => validierung(['laufzeitende', 'LaufzeitendeNachBeginn']);

    /** Antworten kommen von Hand, in jeder Reihenfolge. */
    let anfragen: Subject<VertragVorschauAntwort>[];

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      anfragen = [];
      vorschau.mockImplementation(() => {
        const antwort = new Subject<VertragVorschauAntwort>();
        anfragen.push(antwort);
        return antwort;
      });
    });
    afterEach(() => vi.useRealTimers());

    async function offen() {
      const hilfen = await erstellen();
      vi.advanceTimersByTime(0);
      const antworten = (i: number, kuendigung: Kuendigung) => {
        anfragen[i].next(vorschauAntwort(kuendigung));
        anfragen[i].complete();
      };
      const zeile = () => {
        TestBed.tick();
        return hilfen.el
          .querySelector('app-vertrag-tab-laufzeit .vorschau')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim();
      };
      return { ...hilfen, antworten, zeile };
    }

    it('fragt beim Öffnen sofort mit allen Werten', async () => {
      const { zeile, antworten, el } = await offen();
      expect(vorschau).toHaveBeenCalledExactlyOnceWith(OHNE_EINGABEN);
      expect(zeile()).toBe('Nächster Kündigungstermin:–');
      antworten(0, { ...ERGEBNIS, art: 'KEINE_LAUFZEIT' });
      expect(zeile()).toBe('Nächster Kündigungstermin:Kein Termin bekannt');
      expect(el.querySelector('app-vertrag-tab-laufzeit .vorschau')?.getAttribute('role')).toBe(
        'status',
      );
    });

    it('zeigt das Ergebnis mit den Texten der Liste', async () => {
      const { zeile, antworten } = await offen();
      antworten(0, ERGEBNIS);
      expect(zeile()).toBe(
        'Nächster Kündigungstermin:Kündbar bis 30.11.2026. Vertrag endet zum 31.12.2026',
      );
    });

    it('fragt erst nach der Pause, nicht je Tastendruck', async () => {
      const { setzen } = await offen();
      vorschau.mockClear();
      setzen('laufzeitende', '2027-01-01');
      vi.advanceTimersByTime(399);
      setzen('laufzeitende', '2027-02-01');
      vi.advanceTimersByTime(399);
      expect(vorschau).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(vorschau).toHaveBeenCalledExactlyOnceWith({
        ...OHNE_EINGABEN,
        laufzeitende: '2027-02-01',
      });
    });

    it('fragt nicht neu, wenn sich nur andere Felder ändern', async () => {
      const { setzen } = await offen();
      vorschau.mockClear();
      setzen('anbieter', 'Anbieter');
      setzen('notiz', 'Notiz');
      vi.advanceTimersByTime(1000);
      expect(vorschau).not.toHaveBeenCalled();
    });

    it('schickt den Betrag als ersten Preis ab Vertragsbeginn mit', async () => {
      const { setzen } = await offen();
      setzen('betrag', '19,99');
      vi.advanceTimersByTime(400);
      expect(vorschau).toHaveBeenLastCalledWith({
        ...OHNE_EINGABEN,
        preise: [{ gueltigAb: null, betrag: { wert: 19.99, waehrung: 'EUR' } }],
      });
      setzen('beginn', '2026-02-01');
      vi.advanceTimersByTime(400);
      expect(vorschau).toHaveBeenLastCalledWith({
        ...OHNE_EINGABEN,
        beginn: '2026-02-01',
        preise: [{ gueltigAb: '2026-02-01', betrag: { wert: 19.99, waehrung: 'EUR' } }],
      });
    });

    it('ein veraltetes Ergebnis überschreibt kein neueres, die alte Anfrage wird abgebrochen', async () => {
      const { setzen, zeile, antworten } = await offen();
      antworten(0, ERGEBNIS);
      setzen('laufzeitende', '2027-01-01');
      vi.advanceTimersByTime(400);
      const alte = anfragen[1];
      setzen('laufzeitende', '2027-02-01');
      expect(alte.observed).toBe(false);
      alte.next(vorschauAntwort({ ...ERGEBNIS, kuendigenBis: '2000-01-01' }));
      expect(zeile()).toContain('Kündbar bis 30.11.2026');
      vi.advanceTimersByTime(400);
      antworten(2, { ...ERGEBNIS, kuendigenBis: '2027-01-15' });
      expect(zeile()).toContain('Kündbar bis 15.01.2027');
    });

    it('400 und andere Fehler zeigen „–“ ohne Fehlerbox, danach geht es weiter', async () => {
      const { setzen, zeile, antworten, box } = await offen();
      antworten(0, ERGEBNIS);
      setzen('laufzeitende', '2020-01-01');
      vi.advanceTimersByTime(400);
      anfragen[1].error(fehler400());
      expect(zeile()).toBe('Nächster Kündigungstermin:–');
      expect(box()).toBeUndefined();

      setzen('laufzeitende', '2021-01-01');
      vi.advanceTimersByTime(400);
      anfragen[2].error(new HttpErrorResponse({ status: 500 }));
      expect(zeile()).toBe('Nächster Kündigungstermin:–');
      expect(box()).toBeUndefined();

      setzen('laufzeitende', '2027-01-01');
      vi.advanceTimersByTime(400);
      antworten(3, ERGEBNIS);
      expect(zeile()).toContain('Kündbar bis 30.11.2026');
    });

    it('nach einem Fehler bleibt Speichern möglich', async () => {
      const { host, setzen, pflichtfelderFuellen, absenden } = await offen();
      setzen('laufzeitende', '2020-01-01');
      vi.advanceTimersByTime(400);
      anfragen[1].error(fehler400());
      pflichtfelderFuellen();
      await absenden();
      expect(host.gespeichert).toHaveLength(1);
    });

    it('„Nicht kündbar“ blendet die Zeile aus und fragt ohne Kündigung weiter', async () => {
      const { feld, zeile, antworten } = await offen();
      antworten(0, ERGEBNIS);
      vorschau.mockClear();
      feld('nichtKuendbar').click();
      expect(zeile()).toBeUndefined();
      vi.advanceTimersByTime(400);
      expect(vorschau).toHaveBeenCalledExactlyOnceWith({ ...OHNE_EINGABEN, kuendbar: false });

      feld('nichtKuendbar').click();
      expect(zeile()).toContain('Kündbar bis 30.11.2026');
      vi.advanceTimersByTime(400);
      expect(vorschau).toHaveBeenCalledTimes(2);
    });

    it('zeigt „Dein Anteil“ mit den Beträgen der Vorschau, ohne Anteil keine Zeile', async () => {
      TestBed.overrideProvider(LOCALE_ID, { useValue: 'de-DE' });
      const { el, setzen } = await offen();
      const EUR = (wert: number) => ({ wert, waehrung: 'EUR' });
      const status = () => {
        TestBed.tick();
        const feld = el.querySelector('[formcontrolname="anteilProzent"]')!.closest('.feld')!;
        return feld.querySelector('[role="status"]')?.textContent?.replace(/\s+/g, ' ').trim();
      };
      setzen('betrag', '586,80');
      setzen('zahlweise', 'JAEHRLICH');
      setzen('anteilProzent', '33,3');
      vi.advanceTimersByTime(400);
      expect(vorschau).toHaveBeenLastCalledWith(
        expect.objectContaining({ anteilProzent: 33.3, zahlweise: 'JAEHRLICH' }),
      );
      anfragen.at(-1)!.next(
        vorschauAntwort(ERGEBNIS, {
          betrag: EUR(586.8),
          eigenerAnteil: { betrag: EUR(195.4), kostenProMonat: EUR(16.28) },
        }),
      );
      expect(status()).toBe('Dein Anteil: 33,3 % von 586,80 € = 195,40 € jährlich');
      expect(info(el, 'deinem Anteil')).toEqual([INFO_RUNDUNG]);
      // Der Knopf steht neben der Live-Region, sonst würde er bei jeder Eingabe mit vorgelesen.
      expect(el.querySelector('[role="status"] app-info-knopf')).toBeNull();

      setzen('anteilProzent', '');
      vi.advanceTimersByTime(400);
      anfragen.at(-1)!.next(vorschauAntwort(ERGEBNIS, { betrag: EUR(586.8) }));
      expect(status()).toBe('');
      expect(info(el, 'deinem Anteil')).toBeNull();
    });

    it('nennt unter dem Betrag den heutigen Preis der Vorschau, wenn er ein späterer ist', async () => {
      TestBed.overrideProvider(LOCALE_ID, { useValue: 'de-DE' });
      const { el, setzen } = await offen();
      const EUR = (wert: number) => ({ wert, waehrung: 'EUR' });
      const hinweis = () => {
        TestBed.tick();
        const feld = el.querySelector('[formcontrolname="betrag"]')!.closest('.feld')!;
        return feld.querySelector('.feldhinweis')?.textContent?.replace(/\s+/g, ' ').trim();
      };
      setzen('betrag', '55,20');
      vi.advanceTimersByTime(400);
      anfragen.at(-1)!.next(
        vorschauAntwort(ERGEBNIS, {
          preise: [
            {
              gueltigAb: '2013-01-01',
              betrag: EUR(55.2),
              art: 'FRUEHER',
              automatisch: false,
              neu: false,
            },
            {
              gueltigAb: '2021-07-01',
              betrag: EUR(52.2),
              art: 'AKTUELL',
              automatisch: false,
              neu: false,
            },
          ],
        }),
      );
      expect(hinweis()).toBe(
        'Aktuell: 52,20 € seit 01.07.2021 Spätere Preise trägst du unter „Preisverlauf“ ein.',
      );

      setzen('betrag', '55,21');
      vi.advanceTimersByTime(400);
      anfragen.at(-1)!.next(
        vorschauAntwort(ERGEBNIS, {
          preise: [
            {
              gueltigAb: '2013-01-01',
              betrag: EUR(55.21),
              art: 'AKTUELL',
              automatisch: false,
              neu: false,
            },
          ],
        }),
      );
      expect(hinweis()).toBe('Spätere Preise trägst du unter „Preisverlauf“ ein.');
    });

    it('schickt ein eingetragenes Kündigungsdatum nur, solange „Gekündigt“ gesetzt ist', async () => {
      const { feld, setzen } = await offen();
      feld('gekuendigt').click();
      TestBed.tick();
      setzen('gekuendigtZum', '2027-06-30');
      vi.advanceTimersByTime(400);
      expect(vorschau).toHaveBeenLastCalledWith({ ...OHNE_EINGABEN, gekuendigtZum: '2027-06-30' });
      feld('gekuendigt').click();
      vi.advanceTimersByTime(400);
      expect(vorschau).toHaveBeenLastCalledWith(OHNE_EINGABEN);
    });
  });

  it('bietet die Kategorien an, Wert ist die id', async () => {
    const { feld } = await erstellen();
    const optionen = [...feld<HTMLSelectElement>('kategorieId').options];
    expect(optionen.map((o) => [o.value, o.text])).toEqual([
      ['', 'Bitte wählen'],
      ['k1', 'Versicherung'],
      ['k2', 'Eigene Kategorie'],
    ]);
  });

  it('meldet die Anfrage, wenn die Pflichtfelder gefüllt sind', async () => {
    const { host, absenden, pflichtfelderFuellen, box } = await erstellen();
    pflichtfelderFuellen();
    await absenden();
    expect(box()).toBeUndefined();
    expect(host.gespeichert).toHaveLength(1);
    expect(host.gespeichert[0]).toMatchObject({
      anbieter: 'Anbieter',
      kategorieId: 'k1',
      preise: [{ gueltigAb: '2026-01-01', betrag: { wert: 19.99, waehrung: 'EUR' } }],
      kuendbar: true,
      notiz: null,
    });
  });

  it('zeigt fehlende Pflichtfelder am Feld und in der Box, ohne zu senden', async () => {
    const { host, feld, absenden, fehlerText, box } = await erstellen();
    await absenden();
    expect(host.gespeichert).toEqual([]);
    expect(box()).toBe('Bitte prüfe die markierten Felder.');
    expect(fehlerText('anbieter')).toBe('Bitte gib den Anbieter ein.');
    expect(fehlerText('zahlweise')).toBe('Bitte wähle die Zahlweise.');
    expect(feld('anbieter').getAttribute('aria-invalid')).toBe('true');
    expect(feld('bezeichnung').getAttribute('aria-invalid')).toBe('false');
    expect(document.activeElement).toBe(feld('anbieter'));
  });

  it('bildet Feldfehler des Backends auf die Felder ab und fokussiert das erste', async () => {
    const { host, fixture, feld, fehlerText, box } = await erstellen();
    host.fehler.set(
      validierung(
        ['preise[0].betrag', 'PositiverBetrag'],
        ['laufzeitende', 'LaufzeitendeNachBeginn'],
      ),
    );
    await fixture.whenStable();
    expect(box()).toBe('Bitte prüfe die markierten Felder.');
    expect(fehlerText('betrag')).toBe('Der Betrag muss größer als 0 sein.');
    expect(fehlerText('laufzeitende')).toBe('Das Laufzeitende liegt vor dem Vertragsbeginn.');
    expect(document.activeElement).toBe(feld('betrag'));
  });

  it('entfernt beim Ändern nur den Fehler dieses Feldes, die Box erst mit dem letzten', async () => {
    const { host, fixture, setzen, fehlerText, box } = await erstellen();
    host.fehler.set(validierung(['anbieter', 'NotBlank'], ['preise[0].betrag', 'NotNull']));
    await fixture.whenStable();

    setzen('anbieter', 'A');
    await fixture.whenStable();
    expect(fehlerText('anbieter')).toBeUndefined();
    expect(fehlerText('betrag')).toBeDefined();
    expect(box()).toBeDefined();

    setzen('betrag', '1');
    await fixture.whenStable();
    expect(box()).toBeUndefined();
  });

  it.each([
    ['Serverfehler', new HttpErrorResponse({ status: 500, error: { code: 'INTERNER_FEHLER' } })],
    ['keine Verbindung', new HttpErrorResponse({ status: 0 })],
    ['Fehler ohne passendes Feld', validierung(['unbekannt', 'Regel'])],
  ])('%s: allgemeiner Text, Fokus auf der Box', async (_, fehler) => {
    const { host, fixture, el, setzen, box } = await erstellen();
    host.fehler.set(fehler);
    await fixture.whenStable();
    expect(box()).toBe(
      'Der Vertrag konnte nicht gespeichert werden. Bitte versuche es später erneut.',
    );
    expect(document.activeElement).toBe(el.querySelector('.hinweis'));

    setzen('notiz', 'x');
    await fixture.whenStable();
    expect(box()).toBeUndefined();
  });

  it('blendet Verlängerung und Frist bei „Nicht kündbar“ aus, das Laufzeitende bleibt', async () => {
    const { host, feld, setzen, ankreuzen, absenden, pflichtfelderFuellen } = await erstellen();
    pflichtfelderFuellen();
    setzen('verlaengerung', 'MONATLICH');
    setzen('kuendigungsfristMonate', '3');
    setzen('beginn', '2013-01-01');
    await ankreuzen('nichtKuendbar');

    expect(feld('verlaengerung')).toBeNull();
    expect(feld('kuendigungsfristMonate')).toBeNull();
    expect(feld('laufzeitende')).not.toBeNull();

    await absenden();
    expect(host.gespeichert[0]).toMatchObject({
      kuendbar: false,
      beginn: '2013-01-01',
      verlaengerung: null,
      kuendigungsfristMonate: null,
    });
  });

  it('zeigt „Gekündigt zum“ nur mit Haken und verlangt es dann', async () => {
    const { host, feld, setzen, ankreuzen, absenden, pflichtfelderFuellen, fehlerText } =
      await erstellen();
    pflichtfelderFuellen();
    expect(feld('gekuendigtZum')).toBeNull();

    await ankreuzen('gekuendigt');
    await absenden();
    expect(host.gespeichert).toEqual([]);
    expect(fehlerText('gekuendigtZum')).toBe('Bitte gib an, zu wann der Vertrag gekündigt ist.');

    setzen('gekuendigtZum', '2027-06-30');
    await absenden();
    expect(host.gespeichert[0].gekuendigtZum).toBe('2027-06-30');
  });

  it('behält keinen Fehler an einem ausgeblendeten Feld', async () => {
    const { host, feld, setzen, ankreuzen, absenden, pflichtfelderFuellen, box } =
      await erstellen();
    pflichtfelderFuellen();
    await ankreuzen('gekuendigt');
    await absenden();
    expect(box()).toBeDefined();

    await ankreuzen('gekuendigt');
    expect(feld('gekuendigtZum')).toBeNull();
    expect(box()).toBeUndefined();

    setzen('notiz', 'x');
    await absenden();
    expect(host.gespeichert[0].gekuendigtZum).toBeNull();
  });

  it('sendet nicht doppelt und zeigt den Zustand am Button', async () => {
    const { host, fixture, el, absenden, pflichtfelderFuellen } = await erstellen();
    pflichtfelderFuellen();
    host.sendet.set(true);
    await fixture.whenStable();
    const knopf = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(knopf.disabled).toBe(true);
    expect(knopf.textContent).toContain('Wird gespeichert');
    await absenden();
    expect(host.gespeichert).toEqual([]);
  });

  describe('Tabs', () => {
    const tabs = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const sichtbar = (el: HTMLElement, name: string) =>
      !el.querySelector(`[formcontrolname="${name}"]`)!.closest('[hidden]');
    const text = (e: Element) => e.textContent?.replace(/\s+/g, ' ').trim();

    it('zeigt Allgemein, Kosten, Preisverlauf und Laufzeit, je Tab nur seine Felder', async () => {
      const { el, fixture } = await erstellen();
      expect(tabs(el).map(text)).toEqual(['Allgemein', 'Kosten', 'Preisverlauf', 'Laufzeit']);
      expect(tabs(el)[0].getAttribute('aria-selected')).toBe('true');
      expect(sichtbar(el, 'anbieter')).toBe(true);
      expect(sichtbar(el, 'notiz')).toBe(true);
      expect(sichtbar(el, 'betrag')).toBe(false);
      expect(el.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe(
        tabs(el)[0].id,
      );

      tabs(el)[1].click();
      await fixture.whenStable();
      expect(sichtbar(el, 'betrag')).toBe(true);
      expect(sichtbar(el, 'beginn')).toBe(true);
      expect(sichtbar(el, 'anbieter')).toBe(false);

      tabs(el)[2].click();
      await fixture.whenStable();
      expect(sichtbar(el, 'preisgarantieBis')).toBe(true);
      expect(sichtbar(el, 'steigt')).toBe(true);
      expect(sichtbar(el, 'beginn')).toBe(false);

      tabs(el)[3].click();
      await fixture.whenStable();
      expect(sichtbar(el, 'laufzeitende')).toBe(true);
      expect(sichtbar(el, 'preisgarantieBis')).toBe(false);
      expect(sichtbar(el, 'gekuendigt')).toBe(true);
      expect(tabs(el)[3].getAttribute('aria-selected')).toBe('true');
    });

    it('zählt die Fehler je Tab und springt zum ersten Tab mit Fehler', async () => {
      const { el, fixture, absenden, setzen } = await erstellen();
      setzen('anbieter', 'Anbieter');
      setzen('kategorieId', 'k1');
      tabs(el)[3].click();
      await fixture.whenStable();
      await absenden();

      expect(tabs(el).map(text)).toEqual([
        'Allgemein',
        'Kosten 3, 3 Fehler',
        'Preisverlauf',
        'Laufzeit',
      ]);
      expect(tabs(el)[1].getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(el.querySelector('[formcontrolname="betrag"]'));

      setzen('betrag', '19,99');
      await fixture.whenStable();
      expect(text(tabs(el)[1])).toBe('Kosten 2, 2 Fehler');
    });

    it('springt bei Feldfehlern des Backends zum ersten betroffenen Tab', async () => {
      const { el, fixture, host } = await erstellen();
      host.fehler.set(validierung(['laufzeitende', 'LaufzeitendeNachBeginn']));
      await fixture.whenStable();
      expect(tabs(el)[3].getAttribute('aria-selected')).toBe('true');
      expect(text(tabs(el)[3])).toBe('Laufzeit 1, 1 Fehler');
      expect(document.activeElement).toBe(el.querySelector('[formcontrolname="laufzeitende"]'));
    });

    it('bleibt bei einem Fehler ohne Feld im Tab', async () => {
      const { el, fixture, host } = await erstellen();
      tabs(el)[1].click();
      await fixture.whenStable();
      host.fehler.set(new HttpErrorResponse({ status: 500 }));
      await fixture.whenStable();
      expect(tabs(el)[1].getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('Zusammenfassung', () => {
    async function mitZusammenfassung() {
      TestBed.overrideProvider(LOCALE_ID, { useValue: 'de-DE' });
      const fixture = TestBed.createComponent(VertragFormular);
      fixture.componentRef.setInput('kategorien', KATEGORIEN);
      fixture.componentRef.setInput('zusammenfassung', true);
      await fixture.whenStable();
      const el: HTMLElement = fixture.nativeElement;
      const setzen = async (name: string, wert: string | boolean) => {
        const control = el.querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
        if (typeof wert === 'boolean') {
          control.click();
        } else {
          control.value = wert;
          control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
        }
        await fixture.whenStable();
      };
      const zeilen = () =>
        Object.fromEntries(
          [...el.querySelectorAll('app-vertrag-zusammenfassung dl > div')].map((d) => [
            d.querySelector('dt')?.textContent?.trim(),
            d.querySelector('dd')?.textContent?.replace(/\s+/g, ' ').trim(),
          ]),
        );
      const titel = () =>
        [...el.querySelectorAll('app-vertrag-zusammenfassung .titel span')].map((s) =>
          s.textContent?.trim(),
        );
      return { fixture, el, setzen, zeilen, titel };
    }

    it('zeigt ohne Eingaben „Noch offen“', async () => {
      const { el, zeilen, titel } = await mitZusammenfassung();
      expect(el.querySelector('app-vertrag-zusammenfassung')?.getAttribute('role')).toBe(
        'complementary',
      );
      expect(titel()).toEqual(['Neuer Vertrag', 'Noch keine Angaben']);
      expect(el.querySelector('app-vertrag-zusammenfassung app-info-knopf button')).toBeNull();
      expect(zeilen()).toEqual({
        Betrag: 'Noch offen',
        'Pro Monat': 'Noch offen',
        Vertragsbeginn: 'Noch offen',
        Kündigung: 'Noch offen',
        'Nächste Preisänderung': 'Noch offen',
        Einmalkosten: 'Keine',
      });
    });

    it('folgt den Eingaben: Name, Anbieter · Kategorie', async () => {
      const { setzen, titel } = await mitZusammenfassung();
      await setzen('anbieter', 'Musterversicherung AG');
      expect(titel()).toEqual(['Musterversicherung AG', 'Noch keine Angaben']);
      await setzen('bezeichnung', 'Kfz');
      await setzen('kategorieId', 'k1');
      expect(titel()).toEqual(['Kfz', 'Musterversicherung AG · Versicherung']);
    });

    it('zeigt die Werte der Vorschau, die SPA rechnet nichts', async () => {
      const antwort = new ReplaySubject<VertragVorschauAntwort>(1);
      vorschau.mockReturnValue(antwort);
      const { fixture, el, setzen, zeilen } = await mitZusammenfassung();
      await setzen('zahlweise', 'JAEHRLICH');
      await setzen('beginn', '2026-02-01');
      const EUR = (wert: number) => ({ wert, waehrung: 'EUR' });
      antwort.next(
        vorschauAntwort(KEINE, {
          betrag: EUR(586.8),
          kostenProMonat: EUR(48.9),
          eigenerAnteil: { betrag: EUR(195.4), kostenProMonat: EUR(16.28) },
          naechstePreisaenderung: { ab: '2027-06-01', betrag: EUR(601.47), art: 'PROGNOSE' },
          einmalkosten: EUR(49.9),
        }),
      );
      await new Promise((fertig) => setTimeout(fertig, 450));
      await fixture.whenStable();
      expect(zeilen()).toEqual({
        Betrag: '586,80 € jährlich',
        'Pro Monat': '48,90 €, dein Anteil 16,28 €',
        Vertragsbeginn: '01.02.2026',
        Kündigung: 'Kein Termin bekannt',
        'Nächste Preisänderung': 'ab 01.06.2027: 601,47 € (Prognose)',
        Einmalkosten: '49,90 €',
      });
      expect(info(el, 'Pro Monat')).toEqual([INFO_RUNDUNG]);
      expect(el.querySelectorAll('app-vertrag-zusammenfassung app-info-knopf button')).toHaveLength(
        1,
      );
    });

    it('null der Vorschau: „Noch offen“, unvollständige Einmalkosten ebenso', async () => {
      const antwort = new ReplaySubject<VertragVorschauAntwort>(1);
      vorschau.mockReturnValue(antwort);
      const { fixture, el, zeilen } = await mitZusammenfassung();
      antwort.next(vorschauAntwort(KEINE));
      await new Promise((fertig) => setTimeout(fertig, 5));
      await fixture.whenStable();
      expect(zeilen()).toMatchObject({
        Betrag: 'Noch offen',
        'Pro Monat': 'Noch offen',
        'Nächste Preisänderung': 'Keine bekannt',
        Einmalkosten: 'Keine',
      });

      el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
      await fixture.whenStable();
      [...el.querySelectorAll<HTMLButtonElement>('button')]
        .find((b) => b.textContent?.includes('Einmalkosten hinzufügen'))!
        .click();
      await new Promise((fertig) => setTimeout(fertig, 450));
      await fixture.whenStable();
      expect(zeilen()).not.toHaveProperty('Nächste Abbuchung');
      expect(zeilen()['Einmalkosten']).toBe('Noch offen');
    });

    it('scheitert die Vorschau, ist alles Berechnete „Noch offen“, der Beginn bleibt', async () => {
      const antworten = [
        new ReplaySubject<VertragVorschauAntwort>(1),
        new Subject<VertragVorschauAntwort>(),
      ];
      vorschau.mockReturnValueOnce(antworten[0]).mockReturnValueOnce(antworten[1]);
      const { fixture, setzen, zeilen } = await mitZusammenfassung();
      antworten[0].next(vorschauAntwort(KEINE, { betrag: { wert: 10, waehrung: 'EUR' } }));
      await new Promise((fertig) => setTimeout(fertig, 5));
      await fixture.whenStable();
      expect(zeilen()['Betrag']).toBe('10,00 €');

      await setzen('beginn', '2026-02-01');
      await setzen('laufzeitende', '2020-01-01');
      await new Promise((fertig) => setTimeout(fertig, 450));
      antworten[1].error(validierung(['laufzeitende', 'LaufzeitendeNachBeginn']));
      await fixture.whenStable();
      expect(zeilen()).toMatchObject({
        Betrag: 'Noch offen',
        'Pro Monat': 'Noch offen',
        Vertragsbeginn: '01.02.2026',
        Kündigung: 'Noch offen',
        'Nächste Preisänderung': 'Noch offen',
      });
    });

    it('nennt „Nicht kündbar“ und sonst den Termin der Vorschau', async () => {
      const antwort = new Subject<VertragVorschauAntwort>();
      vorschau.mockReturnValue(antwort);
      const { fixture, setzen, zeilen } = await mitZusammenfassung();
      await setzen('zahlweise', 'MONATLICH');
      await setzen('beginn', '2027-01-01');
      await new Promise((fertig) => setTimeout(fertig, 450));
      antwort.next(
        vorschauAntwort({
          art: 'MONATLICH_KUENDBAR',
          dringend: false,
          fristMonate: null,
          kuendigenBis: null,
          zum: '2027-01-31',
        }),
      );
      await fixture.whenStable();
      expect(zeilen()['Kündigung']).toBe('Monatlich kündbar. Kündbar zum 31.01.2027');

      await setzen('nichtKuendbar', true);
      expect(zeilen()['Kündigung']).toBe('Nicht kündbar');
    });

    it('ohne Eingang keine Zusammenfassung', async () => {
      const { el } = await erstellen();
      expect(el.querySelector('app-vertrag-zusammenfassung')).toBeNull();
    });
  });

  it('meldet Abbrechen', async () => {
    const { host, el } = await erstellen();
    el.querySelector<HTMLButtonElement>('.aktionen button[type="button"]')!.click();
    expect(host.abgebrochen).toBe(1);
  });

  it('hat eindeutige Feld-IDs bei zwei Formularen, und jedes Label gehört zu einem Feld', async () => {
    const { host, fixture, el } = await erstellen();
    host.zweites.set(true);
    await fixture.whenStable();

    const ids = [...el.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const labels = [...el.querySelectorAll('label')];
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(el.querySelector(`[id="${label.htmlFor}"]`)).not.toBeNull();
    }
  });

  describe('Preisliste', () => {
    async function imTabPreise() {
      const hilfen = await erstellen();
      const { el, fixture } = hilfen;
      el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[2].click();
      await fixture.whenStable();
      const hinzufuegen = async () => {
        [...el.querySelectorAll<HTMLButtonElement>('button')]
          .find((b) => b.textContent?.includes('Preis hinzufügen'))!
          .click();
        await fixture.whenStable();
      };
      const zeile = (i: number) => el.querySelectorAll<HTMLElement>('.preis:not(.erster)')[i];
      const erste = () => el.querySelector<HTMLElement>('.preis.erster')!;
      const eingeben = async (i: number, feld: 'gueltigAb' | 'betrag', wert: string) => {
        const input = zeile(i).querySelector<HTMLInputElement>(`[formcontrolname="${feld}"]`)!;
        input.value = wert;
        input.dispatchEvent(new Event('input'));
        await fixture.whenStable();
      };
      const zeilenFehler = (i: number) =>
        zeile(i).querySelector('.feldfehler')?.textContent?.trim();
      return { ...hilfen, hinzufuegen, zeile, erste, eingeben, zeilenFehler };
    }

    it('zeigt zuerst den Betrag ab Vertragsbeginn, ohne Entfernen, mit demselben Feld', async () => {
      const { fixture, erste, feld, setzen } = await imTabPreise();
      const [datum, betrag] = [...erste().querySelectorAll('input')];
      expect(datum.readOnly).toBe(true);
      expect(datum.value).toBe('');
      expect(datum.placeholder).toBe('Vertragsbeginn fehlt');
      expect(erste().querySelector('.entfernen')).toBeNull();
      setzen('beginn', '2026-02-01');
      setzen('betrag', '19,99');
      await fixture.whenStable();
      expect([datum.value, betrag.value]).toEqual(['01.02.2026', '19,99']);
      betrag.value = '21,50';
      betrag.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(feld('betrag').value).toBe('21,50');
    });

    it('zeigt den Fehler am Betrag auch in der ersten Zeile, gezählt im Tab Kosten', async () => {
      const { el, erste, absenden } = await imTabPreise();
      await absenden();
      const tabs = [...el.querySelectorAll('[role="tab"]')].map((t) =>
        t.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(tabs[2]).toBe('Preisverlauf');
      const betrag = erste().querySelectorAll('input')[1];
      expect(betrag.getAttribute('aria-invalid')).toBe('true');
      const fehler = document.getElementById(betrag.getAttribute('aria-describedby')!);
      expect(fehler?.textContent?.trim()).toBe('Bitte gib einen gültigen Betrag ein, z. B. 19,99.');
    });

    it('fügt Zeilen hinzu, fokussiert das Datum und schickt sie nach dem Betrag', async () => {
      const { host, hinzufuegen, zeile, eingeben, pflichtfelderFuellen, absenden } =
        await imTabPreise();
      await hinzufuegen();
      expect(document.activeElement).toBe(zeile(0).querySelector('input[type="date"]'));
      await eingeben(0, 'gueltigAb', '2027-01-01');
      await eingeben(0, 'betrag', '24,99');
      pflichtfelderFuellen();
      await absenden();
      expect(host.gespeichert[0].preise).toEqual([
        { gueltigAb: '2026-01-01', betrag: { wert: 19.99, waehrung: 'EUR' } },
        { gueltigAb: '2027-01-01', betrag: { wert: 24.99, waehrung: 'EUR' } },
      ]);
    });

    it('meldet fehlende Angaben an der Zeile, zählt sie im Tab und springt dorthin', async () => {
      const { el, hinzufuegen, zeile, pflichtfelderFuellen, absenden, zeilenFehler, fehlerText } =
        await imTabPreise();
      await hinzufuegen();
      pflichtfelderFuellen();
      await absenden();
      const tabs = [...el.querySelectorAll('[role="tab"]')].map((t) =>
        t.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(tabs).toEqual(['Allgemein', 'Kosten', 'Preisverlauf 2, 2 Fehler', 'Laufzeit']);
      expect(zeilenFehler(0)).toBe('Bitte gib an, ab wann dieser Preis gilt.');
      const datum = zeile(0).querySelector('input[type="date"]')!;
      expect(datum.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(datum);
      expect(fehlerText('beginn')).toBeUndefined();
    });

    it('ordnet Feldfehler des Backends der Zeile zu, das Datum von preise[0] dem Beginn', async () => {
      const { host, fixture, hinzufuegen, zeilenFehler, fehlerText } = await imTabPreise();
      await hinzufuegen();
      await hinzufuegen();
      host.fehler.set(
        validierung(
          ['preise[0].gueltigAb', 'ErsterPreisAbBeginn'],
          ['preise[1].gueltigAb', 'PreisNichtVorBeginn'],
          ['preise[2].gueltigAb', 'GueltigAbEindeutig'],
        ),
      );
      await fixture.whenStable();
      expect(fehlerText('beginn')).toBe('Der früheste Preis muss ab Vertragsbeginn gelten.');
      expect(zeilenFehler(0)).toBe('Ein Preis kann nicht vor dem Vertragsbeginn gelten.');
      expect(zeilenFehler(1)).toBe('Für dieses Datum gibt es schon einen Preis.');
    });

    it('Entfernen nimmt die Zeile samt Fehler weg, die Fehler darunter rücken nach', async () => {
      const { host, fixture, el, hinzufuegen, zeilenFehler, eingeben } = await imTabPreise();
      await hinzufuegen();
      await hinzufuegen();
      await eingeben(1, 'gueltigAb', '2028-01-01');
      host.fehler.set(
        validierung(['preise[1].betrag', 'NotNull'], ['preise[2].gueltigAb', 'GueltigAbEindeutig']),
      );
      await fixture.whenStable();
      const entfernen = el.querySelectorAll<HTMLButtonElement>('.preis .entfernen');
      expect(entfernen[1].getAttribute('aria-label')).toBe('Preis ab 01.01.2028 entfernen');
      expect(entfernen[0].getAttribute('aria-label')).toBe('Preis entfernen');
      entfernen[0].click();
      await fixture.whenStable();
      expect(el.querySelectorAll('.preis:not(.erster)')).toHaveLength(1);
      expect(zeilenFehler(0)).toBe('Für dieses Datum gibt es schon einen Preis.');
      expect(document.activeElement).toBe(el.querySelector('.preis input[type="date"]'));
    });

    it('kennzeichnet die Zeilen nach der Vorschau, ohne Infobox „Preisverlauf“', async () => {
      TestBed.overrideProvider(LOCALE_ID, { useValue: 'de-DE' });
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      onTestFinished(() => {
        vi.useRealTimers();
      });
      const antwort = new ReplaySubject<VertragVorschauAntwort>(1);
      vorschau.mockReturnValue(antwort);
      const { el, fixture, setzen, hinzufuegen, eingeben, erste, zeile } = await imTabPreise();
      const etiketten = (z: HTMLElement) =>
        [...z.querySelectorAll('.etikett')].map((s) => [
          s.textContent?.trim(),
          [...s.classList].filter((k) => k !== 'etikett'),
        ]);
      setzen('beginn', '2026-01-01');
      await hinzufuegen();
      await eingeben(0, 'gueltigAb', '2027-01-01');
      await eingeben(0, 'betrag', '21,99');
      vi.advanceTimersByTime(1000);

      // Ein einzelner Preis ist immer der aktuelle: kein Etikett.
      antwort.next(
        vorschauAntwort(KEINE, { preise: [vorschauPreis('2026-01-01', 19.99, 'AKTUELL')] }),
      );
      TestBed.tick();
      await fixture.whenStable();
      expect(etiketten(erste())).toEqual([]);

      antwort.next(
        vorschauAntwort(KEINE, {
          preise: [
            vorschauPreis('2026-01-01', 19.99, 'AKTUELL'),
            vorschauPreis('2027-01-01', 21.99, 'ANGEKUENDIGT'),
          ],
        }),
      );
      TestBed.tick();
      await fixture.whenStable();
      expect(etiketten(erste())).toEqual([['aktuell', ['aktuell']]]);
      expect(etiketten(zeile(0))).toEqual([['angekündigt', ['angekuendigt']]]);
      expect(el.querySelector('.verlauf')).toBeNull();
      expect(el.querySelector('app-vertrag-preisliste')?.textContent).not.toContain('Preisverlauf');
      expect(el.querySelector('.neu-hinweis')).toBeNull();
    });

    it('nennt die Stufen, die erst das Speichern anlegt, die aktuelle als feste Zeile', async () => {
      TestBed.overrideProvider(LOCALE_ID, { useValue: 'de-DE' });
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      onTestFinished(() => {
        vi.useRealTimers();
      });
      const antwort = new ReplaySubject<VertragVorschauAntwort>(1);
      vorschau.mockReturnValue(antwort);
      const { el, fixture, setzen, hinzufuegen, eingeben } = await imTabPreise();
      setzen('beginn', '2021-03-01');
      await hinzufuegen();
      await eingeben(0, 'gueltigAb', '2027-01-01');
      await eingeben(0, 'betrag', '120');
      vi.advanceTimersByTime(1000);
      const neu = { automatisch: true, neu: true };
      antwort.next(
        vorschauAntwort(KEINE, {
          preise: [
            vorschauPreis('2021-03-01', 100, 'FRUEHER'),
            vorschauPreis('2022-03-01', 102, 'FRUEHER', neu),
            vorschauPreis('2023-03-01', 104.04, 'FRUEHER', neu),
            vorschauPreis('2024-03-01', 106.12, 'FRUEHER', neu),
            vorschauPreis('2025-03-01', 108.24, 'FRUEHER', neu),
            vorschauPreis('2026-03-01', 110.4, 'AKTUELL', neu),
            vorschauPreis('2027-01-01', 120, 'ANGEKUENDIGT'),
          ],
        }),
      );
      TestBed.tick();
      await fixture.whenStable();

      // Zwischen der ersten Zeile und dem eingetragenen Preis von 2027, nicht als Zeilen des Formulars.
      const liste = [...el.querySelector('.preise')!.children].map((k) => k.className);
      expect(liste.map((k) => k.split(' ')[0])).toEqual([
        'preis',
        'neu-hinweis',
        'preis-vorschau',
        'preis',
      ]);
      expect(el.querySelectorAll('.preis:not(.erster)')).toHaveLength(1);
      expect(el.querySelector('.neu-hinweis')?.textContent?.trim()).toBe(
        'Beim Speichern werden 5 automatische Preise angelegt (2022–2026)',
      );
      const fest = el.querySelector<HTMLElement>('.preis-vorschau')!;
      const [datum, betrag] = fest.querySelectorAll('input');
      expect([datum.value, betrag.value]).toEqual(['01.03.2026', '110,40']);
      expect(datum.readOnly && betrag.readOnly).toBe(true);
      expect(el.querySelector(`[id="${datum.getAttribute('aria-describedby')}"]`)).toBe(
        el.querySelector('.neu-hinweis'),
      );
      expect([...fest.querySelectorAll('.etikett')].map((s) => s.textContent?.trim())).toEqual([
        'aktuell',
        'automatisch',
      ]);
      expect(fest.querySelector('button')).toBeNull();

      // Ist keine der neuen Stufen aktuell, bleibt es beim Hinweis.
      antwort.next(
        vorschauAntwort(KEINE, {
          preise: [
            vorschauPreis('2021-03-01', 100, 'FRUEHER'),
            vorschauPreis('2022-03-01', 102, 'FRUEHER', neu),
            vorschauPreis('2022-06-01', 90, 'AKTUELL'),
          ],
        }),
      );
      TestBed.tick();
      await fixture.whenStable();
      expect(el.querySelector('.neu-hinweis')?.textContent?.trim()).toBe(
        'Beim Speichern wird 1 automatischer Preis angelegt (2022)',
      );
      expect(el.querySelector('.preis-vorschau')).toBeNull();
    });
  });

  describe('Preissteigerung', () => {
    async function imTabPreise() {
      const hilfen = await erstellen();
      const { el, fixture } = hilfen;
      el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[2].click();
      await fixture.whenStable();
      const einschalten = async () => {
        hilfen.feld('steigt').click();
        await fixture.whenStable();
      };
      /** Jede Zeile der Box „Prognose“ für sich. */
      const prognose = () =>
        [...el.querySelectorAll('.prognose b, .prognose [role="status"] > *')].map((e) =>
          e.textContent?.replace(/\s+/g, ' ').trim(),
        );
      return { ...hilfen, einschalten, prognose };
    }

    it('zeigt Preise und Künftige Erhöhungen als eigene Abschnitte', async () => {
      const { el } = await imTabPreise();
      const tab = el.querySelector('app-vertrag-tab-preise')!;
      expect([...tab.querySelectorAll('legend')].map((l) => l.textContent?.trim())).toEqual([
        'Preise',
        'Künftige Erhöhungen',
      ]);
      expect(tab.querySelector('fieldset')?.textContent).toContain(
        'Jeder Preis gilt ab seinem Datum bis zum nächsten, so auch Aktionspreise.',
      );
    });

    it('zeigt die Preisgarantie auch ohne Erhöhung, die übrigen Felder mit dem Schalter', async () => {
      const { feld, einschalten } = await imTabPreise();
      expect(feld('steigt').getAttribute('role')).toBe('switch');
      expect(feld('steigt').classList).toContain('schalter');
      expect(feld('preisgarantieBis')).not.toBeNull();
      expect(feld('steigerungswert')).toBeNull();
      expect(feld('steigerungsart')).toBeNull();
      await einschalten();
      expect(feld('preisgarantieBis')).not.toBeNull();
      expect(feld<HTMLSelectElement>('rhythmus').value).toBe('JAEHRLICH');
    });

    it('Einheit im Feld „Erhöhung um“: % oder das Zeichen der Währung', async () => {
      const { el, feld, setzen, einschalten, fixture } = await imTabPreise();
      await einschalten();
      const wert = feld('steigerungswert');
      const art = feld<HTMLSelectElement>('steigerungsart');
      expect(el.querySelector(`label[for="${wert.id}"]`)?.textContent).toBe('Erhöhung um *');
      expect(art.getAttribute('aria-label')).toBe('Einheit der Erhöhung');
      expect(art.parentElement).toBe(wert.parentElement);
      expect([...art.options].map((o) => o.text)).toEqual(['%', '€']);
      expect(wert.placeholder).toBe('z. B. 2,5');
      setzen('steigerungsart', 'BETRAG');
      await fixture.whenStable();
      expect(wert.placeholder).toBe('z. B. 1,00');
    });

    it('zeigt einen Fehler zur Einheit unter „Erhöhung um“', async () => {
      const { el, host, fixture, feld, einschalten } = await imTabPreise();
      await einschalten();
      host.fehler.set(validierung(['preissteigerung.art', 'NotNull']));
      await fixture.whenStable();
      const art = feld<HTMLSelectElement>('steigerungsart');
      expect(art.getAttribute('aria-invalid')).toBe('true');
      const fehler = el.querySelector(`#${art.id}-fehler`)!;
      expect(art.getAttribute('aria-describedby')).toBe(fehler.id);
      expect(fehler.closest('.feld')).toBe(feld('steigerungswert').closest('.feld'));
      const tabs = [...el.querySelectorAll('[role="tab"]')];
      expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    });

    it('verlangt Wert und Datum, zählt sie im Tab Preisverlauf und schickt die Regel', async () => {
      const { el, host, setzen, einschalten, absenden, pflichtfelderFuellen, fehlerText } =
        await imTabPreise();
      pflichtfelderFuellen();
      await einschalten();
      await absenden();
      expect(host.gespeichert).toHaveLength(0);
      const tabs = [...el.querySelectorAll('[role="tab"]')].map((t) =>
        t.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(tabs[2]).toBe('Preisverlauf 2, 2 Fehler');
      expect(fehlerText('steigerungswert')).toBe('Bitte gib an, um wie viel der Preis steigt.');

      setzen('steigerungswert', '2,5');
      setzen('naechsteErhoehungAm', '2027-01-01');
      setzen('preisgarantieBis', '2026-06-30');
      await absenden();
      expect(host.gespeichert[0]).toMatchObject({
        preisgarantieBis: '2026-06-30',
        erinnerungSonderkuendigung: true,
        preissteigerung: {
          art: 'PROZENT',
          prozent: 2.5,
          betrag: null,
          rhythmus: 'JAEHRLICH',
          naechsteAm: '2027-01-01',
        },
      });
    });

    it('ordnet Feldfehler des Backends den Feldern zu', async () => {
      const { host, fixture, einschalten, fehlerText } = await imTabPreise();
      await einschalten();
      host.fehler.set(
        validierung(
          ['preissteigerung.prozent', 'PassenderWert'],
          ['preisgarantieBis', 'PlausiblesDatum'],
        ),
      );
      await fixture.whenStable();
      expect(fehlerText('steigerungswert')).toBe('Bitte gib an, um wie viel der Preis steigt.');
      expect(fehlerText('preisgarantieBis')).toBe(
        'Bitte gib ein Datum zwischen dem 01.01.1900 und dem 31.12.2199 ein.',
      );
    });

    it('Prognose: Hinweis ohne Wert oder Datum, sonst die Preise der Vorschau', async () => {
      TestBed.overrideProvider(LOCALE_ID, { useValue: 'de-DE' });
      const antwort = new ReplaySubject<VertragVorschauAntwort>(1);
      vorschau.mockReturnValue(antwort);
      const { setzen, einschalten, prognose, fixture } = await imTabPreise();
      const rundung = () => info(fixture.nativeElement as HTMLElement, 'Prognose');
      await einschalten();
      expect(rundung()).toBeNull();
      expect(prognose()).toEqual([
        'Prognose',
        'Gib Wert und Datum der ersten Erhöhung ein, dann zeigen wir hier die nächsten drei Preise.',
      ]);

      antwort.next(
        vorschauAntwort(KEINE, {
          prognose: [
            { ab: '2027-01-01', betrag: { wert: 20.49, waehrung: 'EUR' } },
            { ab: '2028-01-01', betrag: { wert: 21, waehrung: 'EUR' } },
          ],
        }),
      );
      setzen('steigerungswert', '2,5');
      setzen('naechsteErhoehungAm', '2027-01-01');
      await new Promise((fertig) => setTimeout(fertig, 450));
      await fixture.whenStable();
      expect(prognose()).toEqual([
        'Prognose',
        'ab 01.01.2027 voraussichtlich 20,49 €',
        'ab 01.01.2028 voraussichtlich 21,00 €',
      ]);
      expect(rundung()).toEqual([INFO_RUNDUNG_PROGNOSE]);

      antwort.next(vorschauAntwort(KEINE));
      setzen('preisgarantieBis', '2030-01-01');
      await new Promise((fertig) => setTimeout(fertig, 450));
      await fixture.whenStable();
      expect(prognose()).toEqual([
        'Prognose',
        'Bis zum Vertragsende ist keine Erhöhung zu erwarten.',
      ]);
      expect(rundung()).toBeNull();
    });

    it('Erinnerung im Tab Laufzeit: bei Regel oder angekündigtem Preis, nicht bei „Nicht kündbar“', async () => {
      const antwort = new ReplaySubject<VertragVorschauAntwort>(1);
      vorschau.mockReturnValue(antwort);
      const { el, host, einschalten, ankreuzen, absenden, pflichtfelderFuellen, feld, fixture } =
        await imTabPreise();
      const erinnerung = () =>
        el.querySelector('[formcontrolname="erinnerungSonderkuendigung"]')?.closest('.ankreuzen');
      expect(erinnerung()).toBeFalsy();
      expect(el.querySelector('app-vertrag-tab-preise')?.textContent).not.toContain(
        'Sonderkündigungsrecht',
      );

      antwort.next(
        vorschauAntwort(KEINE, {
          preise: [
            {
              gueltigAb: '2027-01-01',
              betrag: { wert: 25, waehrung: 'EUR' },
              art: 'ANGEKUENDIGT',
              automatisch: false,
              neu: false,
            },
          ],
        }),
      );
      await new Promise((fertig) => setTimeout(fertig, 5));
      await fixture.whenStable();
      expect(erinnerung()?.closest('app-vertrag-tab-laufzeit')).not.toBeNull();
      expect(erinnerung()?.textContent).toContain('An das Sonderkündigungsrecht erinnern');
      expect(erinnerung()?.textContent).toContain(
        'Vor jeder Preiserhöhung. Ob es gilt, steht meist im Ankündigungsschreiben.',
      );
      expect(feld('erinnerungSonderkuendigung').getAttribute('role')).toBe('switch');

      antwort.next(vorschauAntwort(KEINE));
      await einschalten();
      await new Promise((fertig) => setTimeout(fertig, 450));
      await fixture.whenStable();
      expect(erinnerung()).toBeTruthy();
      await ankreuzen('erinnerungSonderkuendigung');

      await ankreuzen('nichtKuendbar');
      expect(erinnerung()).toBeFalsy();
      // Ausgeblendet bleibt der Wert.
      feld('steigt').click();
      pflichtfelderFuellen();
      await absenden();
      expect(host.gespeichert[0].erinnerungSonderkuendigung).toBe(false);
    });
  });

  describe('Einmalkosten', () => {
    async function imTabKosten() {
      const hilfen = await erstellen();
      const { el, fixture } = hilfen;
      el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
      await fixture.whenStable();
      const hinzufuegen = async () => {
        [...el.querySelectorAll<HTMLButtonElement>('button')]
          .find((b) => b.textContent?.includes('Einmalkosten hinzufügen'))!
          .click();
        await fixture.whenStable();
      };
      const zeile = (i: number) =>
        el.querySelectorAll<HTMLElement>('app-vertrag-einmalkosten-zeilen .zeile')[i];
      const eingabe = (i: number, feld: string) =>
        zeile(i).querySelector<HTMLInputElement>(`[formcontrolname="${feld}"]`)!;
      const eingeben = async (i: number, feld: string, wert: string) => {
        eingabe(i, feld).value = wert;
        eingabe(i, feld).dispatchEvent(new Event('input'));
        await fixture.whenStable();
      };
      const zeilenFehler = (i: number) =>
        zeile(i).querySelector('.feldfehler')?.textContent?.trim();
      return { ...hilfen, hinzufuegen, zeile, eingabe, eingeben, zeilenFehler };
    }

    it('fügt Zeilen hinzu, fokussiert „Wofür“ und schickt sie mit', async () => {
      const { host, hinzufuegen, eingabe, eingeben, pflichtfelderFuellen, absenden } =
        await imTabKosten();
      pflichtfelderFuellen();
      await absenden();
      expect(host.gespeichert[0].einmalkosten).toEqual([]);

      await hinzufuegen();
      expect(document.activeElement).toBe(eingabe(0, 'bezeichnung'));
      await eingeben(0, 'bezeichnung', 'Anschlussgebühr');
      await eingeben(0, 'betrag', '49,90');
      await eingeben(0, 'faelligAm', '2026-12-01');
      await absenden();
      expect(host.gespeichert[1].einmalkosten).toEqual([
        {
          bezeichnung: 'Anschlussgebühr',
          betrag: { wert: 49.9, waehrung: 'EUR' },
          faelligAm: '2026-12-01',
        },
      ]);
    });

    it('meldet fehlende Angaben an der Zeile, zählt sie im Tab Kosten und springt dorthin', async () => {
      const { el, fixture, hinzufuegen, eingabe, pflichtfelderFuellen, absenden, zeilenFehler } =
        await imTabKosten();
      await hinzufuegen();
      pflichtfelderFuellen();
      el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[0].click();
      await fixture.whenStable();
      await absenden();
      const tabs = [...el.querySelectorAll('[role="tab"]')].map((t) =>
        t.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(tabs).toEqual(['Allgemein', 'Kosten 3, 3 Fehler', 'Preisverlauf', 'Laufzeit']);
      expect(zeilenFehler(0)).toBe('Bitte gib an, wofür die Kosten anfallen.');
      expect(eingabe(0, 'betrag').getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(eingabe(0, 'bezeichnung'));
      const fehlerId = eingabe(0, 'faelligAm').getAttribute('aria-describedby')!;
      expect(document.getElementById(fehlerId)?.textContent?.trim()).toBe(
        'Bitte gib an, wofür die Kosten anfallen.',
      );
    });

    it('ordnet Feldfehler des Backends der Zeile zu, die Liste dem Abschnitt', async () => {
      const { host, el, fixture, hinzufuegen, eingeben, zeilenFehler } = await imTabKosten();
      await hinzufuegen();
      await hinzufuegen();
      host.fehler.set(
        new HttpErrorResponse({
          status: 400,
          error: {
            code: 'VALIDIERUNG',
            felder: [
              { feld: 'einmalkosten[1].faelligAm', code: 'PlausiblesDatum', parameter: {} },
              { feld: 'einmalkosten', code: 'Size', parameter: { max: 100 } },
            ],
          },
        }),
      );
      await fixture.whenStable();
      expect(zeilenFehler(0)).toBeUndefined();
      expect(zeilenFehler(1)).toBe(
        'Bitte gib ein Datum zwischen dem 01.01.1900 und dem 31.12.2199 ein.',
      );
      expect(
        el.querySelector('app-vertrag-einmalkosten-zeilen > .feldfehler')?.textContent?.trim(),
      ).toBe('Höchstens 100 Einmalkosten.');

      await eingeben(1, 'faelligAm', '2026-12-01');
      expect(zeilenFehler(1)).toBeUndefined();
    });

    it('Entfernen nimmt die Zeile samt Fehler weg, die Fehler darunter rücken nach', async () => {
      const { host, fixture, el, hinzufuegen, eingeben, zeilenFehler, eingabe } =
        await imTabKosten();
      await hinzufuegen();
      await hinzufuegen();
      await eingeben(1, 'bezeichnung', 'Router');
      host.fehler.set(
        validierung(
          ['einmalkosten[0].betrag', 'NotNull'],
          ['einmalkosten[1].betrag', 'PositiverBetrag'],
        ),
      );
      await fixture.whenStable();
      const entfernen = el.querySelectorAll<HTMLButtonElement>('.zeile .entfernen');
      expect(entfernen[0].getAttribute('aria-label')).toBe('Einmalkosten entfernen');
      expect(entfernen[1].getAttribute('aria-label')).toBe('Router entfernen');
      entfernen[0].click();
      await fixture.whenStable();
      expect(el.querySelectorAll('app-vertrag-einmalkosten-zeilen .zeile')).toHaveLength(1);
      expect(zeilenFehler(0)).toBe('Der Betrag muss größer als 0 sein.');
      expect(document.activeElement).toBe(eingabe(0, 'bezeichnung'));

      el.querySelector<HTMLButtonElement>('.zeile .entfernen')!.click();
      await fixture.whenStable();
      expect(document.activeElement?.textContent).toContain('Einmalkosten hinzufügen');
    });

    it('zeigt die Summe der Vorschau, solange es Zeilen gibt', async () => {
      TestBed.overrideProvider(LOCALE_ID, { useValue: 'de-DE' });
      const antwort = new ReplaySubject<VertragVorschauAntwort>(1);
      vorschau.mockReturnValue(antwort);
      const { el, fixture, hinzufuegen } = await imTabKosten();
      const summe = () =>
        el.querySelector('app-vertrag-einmalkosten-zeilen [role="status"]')?.textContent?.trim();
      antwort.next(vorschauAntwort(KEINE, { einmalkosten: { wert: 49.9, waehrung: 'EUR' } }));
      // Die erste Anfrage startet nach timer(0); eine neue Zeile ändert die Anfrage und bräche sie ab.
      await new Promise((fertig) => setTimeout(fertig, 5));
      await fixture.whenStable();
      expect(summe()).toBe('');

      await hinzufuegen();
      expect(summe()?.replace(/\s/g, ' ')).toBe('Einmalkosten gesamt: 49,90 €');

      // Ohne vollständige Zeile liefert die Vorschau keine Summe (nach der Pause neu gefragt).
      antwort.next(vorschauAntwort(KEINE));
      await new Promise((fertig) => setTimeout(fertig, 450));
      await fixture.whenStable();
      expect(summe()).toBe('');
    });

    it('lässt Zeilen mit Betrag nicht größer 0 in der Vorschau weg', async () => {
      const { hinzufuegen, eingeben } = await imTabKosten();
      await hinzufuegen();
      await eingeben(0, 'bezeichnung', 'Gutschrift');
      await eingeben(0, 'betrag', '0');
      await new Promise((fertig) => setTimeout(fertig, 450));
      expect(vorschau.mock.lastCall?.[0].einmalkosten).toEqual([]);
    });
  });

  describe('zum Bearbeiten', () => {
    const VERTRAG: VertragAntwort = {
      betragErrechnet: false,
      preissteigerungBetrachtetBis: null,
      id: 'v1',
      version: 4,
      anbieter: 'Anbieter',
      bezeichnung: 'Kfz',
      kategorie: KATEGORIEN[1],
      vertragsnummer: null,
      betrag: { wert: 586.8, waehrung: 'USD' },
      preise: [
        {
          gueltigAb: '2026-01-31',
          betrag: { wert: 586.8, waehrung: 'USD' },
          art: 'AKTUELL',
          automatisch: false,
        },
      ],
      anteilProzent: null,
      einmalkosten: [],
      preissteigerung: null,
      preisgarantieBis: null,
      erinnerungSonderkuendigung: true,
      zahlweise: 'MONATLICH',
      zahlungsweg: 'PAYPAL',
      kuendbar: true,
      beginn: '2026-01-31',
      laufzeitende: null,
      verlaengerung: 'MONATLICH',
      kuendigungsfristMonate: 4,
      gekuendigtZum: '2027-06-30',
      notiz: null,
      unterbrechungen: [],
      berechnet: {
        aktuellerBeginn: '2026-01-31',
        wiederaufnahme: null,
        status: 'GEKUENDIGT',
        kostenProMonat: { wert: 586.8, waehrung: 'USD' },
        kostenImJahr: { wert: 7041.6, waehrung: 'USD' },
        kostenImJahrMitPrognose: false,
        jahr: 2026,
        eigenerAnteil: null,
        einmalkosten: { wert: 0, waehrung: 'USD' },
        naechstePreisaenderung: null,
        preisverlauf: [],
        prognose: [],
        vertragsende: '2027-06-30',
        kuendigung: {
          art: 'GEKUENDIGT',
          dringend: false,
          fristMonate: 4,
          kuendigenBis: null,
          zum: '2027-06-30',
        },
      },
    };

    @Component({
      imports: [VertragFormular],
      template: `<app-vertrag-formular
        [vertrag]="vertrag()"
        [kategorien]="kategorien"
        [neuerPreis]="neuerPreis()"
        (speichern)="gespeichert.push($event)"
      />`,
    })
    class BearbeitenHost {
      readonly kategorien = KATEGORIEN;
      readonly vertrag = signal<VertragAntwort>(VERTRAG);
      readonly neuerPreis = signal(false);
      readonly gespeichert: Required<VertragEingabe>[] = [];
    }

    async function offen(vertrag: VertragAntwort = VERTRAG, neuerPreis = false) {
      const fixture = TestBed.createComponent(BearbeitenHost);
      fixture.componentInstance.vertrag.set(vertrag);
      fixture.componentInstance.neuerPreis.set(neuerPreis);
      document.body.appendChild(fixture.nativeElement);
      await fixture.whenStable();
      const el: HTMLElement = fixture.nativeElement;
      const feld = (name: string) =>
        el.querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
      const setzen = async (name: string, wert: string) => {
        const control = feld(name);
        control.value = wert;
        control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
        await fixture.whenStable();
      };
      return { fixture, el, host: fixture.componentInstance, feld, setzen };
    }

    it('fragt die Vorschau beim Öffnen mit dem gespeicherten Beginn', async () => {
      await offen();
      await new Promise((fertig) => setTimeout(fertig, 5));
      expect(vorschau).toHaveBeenCalledOnce();
      expect(vorschau.mock.calls[0][0].beginn).toBe(VERTRAG.beginn);
    });

    it('belegt alle Felder vor, auch Auswahlfelder und abhängige Felder', async () => {
      const { feld, el } = await offen();
      expect(feld('anbieter').value).toBe('Anbieter');
      expect(feld('kategorieId').value).toBe('k2');
      expect(feld('betrag').value).toBe('586,80');
      expect(feld('zahlweise').value).toBe('MONATLICH');
      expect(feld('beginn').value).toBe('2026-01-31');
      expect(feld('zahlungsweg').value).toBe('PAYPAL');
      expect(feld('verlaengerung').value).toBe('MONATLICH');
      expect(feld('gekuendigt').checked).toBe(true);
      expect(feld('gekuendigtZum').value).toBe('2027-06-30');
      expect(el.querySelector('form')?.getAttribute('aria-label')).toBe('Kfz bearbeiten');
    });

    it('blendet bei nicht kündbaren Verträgen Verlängerung und Frist aus', async () => {
      const { feld } = await offen({ ...VERTRAG, kuendbar: false });
      expect(feld('nichtKuendbar').checked).toBe(true);
      expect(feld('verlaengerung')).toBeNull();
    });

    it('fokussiert das erste Feld', async () => {
      const { feld } = await offen();
      expect(document.activeElement).toBe(feld('anbieter'));
    });

    it('nennt die Währung des Vertrags in der Bezeichnung', async () => {
      const { el } = await offen();
      expect(el.textContent).toContain('Betrag in $ *');
    });

    it('behält eine Frist außerhalb der Auswahl als eigene Option', async () => {
      const { feld } = await offen();
      const frist = feld('kuendigungsfristMonate') as unknown as HTMLSelectElement;
      expect(frist.value).toBe('4');
      expect(frist.selectedOptions[0].text).toBe('4 Monate');
    });

    it('bietet ohne ungewöhnliche Frist nur die Standardauswahl', async () => {
      const { feld } = await offen({ ...VERTRAG, kuendigungsfristMonate: 3 });
      const frist = feld('kuendigungsfristMonate') as unknown as HTMLSelectElement;
      expect([...frist.options].map((o) => o.value)).toEqual(['', '0', '1', '2', '3', '6']);
    });

    it('schickt ohne Änderung die gespeicherten Werte', async () => {
      const { fixture, el, host } = await offen();
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      expect(host.gespeichert[0]).toMatchObject({
        beginn: '2026-01-31',
        kuendigungsfristMonate: 4,
        preise: [{ gueltigAb: '2026-01-31', betrag: { wert: 586.8, waehrung: 'USD' } }],
      });
    });

    it('meldet ungespeicherte Eingaben, auch wenn sie zurückgenommen werden', async () => {
      const { fixture, setzen } = await offen();
      const eingaben = TestBed.inject(UngespeicherteEingaben);
      expect(eingaben.vorhanden()).toBe(false);
      await setzen('notiz', 'x');
      expect(eingaben.vorhanden()).toBe(true);
      await setzen('notiz', '');
      expect(eingaben.vorhanden()).toBe(false);

      await setzen('notiz', 'x');
      fixture.destroy();
      expect(eingaben.vorhanden()).toBe(false);
    });

    it('belegt den Anteil vor und schickt ihn geändert zurück', async () => {
      const { fixture, el, feld, setzen, host } = await offen({ ...VERTRAG, anteilProzent: 50 });
      expect(feld('anteilProzent').value).toBe('50');
      await setzen('anteilProzent', '33,3');
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      expect(host.gespeichert[0].anteilProzent).toBe(33.3);
    });

    it('belegt Regel und Garantie vor, in der Währung des Vertrags', async () => {
      TestBed.overrideProvider(LOCALE_ID, { useValue: 'de-DE' });
      const { feld } = await offen({
        ...VERTRAG,
        preisgarantieBis: '2026-12-31',
        preissteigerung: {
          art: 'BETRAG',
          prozent: null,
          betrag: { wert: 1.5, waehrung: 'USD' },
          rhythmus: 'HALBJAEHRLICH',
          naechsteAm: '2027-01-01',
        },
      });
      expect(feld('steigt').checked).toBe(true);
      expect(feld('steigerungswert').value).toBe('1,50');
      expect(feld('rhythmus').value).toBe('HALBJAEHRLICH');
      expect(feld('naechsteErhoehungAm').value).toBe('2027-01-01');
      expect(feld('preisgarantieBis').value).toBe('2026-12-31');
      const art = feld('steigerungsart') as unknown as HTMLSelectElement;
      expect(art.selectedOptions[0].text).toBe('$');
    });

    describe('Preise', () => {
      const USD = (wert: number) => ({ wert, waehrung: 'USD' });
      const MIT_PREISEN: VertragAntwort = {
        ...VERTRAG,
        betrag: USD(20),
        preise: [
          { gueltigAb: '2026-01-31', betrag: USD(10), art: 'FRUEHER', automatisch: false },
          { gueltigAb: '2026-06-01', betrag: USD(20), art: 'AKTUELL', automatisch: false },
          { gueltigAb: '2027-01-01', betrag: USD(25), art: 'ANGEKUENDIGT', automatisch: false },
        ],
      };
      const zeilen = (el: HTMLElement) =>
        [...el.querySelectorAll('.preis:not(.erster)')].map((zeile) =>
          [...zeile.querySelectorAll('input')].map((input) => input.value),
        );

      it('der erste Preis steht unter „Betrag“, die übrigen in der Liste, in dieser Reihenfolge', async () => {
        const { fixture, el, feld, host } = await offen(MIT_PREISEN);
        expect(feld('betrag').value).toBe('10,00');
        expect(zeilen(el)).toEqual([
          ['2026-06-01', '20,00'],
          ['2027-01-01', '25,00'],
        ]);
        el.querySelector('form')!.dispatchEvent(new Event('submit'));
        await fixture.whenStable();
        expect(host.gespeichert[0].preise).toEqual([
          { gueltigAb: '2026-01-31', betrag: USD(10) },
          { gueltigAb: '2026-06-01', betrag: USD(20) },
          { gueltigAb: '2027-01-01', betrag: USD(25) },
        ]);
      });

      it('„Preis hinzufügen“ der Details: Tab Preisverlauf, leere Zeile mit Fokus, nicht ungespeichert', async () => {
        const { el, fixture } = await offen(VERTRAG, true);
        await fixture.whenStable();
        const aktiv = el.querySelector('[role="tab"][aria-selected="true"]');
        expect(aktiv?.textContent?.trim()).toBe('Preisverlauf');
        expect(zeilen(el)).toEqual([['', '']]);
        expect(document.activeElement).toBe(el.querySelector('.preis input[type="date"]'));
        expect(TestBed.inject(UngespeicherteEingaben).vorhanden()).toBe(false);
      });
    });

    it('belegt nicht neu vor, wenn der Vertrag im offenen Formular neu geladen wird', async () => {
      const { fixture, host, feld, setzen } = await offen();
      await setzen('notiz', 'Eingabe');
      host.vertrag.set({ ...VERTRAG, anbieter: 'Anderer Stand' });
      await fixture.whenStable();
      expect(feld('anbieter').value).toBe('Anbieter');
      expect(feld('notiz').value).toBe('Eingabe');
    });
  });
});
