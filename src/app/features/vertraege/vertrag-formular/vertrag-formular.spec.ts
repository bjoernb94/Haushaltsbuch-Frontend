import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { VertragKategorieAntwort } from '../../../core/api/api';
import { VertragEingabe } from '../vertrag.service';
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
  afterEach(() => document.body.replaceChildren());

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
});
