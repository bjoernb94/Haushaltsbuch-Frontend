import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, Subject } from 'rxjs';
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

const KATEGORIEN: VertragKategorieAntwort[] = [
  { id: 'k1', schluessel: 'VERSICHERUNG', name: null },
  { id: 'k2', schluessel: null, name: 'Eigene Kategorie' },
];

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
        anfragen[i].next({ kuendigung });
        anfragen[i].complete();
      };
      const zeile = () => {
        TestBed.tick();
        return hilfen.el.querySelector('.vorschau')?.textContent?.replace(/\s+/g, ' ').trim();
      };
      return { ...hilfen, antworten, zeile };
    }

    it('fragt beim Öffnen sofort und nur nach den Werten für den Termin', async () => {
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
      setzen('betrag', '19,99');
      setzen('notiz', 'Notiz');
      vi.advanceTimersByTime(1000);
      expect(vorschau).not.toHaveBeenCalled();
    });

    it('ein veraltetes Ergebnis überschreibt kein neueres, die alte Anfrage wird abgebrochen', async () => {
      const { setzen, zeile, antworten } = await offen();
      antworten(0, ERGEBNIS);
      setzen('laufzeitende', '2027-01-01');
      vi.advanceTimersByTime(400);
      const alte = anfragen[1];
      setzen('laufzeitende', '2027-02-01');
      expect(alte.observed).toBe(false);
      alte.next({ kuendigung: { ...ERGEBNIS, kuendigenBis: '2000-01-01' } });
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

    it('„Nicht kündbar“ blendet die Zeile aus und fragt nicht, zurück fragt es wieder', async () => {
      const { feld, zeile, antworten } = await offen();
      antworten(0, ERGEBNIS);
      vorschau.mockClear();
      feld('nichtKuendbar').click();
      expect(zeile()).toBeUndefined();
      vi.advanceTimersByTime(1000);
      expect(vorschau).not.toHaveBeenCalled();

      feld('nichtKuendbar').click();
      expect(zeile()).toBe('Nächster Kündigungstermin:–');
      vi.advanceTimersByTime(400);
      expect(vorschau).toHaveBeenCalledOnce();
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
      betrag: { wert: 19.99, waehrung: 'EUR' },
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
      validierung(['betrag.wert', 'PositiverBetrag'], ['laufzeitende', 'LaufzeitendeNachBeginn']),
    );
    await fixture.whenStable();
    expect(box()).toBe('Bitte prüfe die markierten Felder.');
    expect(fehlerText('betrag')).toBe('Der Betrag muss größer als 0 sein.');
    expect(fehlerText('laufzeitende')).toBe('Das Laufzeitende liegt vor dem Vertragsbeginn.');
    expect(document.activeElement).toBe(feld('betrag'));
  });

  it('entfernt beim Ändern nur den Fehler dieses Feldes, die Box erst mit dem letzten', async () => {
    const { host, fixture, setzen, fehlerText, box } = await erstellen();
    host.fehler.set(validierung(['anbieter', 'NotBlank'], ['betrag', 'NotNull']));
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

  it('meldet Abbrechen', async () => {
    const { host, el } = await erstellen();
    el.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
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

  describe('zum Bearbeiten', () => {
    const VERTRAG: VertragAntwort = {
      id: 'v1',
      version: 4,
      anbieter: 'Anbieter',
      bezeichnung: 'Kfz',
      kategorie: KATEGORIEN[1],
      vertragsnummer: null,
      betrag: { wert: 586.8, waehrung: 'USD' },
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
        kostenProJahr: { wert: 7041.6, waehrung: 'USD' },
        naechsteAbbuchung: '2026-11-30',
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
        (speichern)="gespeichert.push($event)"
      />`,
    })
    class BearbeitenHost {
      readonly kategorien = KATEGORIEN;
      readonly vertrag = signal<VertragAntwort>(VERTRAG);
      readonly gespeichert: Required<VertragEingabe>[] = [];
    }

    async function offen(vertrag: VertragAntwort = VERTRAG) {
      const fixture = TestBed.createComponent(BearbeitenHost);
      fixture.componentInstance.vertrag.set(vertrag);
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
        betrag: { wert: 586.8, waehrung: 'USD' },
      });
    });

    it('zeigt den Hinweis nur, solange die Zahlweise geändert ist', async () => {
      const { el, feld, setzen } = await offen();
      const hinweis = 'Bitte Datum der nächsten Abbuchung im neuen Rhythmus prüfen.';
      expect(el.textContent).not.toContain(hinweis);

      await setzen('zahlweise', 'JAEHRLICH');
      expect(el.textContent).toContain(hinweis);
      const ids = feld('abbuchungAb').getAttribute('aria-describedby')!;
      expect(document.getElementById(ids)?.textContent).toBe(hinweis);

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
