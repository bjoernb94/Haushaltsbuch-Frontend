import { HttpErrorResponse } from '@angular/common/http';
import { Component, LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER } from 'rxjs';
import { VertragAntwort, VertragVorschauAnfrage } from '../../../../core/api/api';
import { UngespeicherteEingaben } from '../../../../core/ungespeichert/ungespeicherte-eingaben';
import { VertragService } from '../../vertrag.service';
import { VertragFormular } from '../vertrag-formular';
import { VertragSpeichern } from '../vertrag-pruefung';

// Unterbrechungen im Formular „Vertrag bearbeiten“: entfernen erst beim Sichern, bis dahin
// rückgängig zu machen; die Vorschau rechnet mit den verbleibenden.

const EUR = (wert: number) => ({ wert, waehrung: 'EUR' });

const SOMMER = { id: 'u1', von: '2025-06-01', bis: '2025-08-31', art: 'KUENDIGUNG' } as const;
const WINTER = { id: 'u2', von: '2025-12-01', bis: '2026-01-31', art: 'KUENDIGUNG' } as const;

const VERTRAG: VertragAntwort = {
  id: 'v1',
  version: 3,
  anbieter: 'Musikdienst',
  bezeichnung: null,
  kategorie: { id: 'k1', schluessel: 'STREAMING_ABOS', name: null },
  vertragsnummer: null,
  betrag: EUR(10.99),
  betragErrechnet: false,
  preise: [{ gueltigAb: '2023-04-01', betrag: EUR(10.99), art: 'AKTUELL', automatisch: false }],
  anteilProzent: null,
  einmalkosten: [],
  preissteigerung: null,
  preissteigerungBetrachtetBis: null,
  preisgarantieBis: null,
  erinnerungSonderkuendigung: false,
  zahlweise: 'MONATLICH',
  zahlungsweg: null,
  kuendbar: true,
  beginn: '2023-04-01',
  laufzeitende: null,
  verlaengerung: 'ZAHLUNGSINTERVALL',
  kuendigungsfristMonate: 0,
  gekuendigtZum: null,
  notiz: null,
  unterbrechungen: [SOMMER, WINTER],
  berechnet: {
    status: 'AKTIV',
    aktuellerBeginn: '2026-02-01',
    kostenProMonat: EUR(10.99),
    kostenImJahr: EUR(131.88),
    kostenImJahrMitPrognose: false,
    jahr: 2026,
    eigenerAnteil: null,
    einmalkosten: EUR(0),
    naechstePreisaenderung: null,
    preisverlauf: [],
    prognose: [],
    vertragsende: null,
    wiederaufnahme: null,
    kuendigung: {
      art: 'MONATLICH_KUENDBAR',
      dringend: false,
      fristMonate: 0,
      kuendigenBis: null,
      zum: '2026-12-31',
    },
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
  readonly kategorien = [VERTRAG.kategorie];
  readonly vertrag = signal<VertragAntwort | null>(VERTRAG);
  readonly fehler = signal<unknown>(null);
  readonly gespeichert: VertragSpeichern[] = [];
}

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

describe('Unterbrechungen im Formular', () => {
  const vorschau = vi.fn<(a: VertragVorschauAnfrage) => unknown>();

  beforeEach(() => {
    vorschau.mockReset();
    vorschau.mockReturnValue(NEVER);
    TestBed.configureTestingModule({
      providers: [
        { provide: VertragService, useValue: { vorschau } },
        { provide: LOCALE_ID, useValue: 'de-DE' },
      ],
    });
  });
  afterEach(() => {
    TestBed.inject(UngespeicherteEingaben).melden(false);
    document.body.replaceChildren();
  });

  async function offen(vertrag: VertragAntwort | null = VERTRAG) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.vertrag.set(vertrag);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    // Im Tab Laufzeit, wie man dorthin käme; die Vorschau beim Öffnen kommt nach einem Timer.
    [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((tab) => text(tab)?.startsWith('Laufzeit'))
      ?.click();
    await new Promise((fertig) => setTimeout(fertig));
    await fixture.whenStable();
    const abschnitt = () => el.querySelector<HTMLElement>('fieldset.unterbrechungen');
    const knopf = (label: string) =>
      el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    const klicken = async (button: HTMLButtonElement | null | undefined) => {
      button!.click();
      await fixture.whenStable();
    };
    const rueckgaengig = () =>
      [...el.querySelectorAll<HTMLButtonElement>('.entfernt button')].map((b) => b);
    const absenden = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return { fixture, el, abschnitt, knopf, klicken, rueckgaengig, absenden };
  }

  it('zeigt die Unterbrechungen mit Hinweis und „Entfernen“ im Tab Laufzeit', async () => {
    const { abschnitt, knopf } = await offen();
    expect(text(abschnitt()?.querySelector('legend'))).toBe('Unterbrechungen');
    expect(text(abschnitt()?.querySelector('.feldhinweis'))).toBe(
      'Darin wird nichts abgebucht. Entfernst du eine, zählt der Vertrag dort als durchgehend gelaufen.',
    );
    expect([...abschnitt()!.querySelectorAll('li .zeitraum')].map(text)).toEqual([
      '01.06.2025 – 31.08.2025',
      '01.12.2025 – 31.01.2026',
    ]);
    expect(text(abschnitt()?.querySelector('li .art'))).toBe(
      'Gekündigt, danach wieder aufgenommen',
    );
    expect(knopf('Unterbrechung 01.06.2025 – 31.08.2025 entfernen')).not.toBeNull();
  });

  it('fehlt ohne Unterbrechungen und bei einem neuen Vertrag', async () => {
    const ohne = await offen({ ...VERTRAG, unterbrechungen: [] });
    expect(ohne.abschnitt()).toBeNull();
    document.body.replaceChildren();
    const neu = await offen(null);
    expect(neu.abschnitt()).toBeNull();
  });

  it('Entfernen merkt vor, Rückgängig nimmt es zurück; beides zählt als Änderung', async () => {
    const { abschnitt, knopf, klicken, rueckgaengig } = await offen();
    const ungespeichert = TestBed.inject(UngespeicherteEingaben);
    expect(ungespeichert.vorhanden()).toBe(false);

    await klicken(knopf('Unterbrechung 01.06.2025 – 31.08.2025 entfernen'));
    expect([...abschnitt()!.querySelectorAll('li .zeitraum')].map(text)).toEqual([
      '01.12.2025 – 31.01.2026',
    ]);
    const hinweis = abschnitt()!.querySelector('.entfernt')!;
    expect(hinweis.getAttribute('role')).toBe('status');
    expect(text(hinweis)).toBe(
      'Unterbrechung 01.06.2025 – 31.08.2025 wird beim Sichern entfernt. Rückgängig',
    );
    expect(ungespeichert.vorhanden()).toBe(true);
    expect(document.activeElement).toBe(rueckgaengig()[0]);

    await klicken(rueckgaengig()[0]);
    expect(abschnitt()!.querySelectorAll('li')).toHaveLength(2);
    expect(abschnitt()!.querySelector('.entfernt')).toBeNull();
    expect(ungespeichert.vorhanden()).toBe(false);
    expect(document.activeElement).toBe(knopf('Unterbrechung 01.06.2025 – 31.08.2025 entfernen'));
  });

  it('Sichern schickt die verbleibenden als unterbrechungIds', async () => {
    const { fixture, knopf, klicken, absenden } = await offen();
    await absenden();
    await klicken(knopf('Unterbrechung 01.12.2025 – 31.01.2026 entfernen'));
    await absenden();
    expect(fixture.componentInstance.gespeichert.map((e) => e.unterbrechungIds)).toEqual([
      ['u1', 'u2'],
      ['u1'],
    ]);
  });

  it('die Vorschau rechnet mit den verbleibenden', async () => {
    const { knopf, klicken } = await offen();
    expect(vorschau.mock.lastCall?.[0].unterbrechungen).toEqual([
      { von: '2025-06-01', bis: '2025-08-31', art: 'KUENDIGUNG' },
      { von: '2025-12-01', bis: '2026-01-31', art: 'KUENDIGUNG' },
    ]);
    await klicken(knopf('Unterbrechung 01.06.2025 – 31.08.2025 entfernen'));
    await new Promise((fertig) => setTimeout(fertig, 450));
    expect(vorschau.mock.lastCall?.[0].unterbrechungen).toEqual([
      { von: '2025-12-01', bis: '2026-01-31', art: 'KUENDIGUNG' },
    ]);
  });

  it('Fehler zu den Unterbrechungen nennen die verbleibenden', async () => {
    const { fixture, el, knopf, klicken } = await offen();
    await klicken(knopf('Unterbrechung 01.12.2025 – 31.01.2026 entfernen'));
    fixture.componentInstance.fehler.set(
      new HttpErrorResponse({
        status: 400,
        error: {
          code: 'VALIDIERUNG',
          felder: [
            { feld: 'beginn', code: 'BeginnVorUnterbrechung', parameter: {} },
            { feld: 'laufzeitende', code: 'LaufzeitendeNachAktuellemBeginn', parameter: {} },
            { feld: 'gekuendigtZum', code: 'KuendigungNachUnterbrechung', parameter: {} },
            { feld: 'unterbrechungIds[0]', code: 'Unbekannt', parameter: {} },
          ],
        },
      }),
    );
    await fixture.whenStable();
    const texte = [...el.querySelectorAll('.feldfehler')].map(text);
    expect(texte).toContain(
      'Der Vertragsbeginn muss vor der ersten Unterbrechung (ab 01.06.2025) liegen.',
    );
    expect(texte).toContain(
      'Das Laufzeitende muss nach der letzten Unterbrechung (bis 31.08.2025) liegen.',
    );
    expect(texte).toContain('Diese Unterbrechung gibt es nicht mehr. Lade den Vertrag neu.');
  });
});
