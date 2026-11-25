import { HttpErrorResponse } from '@angular/common/http';
import { Component, LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  Betrag,
  Kuendigung,
  VertragAntwort,
  VertragKategorieAntwort,
  VertragPreisAntwort,
  VertragVorschauAnfrage,
  VertragVorschauAntwort,
} from '../../../core/api/api';
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
];

const EUR = (wert: number): Betrag => ({ wert, waehrung: 'EUR' });

function antwort(mehr: Partial<VertragVorschauAntwort> = {}): VertragVorschauAntwort {
  return {
    betrag: null,
    eigenerAnteil: null,
    einmalkosten: null,
    kostenProMonat: null,
    naechstePreisaenderung: null,
    preise: [],
    prognose: [],
    kuendigung: KEINE,
    vorschlagNaechsteAm: null,
    ...mehr,
  };
}

function preis(
  gueltigAb: string,
  wert: number,
  automatisch = false,
  art: VertragPreisAntwort['art'] = 'FRUEHER',
): VertragPreisAntwort {
  return { gueltigAb, betrag: EUR(wert), art, automatisch };
}

/** Vertrag ab 2021 mit jährlich 2 % und den automatischen Stufen bis 2026. */
const VERTRAG: VertragAntwort = {
  id: 'v1',
  version: 1,
  anbieter: 'Versicherung',
  bezeichnung: null,
  kategorie: KATEGORIEN[0],
  vertragsnummer: null,
  betrag: EUR(110.4),
  betragErrechnet: false,
  preise: [
    preis('2021-03-01', 100),
    preis('2022-03-01', 102, true),
    preis('2023-03-01', 104.04, true),
    preis('2024-03-01', 106.12, true),
    preis('2025-03-01', 108.24, true),
    preis('2026-03-01', 110.4, true, 'AKTUELL'),
  ],
  anteilProzent: null,
  einmalkosten: [],
  preissteigerung: {
    art: 'PROZENT',
    prozent: 2,
    betrag: null,
    rhythmus: 'JAEHRLICH',
    naechsteAm: '2022-03-01',
  },
  preissteigerungBetrachtetBis: '2026-11-22',
  preisgarantieBis: null,
  erinnerungSonderkuendigung: true,
  zahlweise: 'MONATLICH',
  zahlungsweg: null,
  kuendbar: true,
  beginn: '2021-03-01',
  laufzeitende: null,
  verlaengerung: null,
  kuendigungsfristMonate: null,
  gekuendigtZum: null,
  notiz: null,
  unterbrechungen: [],
  berechnet: {
    aktuellerBeginn: '2021-03-01',
    wiederaufnahme: null,
    status: 'AKTIV',
    kostenProMonat: EUR(110.4),
    kostenImJahr: EUR(1324.8),
    kostenImJahrMitPrognose: false,
    jahr: 2026,
    eigenerAnteil: null,
    einmalkosten: EUR(0),
    naechstePreisaenderung: null,
    preisverlauf: [],
    prognose: [],
    vertragsende: null,
    kuendigung: KEINE,
  },
};

@Component({
  imports: [VertragFormular],
  template: `<app-vertrag-formular
    [vertrag]="vertrag()"
    [kategorien]="kategorien"
    [fehlerAntwort]="fehler()"
    (speichern)="gespeichert.push($event)"
  />`,
})
class Host {
  readonly kategorien = KATEGORIEN;
  readonly vertrag = signal<VertragAntwort | null>(null);
  readonly fehler = signal<unknown>(null);
  readonly gespeichert: Required<VertragEingabe>[] = [];
}

describe('VertragFormular: Preissteigerung und automatische Preise', () => {
  let anfragen: { anfrage: VertragVorschauAnfrage; antwort: Subject<VertragVorschauAntwort> }[];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    anfragen = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: LOCALE_ID, useValue: 'de-DE' },
        {
          provide: VertragService,
          useValue: {
            vorschau: (anfrage: VertragVorschauAnfrage) => {
              const antwort = new Subject<VertragVorschauAntwort>();
              anfragen.push({ anfrage, antwort });
              return antwort;
            },
          },
        },
      ],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  async function offen(vertrag: VertragAntwort | null = null) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.vertrag.set(vertrag);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[3].click();
    const tick = () => {
      vi.advanceTimersByTime(500);
      TestBed.tick();
    };
    tick();
    const feld = (name: string) =>
      el.querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
    const setzen = (name: string, wert: string) => {
      const control = feld(name);
      control.value = wert;
      control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
      tick();
    };
    /** Beantwortet die letzte Anfrage. */
    const antworten = (mehr: Partial<VertragVorschauAntwort>) => {
      anfragen.at(-1)!.antwort.next(antwort(mehr));
      tick();
    };
    const text = (selektor: string) =>
      [...el.querySelectorAll(selektor)].map((e) => e.textContent?.replace(/\s+/g, ' ').trim());
    return { fixture, el, host: fixture.componentInstance, feld, setzen, antworten, text, tick };
  }

  describe('Termin der ersten Erhöhung', () => {
    it('übernimmt den Vorschlag der Vorschau und folgt ihm, bis der Nutzer selbst ein Datum einträgt', async () => {
      const { feld, setzen, antworten, text } = await offen();
      feld('steigt').click();
      setzen('beginn', '2021-03-01');
      antworten({ vorschlagNaechsteAm: '2022-03-01' });
      expect(feld('naechsteErhoehungAm').value).toBe('2022-03-01');
      expect(text('label[for$="naechsteErhoehungAm"]')).toEqual(['Erste Erhöhung am *']);
      expect(text('[id$="naechsteErhoehungAm-hinweis"]')).toEqual([
        'Danach im gewählten Rhythmus.',
      ]);

      setzen('beginn', '2021-04-01');
      antworten({ vorschlagNaechsteAm: '2022-04-01' });
      expect(feld('naechsteErhoehungAm').value).toBe('2022-04-01');
      expect(anfragen.at(-1)!.anfrage.preissteigerung?.naechsteAm).toBe('2022-04-01');

      setzen('naechsteErhoehungAm', '2023-01-01');
      setzen('beginn', '2021-05-01');
      antworten({ vorschlagNaechsteAm: '2022-05-01' });
      expect(feld('naechsteErhoehungAm').value).toBe('2023-01-01');
      expect(text('.termin-hinweis span')).toEqual([
        'Der Vertragsbeginn hat sich geändert. Prüfe, ob die erste Erhöhung noch stimmt.',
      ]);
    });

    it('ein geleertes Feld folgt wieder dem Vorschlag', async () => {
      const { feld, setzen, antworten, tick } = await offen();
      feld('steigt').click();
      tick();
      setzen('naechsteErhoehungAm', '2023-01-01');
      setzen('beginn', '2021-03-01');
      antworten({ vorschlagNaechsteAm: '2022-03-01' });
      expect(feld('naechsteErhoehungAm').value).toBe('2023-01-01');

      setzen('naechsteErhoehungAm', '');
      antworten({ vorschlagNaechsteAm: '2022-03-01' });
      expect(feld('naechsteErhoehungAm').value).toBe('2022-03-01');
    });

    it('beim Bearbeiten bleibt der gespeicherte Termin; nach geändertem Beginn ein Hinweis mit Vorschlag', async () => {
      const { el, feld, setzen, antworten, text } = await offen(VERTRAG);
      antworten({ vorschlagNaechsteAm: '2022-03-01' });
      expect(el.querySelector('.termin-hinweis')).toBeNull();

      setzen('beginn', '2021-01-15');
      antworten({ vorschlagNaechsteAm: '2022-01-15' });
      expect(feld('naechsteErhoehungAm').value).toBe('2022-03-01');
      expect(text('.termin-hinweis button')).toEqual(['Vorschlag übernehmen (15.01.2022)']);
      expect(feld('naechsteErhoehungAm').getAttribute('aria-describedby')).toContain(
        'naechsteErhoehungAm-beginn',
      );

      el.querySelector<HTMLButtonElement>('.termin-hinweis button')!.click();
      TestBed.tick();
      expect(feld('naechsteErhoehungAm').value).toBe('2022-01-15');
      expect(el.querySelector('.termin-hinweis')).toBeNull();
    });

    it('kein Hinweis, wenn der Beginn wieder der gespeicherte ist', async () => {
      const { el, setzen, antworten } = await offen(VERTRAG);
      setzen('beginn', '2021-01-15');
      antworten({ vorschlagNaechsteAm: '2022-01-15' });
      expect(el.querySelector('.termin-hinweis')).not.toBeNull();
      setzen('beginn', '2021-03-01');
      antworten({ vorschlagNaechsteAm: '2022-03-01' });
      expect(el.querySelector('.termin-hinweis')).toBeNull();
    });
  });

  describe('automatische Preise', () => {
    it('schickt das Kennzeichen unverändert zurück und den Stand der betrachteten Termine an die Vorschau', async () => {
      const { el, host, fixture } = await offen(VERTRAG);
      expect(anfragen[0].anfrage.preissteigerungBetrachtetBis).toBe('2026-11-22');
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      expect(host.gespeichert[0].preise).toEqual([
        { gueltigAb: '2021-03-01', betrag: EUR(100) },
        { gueltigAb: '2022-03-01', betrag: EUR(102), automatisch: true },
        { gueltigAb: '2023-03-01', betrag: EUR(104.04), automatisch: true },
        { gueltigAb: '2024-03-01', betrag: EUR(106.12), automatisch: true },
        { gueltigAb: '2025-03-01', betrag: EUR(108.24), automatisch: true },
        { gueltigAb: '2026-03-01', betrag: EUR(110.4), automatisch: true },
      ]);
    });

    it('klappt ab fünf automatische Preise zusammen, auf Wunsch auf', async () => {
      const { el, text, tick } = await offen(VERTRAG);
      const zeilen = () => el.querySelectorAll('.preis:not(.erster)').length;
      expect(text('.gruppe-umschalten')).toEqual(['5 automatische Preise, 2022–2026']);
      expect(el.querySelector('.gruppe-umschalten')?.getAttribute('aria-expanded')).toBe('false');
      expect(zeilen()).toBe(0);

      el.querySelector<HTMLButtonElement>('.gruppe-umschalten')!.click();
      tick();
      expect(el.querySelector('.gruppe-umschalten')?.getAttribute('aria-expanded')).toBe('true');
      expect(zeilen()).toBe(5);
      expect(text('.preis .etikett')).toEqual(Array(5).fill('automatisch'));
    });

    it('eine Gruppe mit Fehler ist aufgeklappt', async () => {
      const { el, host, tick } = await offen(VERTRAG);
      host.fehler.set(
        new HttpErrorResponse({
          status: 400,
          error: {
            code: 'VALIDIERUNG',
            felder: [{ feld: 'preise[3].gueltigAb', code: 'PreisNichtVorBeginn', parameter: {} }],
          },
        }),
      );
      tick();
      expect(el.querySelector('.gruppe-umschalten')?.getAttribute('aria-expanded')).toBe('true');
      expect(el.querySelectorAll('.preis:not(.erster)')).toHaveLength(5);
      expect(el.querySelector('.preis:not(.erster) .feldfehler')?.textContent?.trim()).toBe(
        'Ein Preis kann nicht vor dem Vertragsbeginn gelten.',
      );
    });

    it('ein geänderter automatischer Preis verliert das Kennzeichen, dazu ein Hinweis', async () => {
      const { el, text, tick, antworten } = await offen(VERTRAG);
      el.querySelector<HTMLButtonElement>('.gruppe-umschalten')!.click();
      tick();
      const betrag = el.querySelectorAll<HTMLInputElement>(
        '.preis:not(.erster) [formcontrolname="betrag"]',
      )[1];
      betrag.value = '107,00';
      betrag.dispatchEvent(new Event('input'));
      tick();
      expect(text('.preis .etikett')).toHaveLength(4);
      expect(text('.preis:not(.erster) > .feldhinweis')).toEqual([
        'Spätere automatische Preise bleiben unverändert.',
      ]);
      expect(betrag.getAttribute('aria-describedby')).toContain('-preise-1-hinweis');

      // Eingeklappt steht das Etikett der Vorschau an der Gruppe, aufgeklappt an der Zeile.
      const vorschauPreis = (p: VertragPreisAntwort) => ({ ...p, neu: false });
      antworten({
        preise: VERTRAG.preise.map((p) =>
          vorschauPreis(p.gueltigAb === '2026-03-01' ? { ...p, art: 'AKTUELL' } : p),
        ),
      });
      expect(text('.preis:not(.erster) .etikett.aktuell')).toEqual(['aktuell']);
      el.querySelector<HTMLButtonElement>('.gruppe-umschalten')!.click();
      tick();
      expect(text('.gruppe-umschalten')).toEqual([
        '5 automatische Preise, 2022–2026 · aktuell 110,40 €',
      ]);
    });

    it('weist bei geänderter Regel darauf hin, dass angelegte Preise bleiben', async () => {
      const { el, setzen, text } = await offen(VERTRAG);
      expect(el.querySelector('.regel-hinweis')).toBeNull();
      setzen('steigerungswert', '3');
      expect(text('.regel-hinweis')).toEqual([
        'Gilt für künftige Erhöhungen. Bereits angelegte Preise bleiben unverändert.',
      ]);
      setzen('steigerungswert', '2');
      expect(el.querySelector('.regel-hinweis')).toBeNull();
    });

    it('ohne automatische Preise kein Hinweis zur Regel', async () => {
      const { el, setzen } = await offen({
        ...VERTRAG,
        preise: [preis('2021-03-01', 100, false, 'AKTUELL')],
      });
      setzen('steigerungswert', '3');
      expect(el.querySelector('.regel-hinweis')).toBeNull();
    });
  });
});
