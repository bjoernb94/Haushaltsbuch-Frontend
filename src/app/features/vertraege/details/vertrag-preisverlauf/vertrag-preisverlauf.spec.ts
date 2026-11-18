import { Component, LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Preispunkt } from '../../../../core/api/api';
import { VertragPreisverlauf } from './vertrag-preisverlauf';

const EUR = (wert: number) => ({ wert, waehrung: 'EUR' });

@Component({
  imports: [VertragPreisverlauf],
  template: `<app-vertrag-preisverlauf [punkte]="punkte()" [heute]="heute()" />`,
})
class Host {
  readonly punkte = signal<Preispunkt[]>([]);
  readonly heute = signal('2026-11-15');
}

async function zeichnen(punkte: Preispunkt[], heute = '2026-11-15') {
  TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'de-DE' }] });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.punkte.set(punkte);
  fixture.componentInstance.heute.set(heute);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const text = (selektor: string) =>
    [...el.querySelectorAll(selektor)].map((e) => e.textContent?.replace(/\s/g, ' ').trim());
  const pfad = (klasse: string) => el.querySelector(`path.${klasse}`)?.getAttribute('d') ?? '';
  const links = (e: Element) => parseFloat((e as HTMLElement).style.left);
  return { el, text, pfad, links };
}

describe('VertragPreisverlauf', () => {
  const ZWEI: Preispunkt[] = [
    { ab: '2025-01-01', betrag: EUR(10), art: 'GEZAHLT' },
    { ab: '2027-01-01', betrag: EUR(12.5), art: 'ANGEKUENDIGT' },
  ];

  it('beschreibt alle Punkte als Textalternative', async () => {
    const { el } = await zeichnen([
      ...ZWEI,
      { ab: '2028-01-01', betrag: EUR(12.81), art: 'PROGNOSE' },
    ]);
    const label = el.querySelector('[role="img"]')?.getAttribute('aria-label');
    expect(label?.replace(/\s/g, ' ')).toBe(
      'Preisverlauf: ab 01.01.2025 10,00 €, ab 01.01.2027 12,50 € (angekündigt), ' +
        'ab 01.01.2028 12,81 € (Prognose)',
    );
  });

  it('zwei Punkte: Achse mit höchstem und kleinstem Preis, durchgezogen bis heute', async () => {
    const { text, pfad, el, links } = await zeichnen(ZWEI);
    expect(text('.achse')).toEqual(['12,50 €', '10,00 €']);
    expect(text('.jahr')).toEqual(['2026', '2027']);
    // Treppe: gezahlt bis heute auf 10 €, danach gestrichelt mit Stufe am 01.01.2027.
    expect(pfad('linie:not(.zukunft)')).toMatch(/^M0 135 L[\d.]+ 135$/);
    expect(pfad('zukunft').split(' L')).toHaveLength(4);
    const punkte = [...el.querySelectorAll('.punkt')];
    expect(punkte.map((p) => p.classList.contains('gezahlt'))).toEqual([true, false]);
    expect(links(punkte[0])).toBe(0);
    expect(links(el.querySelector('.heute-text')!)).toBeGreaterThan(0);
    expect(links(el.querySelector('.heute-text')!)).toBeLessThan(links(punkte[1]));
  });

  it('gleiche Preise: flache Linie in der Mitte, Achse mit Abstand darüber und darunter', async () => {
    const { text, pfad } = await zeichnen([
      { ab: '2025-01-01', betrag: EUR(10), art: 'GEZAHLT' },
      { ab: '2026-01-01', betrag: EUR(10), art: 'GEZAHLT' },
    ]);
    expect(text('.achse')).toEqual(['11,00 €', '9,00 €']);
    expect(pfad('linie:not(.zukunft)')).toContain(' 77.5');
  });

  it('viele Punkte über Jahre: höchstens sechs Jahre an der Achse, alle Punkte gezeichnet', async () => {
    const punkte: Preispunkt[] = Array.from({ length: 40 }, (_, i) => ({
      ab: `${2000 + Math.floor(i / 2)}-0${(i % 2) * 6 + 1}-01`,
      betrag: EUR(10 + i),
      art: i < 38 ? 'GEZAHLT' : 'PROGNOSE',
    }));
    const { text, el } = await zeichnen(punkte, '2019-03-01');
    const jahre = text('.jahr');
    expect(jahre.length).toBeGreaterThan(1);
    expect(jahre.length).toBeLessThanOrEqual(6);
    expect(el.querySelectorAll('.punkt')).toHaveLength(40);
    expect(text('.achse')).toEqual(['49,00 €', '10,00 €']);
  });

  it('„heute“ liegt nie vor dem letzten gezahlten Preis', async () => {
    // Die Uhr des Browsers geht nach: Die Linie springt nicht vor den gezahlten Punkt.
    const { el, links } = await zeichnen(
      [
        { ab: '2025-01-01', betrag: EUR(10), art: 'GEZAHLT' },
        { ab: '2026-11-16', betrag: EUR(11), art: 'GEZAHLT' },
        { ab: '2027-01-01', betrag: EUR(12), art: 'PROGNOSE' },
      ],
      '2026-11-15',
    );
    const punkte = [...el.querySelectorAll('.punkt')];
    expect(links(el.querySelector('.heute-text')!)).toBe(links(punkte[1]));
  });
});
