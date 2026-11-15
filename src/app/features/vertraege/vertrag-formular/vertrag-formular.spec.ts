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
import { VertragEingabe, VertragService } from '../vertrag.service';
import { VertragFormular } from './vertrag-formular';

const KEINE: Kuendigung = {
  art: 'KEINE_LAUFZEIT',
  dringend: false,
  fristMonate: null,
  kuendigenBis: null,
  zum: null,
};

/** Mit Vertragsbeginn ist „Betrag gilt seit“ auch bei weiteren Preisen optional. */
function setzenBeginn(el: HTMLElement) {
  const beginn = el.querySelector<HTMLInputElement>('[formcontrolname="beginn"]')!;
  beginn.value = '2026-01-01';
  beginn.dispatchEvent(new Event('input'));
}

const KATEGORIEN: VertragKategorieAntwort[] = [
  { id: 'k1', schluessel: 'VERSICHERUNG', name: null },
  { id: 'k2', schluessel: null, name: 'Eigene Kategorie' },
];

/** Vorschau, in der nur die Kündigung und ggf. die Preise zählen. */
function vorschauAntwort(
  kuendigung: Kuendigung,
  mehr: Partial<VertragVorschauAntwort> = {},
): VertragVorschauAntwort {
  return {
    betrag: null,
    eigenerAnteil: null,
    einmalkosten: null,
    kostenProMonat: null,
    naechsteAbbuchung: null,
    naechstePreisaenderung: null,
    preise: [],
    prognose: [],
    kuendigung,
    ...mehr,
  };
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
    setzen('abbuchungAb', '2027-01-01');
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
      abbuchungAb: null,
      beginn: null,
      laufzeitende: null,
      verlaengerung: null,
      kuendigungsfristMonate: null,
      gekuendigtZum: null,
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
        return hilfen.el.querySelector('.vorschau')?.textContent?.replace(/\s+/g, ' ').trim();
      };
      return { ...hilfen, antworten, zeile };
    }

    it('fragt beim Öffnen sofort mit allen Werten', async () => {
      const { zeile, antworten, el } = await offen();
      expect(vorschau).toHaveBeenCalledExactlyOnceWith(OHNE_EINGABEN);
      expect(zeile()).toBe('Nächster Kündigungstermin:–');
      antworten(0, { ...ERGEBNIS, art: 'KEINE_LAUFZEIT' });
      expect(zeile()).toBe('Nächster Kündigungstermin:Kein Termin bekannt');
      expect(el.querySelector('.vorschau')?.getAttribute('role')).toBe('status');
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

    it('schickt den Betrag als ersten Preis mit', async () => {
      const { setzen } = await offen();
      setzen('betrag', '19,99');
      vi.advanceTimersByTime(400);
      expect(vorschau).toHaveBeenLastCalledWith({
        ...OHNE_EINGABEN,
        preise: [{ gueltigAb: null, betrag: { wert: 19.99, waehrung: 'EUR' } }],
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
      expect(status()).toBe('Dein Anteil:33,3 % von 586,80 € = 195,40 € jährlich');

      setzen('anteilProzent', '');
      vi.advanceTimersByTime(400);
      anfragen.at(-1)!.next(vorschauAntwort(ERGEBNIS, { betrag: EUR(586.8) }));
      expect(status()).toBe('');
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
      preise: [{ gueltigAb: null, betrag: { wert: 19.99, waehrung: 'EUR' } }],
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

  it('blendet Verlängerung und Frist bei „Nicht kündbar“ aus, Beginn und Laufzeitende bleiben', async () => {
    const { host, feld, setzen, ankreuzen, absenden, pflichtfelderFuellen } = await erstellen();
    pflichtfelderFuellen();
    setzen('verlaengerung', 'MONATLICH');
    setzen('kuendigungsfristMonate', '3');
    setzen('beginn', '2013-01-01');
    await ankreuzen('nichtKuendbar');

    expect(feld('verlaengerung')).toBeNull();
    expect(feld('kuendigungsfristMonate')).toBeNull();
    expect(feld('beginn')).not.toBeNull();
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

    it('zeigt Allgemein, Kosten, Laufzeit und Preise, je Tab nur seine Felder', async () => {
      const { el, fixture } = await erstellen();
      expect(tabs(el).map(text)).toEqual(['Allgemein', 'Kosten', 'Laufzeit', 'Preise']);
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
      expect(sichtbar(el, 'anbieter')).toBe(false);

      tabs(el)[2].click();
      await fixture.whenStable();
      expect(sichtbar(el, 'beginn')).toBe(true);
      expect(sichtbar(el, 'gekuendigt')).toBe(true);
      expect(tabs(el)[2].getAttribute('aria-selected')).toBe('true');
    });

    it('zählt die Fehler je Tab und springt zum ersten Tab mit Fehler', async () => {
      const { el, fixture, absenden, setzen } = await erstellen();
      setzen('anbieter', 'Anbieter');
      setzen('kategorieId', 'k1');
      tabs(el)[2].click();
      await fixture.whenStable();
      await absenden();

      expect(tabs(el).map(text)).toEqual(['Allgemein', 'Kosten 3, 3 Fehler', 'Laufzeit', 'Preise']);
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
      expect(tabs(el)[2].getAttribute('aria-selected')).toBe('true');
      expect(text(tabs(el)[2])).toBe('Laufzeit 1, 1 Fehler');
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
      expect(zeilen()).toEqual({
        Betrag: 'Noch offen',
        'Pro Monat': 'Noch offen',
        'Nächste Abbuchung': 'Noch offen',
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
      const { fixture, setzen, zeilen } = await mitZusammenfassung();
      await setzen('zahlweise', 'JAEHRLICH');
      const EUR = (wert: number) => ({ wert, waehrung: 'EUR' });
      antwort.next(
        vorschauAntwort(KEINE, {
          betrag: EUR(586.8),
          kostenProMonat: EUR(48.9),
          eigenerAnteil: { betrag: EUR(195.4), kostenProMonat: EUR(16.28) },
          naechsteAbbuchung: { am: '2027-01-01', betrag: EUR(586.8) },
          naechstePreisaenderung: { ab: '2027-06-01', betrag: EUR(601.47), art: 'PROGNOSE' },
          einmalkosten: EUR(49.9),
        }),
      );
      await new Promise((fertig) => setTimeout(fertig, 450));
      await fixture.whenStable();
      expect(zeilen()).toEqual({
        Betrag: '586,80 € jährlich',
        'Pro Monat': '48,90 €, dein Anteil 16,28 €',
        'Nächste Abbuchung': '01.01.2027, 586,80 €',
        Kündigung: 'Kein Termin bekannt',
        'Nächste Preisänderung': 'ab 01.06.2027: 601,47 € (Prognose)',
        Einmalkosten: '49,90 €',
      });
    });

    it('null der Vorschau: „Noch offen“, mit allen Angaben „Keine weiteren Abbuchungen“', async () => {
      const antwort = new ReplaySubject<VertragVorschauAntwort>(1);
      vorschau.mockReturnValue(antwort);
      const { fixture, el, setzen, zeilen } = await mitZusammenfassung();
      antwort.next(vorschauAntwort(KEINE));
      await new Promise((fertig) => setTimeout(fertig, 5));
      await fixture.whenStable();
      expect(zeilen()).toMatchObject({
        Betrag: 'Noch offen',
        'Pro Monat': 'Noch offen',
        'Nächste Abbuchung': 'Noch offen',
        'Nächste Preisänderung': 'Keine bekannt',
        Einmalkosten: 'Keine',
      });

      await setzen('betrag', '10');
      await setzen('zahlweise', 'MONATLICH');
      await setzen('abbuchungAb', '2025-01-01');
      el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
      await fixture.whenStable();
      [...el.querySelectorAll<HTMLButtonElement>('button')]
        .find((b) => b.textContent?.includes('Einmalkosten hinzufügen'))!
        .click();
      await new Promise((fertig) => setTimeout(fertig, 450));
      await fixture.whenStable();
      expect(zeilen()['Nächste Abbuchung']).toBe('Keine weiteren Abbuchungen');
      expect(zeilen()['Einmalkosten']).toBe('Noch offen');
    });

    it('scheitert die Vorschau, ist alles „Noch offen“ statt eines alten Stands', async () => {
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

      await setzen('laufzeitende', '2020-01-01');
      await new Promise((fertig) => setTimeout(fertig, 450));
      antworten[1].error(validierung(['laufzeitende', 'LaufzeitendeNachBeginn']));
      await fixture.whenStable();
      expect(Object.values(zeilen()).slice(0, 5)).toEqual(Array(5).fill('Noch offen'));
    });

    it('nennt „Nicht kündbar“ und sonst den Termin der Vorschau', async () => {
      const antwort = new Subject<VertragVorschauAntwort>();
      vorschau.mockReturnValue(antwort);
      const { fixture, setzen, zeilen } = await mitZusammenfassung();
      await setzen('zahlweise', 'MONATLICH');
      await setzen('abbuchungAb', '2027-01-01');
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
      el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[3].click();
      await fixture.whenStable();
      const hinzufuegen = async () => {
        [...el.querySelectorAll<HTMLButtonElement>('button')]
          .find((b) => b.textContent?.includes('Preis hinzufügen'))!
          .click();
        await fixture.whenStable();
      };
      const zeile = (i: number) => el.querySelectorAll<HTMLElement>('.preis')[i];
      const eingeben = async (i: number, feld: 'gueltigAb' | 'betrag', wert: string) => {
        const input = zeile(i).querySelector<HTMLInputElement>(`[formcontrolname="${feld}"]`)!;
        input.value = wert;
        input.dispatchEvent(new Event('input'));
        await fixture.whenStable();
      };
      const zeilenFehler = (i: number) =>
        zeile(i).querySelector('.feldfehler')?.textContent?.trim();
      return { ...hilfen, hinzufuegen, zeile, eingeben, zeilenFehler };
    }

    it('fügt Zeilen hinzu, fokussiert das Datum und schickt sie nach dem Betrag', async () => {
      const { host, hinzufuegen, zeile, eingeben, pflichtfelderFuellen, setzen, absenden } =
        await imTabPreise();
      await hinzufuegen();
      expect(document.activeElement).toBe(zeile(0).querySelector('input[type="date"]'));
      await eingeben(0, 'gueltigAb', '2027-01-01');
      await eingeben(0, 'betrag', '24,99');
      pflichtfelderFuellen();
      setzen('gueltigSeit', '2026-01-01');
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
      setzenBeginn(el);
      await absenden();
      const tabs = [...el.querySelectorAll('[role="tab"]')].map((t) =>
        t.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(tabs).toEqual(['Allgemein', 'Kosten', 'Laufzeit', 'Preise 2, 2 Fehler']);
      expect(zeilenFehler(0)).toBe('Bitte gib an, ab wann dieser Preis gilt.');
      const datum = zeile(0).querySelector('input[type="date"]')!;
      expect(datum.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(datum);
      expect(fehlerText('gueltigSeit')).toBeUndefined();
    });

    it('ordnet Feldfehler des Backends der Zeile zu, preise[0] dem Betrag', async () => {
      const { host, fixture, hinzufuegen, zeilenFehler, fehlerText } = await imTabPreise();
      await hinzufuegen();
      await hinzufuegen();
      host.fehler.set(
        validierung(
          ['preise[0].gueltigAb', 'PreisNichtVorBeginn'],
          ['preise[2].gueltigAb', 'GueltigAbEindeutig'],
        ),
      );
      await fixture.whenStable();
      expect(fehlerText('gueltigSeit')).toBe('Ein Preis kann nicht vor dem Vertragsbeginn gelten.');
      expect(zeilenFehler(0)).toBeUndefined();
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
      expect(el.querySelectorAll('.preis')).toHaveLength(1);
      expect(zeilenFehler(0)).toBe('Für dieses Datum gibt es schon einen Preis.');
      expect(document.activeElement).toBe(el.querySelector('.preis input[type="date"]'));
    });

    it('zeigt den Preisverlauf der Vorschau, sobald es weitere Preise gibt', async () => {
      TestBed.overrideProvider(LOCALE_ID, { useValue: 'de-DE' });
      // Die erste Anfrage startet erst nach timer(0); die Antwort darf nicht vorher verloren gehen.
      const antwort = new ReplaySubject<VertragVorschauAntwort>(1);
      vorschau.mockReturnValue(antwort);
      const { el, fixture, hinzufuegen } = await imTabPreise();
      const verlauf = () =>
        [...el.querySelectorAll('.verlauf span')].map((s) => [
          s.textContent?.replace(/\s/g, ' '),
          s.className,
        ]);
      const preise: VertragVorschauAntwort['preise'] = [
        { gueltigAb: null, betrag: { wert: 19.99, waehrung: 'EUR' }, art: 'AKTUELL' },
        { gueltigAb: '2027-01-01', betrag: { wert: 24.99, waehrung: 'EUR' }, art: 'ANGEKUENDIGT' },
      ];
      antwort.next(vorschauAntwort(KEINE, { preise }));
      await fixture.whenStable();
      expect(el.querySelector('.verlauf')).toBeNull();

      await hinzufuegen();
      expect(el.querySelector('.verlauf')?.getAttribute('role')).toBe('status');
      expect(verlauf()).toEqual([
        ['ab Vertragsbeginn: 19,99 € · aktuell', 'aktuell'],
        ['ab 01.01.2027: 24,99 € · angekündigt', ''],
      ]);
    });
  });

  describe('Preissteigerung', () => {
    async function imTabPreise() {
      const hilfen = await erstellen();
      const { el, fixture } = hilfen;
      el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[3].click();
      await fixture.whenStable();
      const einschalten = async () => {
        hilfen.feld('steigt').click();
        await fixture.whenStable();
      };
      /** Jede Zeile der Box „Prognose“ für sich. */
      const prognose = () =>
        [...el.querySelectorAll('.prognose > *')].map((e) =>
          e.textContent?.replace(/\s+/g, ' ').trim(),
        );
      return { ...hilfen, einschalten, prognose };
    }

    it('blendet die Felder mit dem Schalter ein; Bezeichnung folgt der Art', async () => {
      const { el, feld, setzen, einschalten, fixture } = await imTabPreise();
      expect(feld('steigt').getAttribute('role')).toBe('switch');
      expect(feld('steigerungswert')).toBeNull();
      await einschalten();
      const label = () =>
        el.querySelector(`label[for="${feld('steigerungswert').id}"]`)?.textContent;
      expect(label()).toBe('Erhöhung in % *');
      expect(feld<HTMLSelectElement>('rhythmus').value).toBe('JAEHRLICH');
      expect([...feld<HTMLSelectElement>('steigerungsart').options].map((o) => o.text)).toEqual([
        'Prozent',
        'Euro',
      ]);
      setzen('steigerungsart', 'BETRAG');
      await fixture.whenStable();
      expect(label()).toBe('Erhöhung in € *');
    });

    it('verlangt Wert und Datum, zählt sie im Tab Preise und schickt die Regel', async () => {
      const { el, host, setzen, einschalten, absenden, pflichtfelderFuellen, fehlerText } =
        await imTabPreise();
      pflichtfelderFuellen();
      await einschalten();
      await absenden();
      expect(host.gespeichert).toHaveLength(0);
      const tabs = [...el.querySelectorAll('[role="tab"]')].map((t) =>
        t.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(tabs.at(-1)).toBe('Preise 2, 2 Fehler');
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
      await einschalten();
      expect(prognose()).toEqual([
        'Prognose',
        'Gib Wert und Datum der nächsten Erhöhung ein, dann zeigen wir hier die nächsten drei Preise.',
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

      antwort.next(vorschauAntwort(KEINE));
      setzen('preisgarantieBis', '2030-01-01');
      await new Promise((fertig) => setTimeout(fertig, 450));
      await fixture.whenStable();
      expect(prognose()).toEqual([
        'Prognose',
        'Bis zum Vertragsende ist keine Erhöhung zu erwarten.',
      ]);
    });

    it('Erinnerung: bei Regel oder angekündigtem Preis, nicht bei „Nicht kündbar“', async () => {
      const antwort = new ReplaySubject<VertragVorschauAntwort>(1);
      vorschau.mockReturnValue(antwort);
      const { el, host, einschalten, ankreuzen, absenden, pflichtfelderFuellen, feld, fixture } =
        await imTabPreise();
      const erinnerung = () => el.querySelector('.erinnerung');
      expect(erinnerung()).toBeNull();

      antwort.next(
        vorschauAntwort(KEINE, {
          preise: [
            { gueltigAb: '2027-01-01', betrag: { wert: 25, waehrung: 'EUR' }, art: 'ANGEKUENDIGT' },
          ],
        }),
      );
      await new Promise((fertig) => setTimeout(fertig, 5));
      await fixture.whenStable();
      expect(erinnerung()?.textContent).toContain('Vor jeder Preiserhöhung daran erinnern');

      antwort.next(vorschauAntwort(KEINE));
      await einschalten();
      await new Promise((fertig) => setTimeout(fertig, 450));
      await fixture.whenStable();
      expect(erinnerung()).not.toBeNull();
      await ankreuzen('erinnerungSonderkuendigung');

      await ankreuzen('nichtKuendbar');
      expect(erinnerung()).toBeNull();
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
      expect(tabs).toEqual(['Allgemein', 'Kosten 3, 3 Fehler', 'Laufzeit', 'Preise']);
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
      id: 'v1',
      version: 4,
      anbieter: 'Anbieter',
      bezeichnung: 'Kfz',
      kategorie: KATEGORIEN[1],
      vertragsnummer: null,
      betrag: { wert: 586.8, waehrung: 'USD' },
      preise: [{ gueltigAb: null, betrag: { wert: 586.8, waehrung: 'USD' }, art: 'AKTUELL' }],
      anteilProzent: null,
      einmalkosten: [],
      preissteigerung: null,
      preisgarantieBis: null,
      erinnerungSonderkuendigung: true,
      zahlweise: 'MONATLICH',
      abbuchungAb: '2026-01-31',
      zahlungsweg: 'PAYPAL',
      kuendbar: true,
      beginn: null,
      laufzeitende: null,
      verlaengerung: 'MONATLICH',
      kuendigungsfristMonate: 4,
      gekuendigtZum: '2027-06-30',
      notiz: null,
      berechnet: {
        status: 'GEKUENDIGT',
        kostenProMonat: { wert: 586.8, waehrung: 'USD' },
        kostenImJahr: { wert: 7041.6, waehrung: 'USD' },
        kostenImJahrMitPrognose: false,
        jahr: 2026,
        eigenerAnteil: null,
        einmalkosten: { wert: 0, waehrung: 'USD' },
        naechsteAbbuchung: { am: '2026-11-30', betrag: { wert: 586.8, waehrung: 'USD' } },
        naechstePreisaenderung: null,
        preisverlauf: [],
        prognose: [],
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

    it('die Vorschau zählt beim Öffnen vom gespeicherten Anker aus', async () => {
      await offen();
      await new Promise((fertig) => setTimeout(fertig, 5));
      expect(vorschau).toHaveBeenCalledOnce();
      expect(vorschau.mock.calls[0][0].abbuchungAb).toBe(VERTRAG.abbuchungAb);
    });

    it('belegt alle Felder vor, auch Auswahlfelder und abhängige Felder', async () => {
      const { feld, el } = await offen();
      expect(feld('anbieter').value).toBe('Anbieter');
      expect(feld('kategorieId').value).toBe('k2');
      expect(feld('betrag').value).toBe('586,80');
      expect(feld('zahlweise').value).toBe('MONATLICH');
      expect(feld('abbuchungAb').value).toBe('2026-11-30');
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

    it('schickt ohne Änderung den gespeicherten Anker', async () => {
      const { fixture, el, host } = await offen();
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      expect(host.gespeichert[0]).toMatchObject({
        abbuchungAb: '2026-01-31',
        kuendigungsfristMonate: 4,
        preise: [{ gueltigAb: null, betrag: { wert: 586.8, waehrung: 'USD' } }],
      });
    });

    it('zeigt den Hinweis nur, solange die Zahlweise geändert ist', async () => {
      const { el, feld, setzen } = await offen();
      const hinweis = 'Bitte Datum der nächsten Abbuchung im neuen Rhythmus prüfen.';
      expect(el.textContent).not.toContain(hinweis);

      await setzen('zahlweise', 'JAEHRLICH');
      expect(el.textContent).toContain(hinweis);
      const ids = feld('abbuchungAb').getAttribute('aria-describedby')!;
      expect(document.getElementById(ids)?.textContent?.trim()).toBe(hinweis);

      await setzen('zahlweise', 'MONATLICH');
      expect(el.textContent).not.toContain(hinweis);
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
      const { feld, el } = await offen({
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
      expect(el.textContent).toContain('Erhöhung in $ *');
      const art = feld('steigerungsart') as unknown as HTMLSelectElement;
      expect(art.selectedOptions[0].text).toBe('US-Dollar');
    });

    describe('Preise', () => {
      const USD = (wert: number) => ({ wert, waehrung: 'USD' });
      const MIT_PREISEN: VertragAntwort = {
        ...VERTRAG,
        betrag: USD(20),
        preise: [
          { gueltigAb: null, betrag: USD(10), art: 'FRUEHER' },
          { gueltigAb: '2026-01-01', betrag: USD(20), art: 'AKTUELL' },
          { gueltigAb: '2027-01-01', betrag: USD(25), art: 'ANGEKUENDIGT' },
        ],
      };
      const zeilen = (el: HTMLElement) =>
        [...el.querySelectorAll('.preis')].map((zeile) =>
          [...zeile.querySelectorAll('input')].map((input) => input.value),
        );

      it('trennt den aktuellen Preis von den übrigen und schickt sie in dieser Reihenfolge', async () => {
        const { fixture, el, feld, host } = await offen(MIT_PREISEN);
        expect(feld('betrag').value).toBe('20,00');
        expect(feld('gueltigSeit').value).toBe('2026-01-01');
        expect(zeilen(el)).toEqual([
          ['', '10,00'],
          ['2027-01-01', '25,00'],
        ]);
        el.querySelector('form')!.dispatchEvent(new Event('submit'));
        await fixture.whenStable();
        expect(host.gespeichert[0].preise).toEqual([
          { gueltigAb: '2026-01-01', betrag: USD(20) },
          { gueltigAb: null, betrag: USD(10) },
          { gueltigAb: '2027-01-01', betrag: USD(25) },
        ]);
      });

      it('„Preis hinzufügen“ der Details: Tab Preise, leere Zeile mit Fokus, nicht ungespeichert', async () => {
        const { el, fixture } = await offen(VERTRAG, true);
        await fixture.whenStable();
        const aktiv = el.querySelector('[role="tab"][aria-selected="true"]');
        expect(aktiv?.textContent?.trim()).toBe('Preise');
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
