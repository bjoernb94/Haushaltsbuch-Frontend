import { computed, LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ProfilAntwort } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { Benachrichtigungen } from '../../core/benachrichtigungen/benachrichtigungen';
import { Glocke } from './glocke';

const MAX: ProfilAntwort = { vorname: 'Max', name: 'Muster', email: 'max@beispiel.de' };

describe('Glocke', () => {
  const nutzer = signal<ProfilAntwort | null>(MAX);

  beforeEach(() => {
    sessionStorage.clear();
    nutzer.set(MAX);
    TestBed.configureTestingModule({
      imports: [Glocke],
      providers: [
        provideRouter([{ path: 'vertraege/:id', children: [] }]),
        { provide: LOCALE_ID, useValue: 'de-DE' },
        { provide: AuthService, useValue: { nutzer, angemeldet: computed(() => !!nutzer()) } },
      ],
    });
  });

  /** Wie im echten Ablauf: geschlossen = gelesen, abgelaufen = ungelesen. */
  function eintraege(b: Benachrichtigungen, ungelesen: number, gelesen: number) {
    for (let i = 0; i < gelesen; i++) {
      b.melden({ art: 'fehler', titel: `Gelesen ${i}` });
      b.schliessen(b.toasts()[0].id);
    }
    vi.useFakeTimers();
    for (let i = 0; i < ungelesen; i++) {
      b.melden({ art: 'erfolg', titel: `Neu ${i}` });
      vi.advanceTimersByTime(5000);
    }
    vi.useRealTimers();
  }

  async function glocke(ungelesen = 0, gelesen = 0) {
    const b = TestBed.inject(Benachrichtigungen);
    eintraege(b, ungelesen, gelesen);
    const fixture = TestBed.createComponent(Glocke);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const stabil = () => fixture.whenStable();
    return {
      fixture,
      element,
      b,
      stabil,
      knopf: () => element.querySelector<HTMLButtonElement>('button.glocke')!,
      panel: () => element.querySelector<HTMLElement>('[role="dialog"]'),
      oeffnen: async () => {
        element.querySelector<HTMLButtonElement>('button.glocke')!.click();
        await stabil();
      },
      schaltflaeche: (text: string) =>
        [...element.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
          (k) => k.textContent?.trim() === text || k.getAttribute('aria-label') === text,
        )!,
    };
  }

  it('zeigt ohne Ungelesene keinen Zähler', async () => {
    const { element, knopf } = await glocke(0, 1);
    expect(element.querySelector('.zaehler')).toBeNull();
    expect(knopf().getAttribute('aria-label')).toBe('Benachrichtigungen');
  });

  it('zählt Ungelesene, ab 10 als „9+“', async () => {
    let g = await glocke(3);
    expect(g.element.querySelector('.zaehler')?.textContent).toBe('3');
    expect(g.knopf().getAttribute('aria-label')).toBe('Benachrichtigungen, 3 ungelesen');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Glocke],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { nutzer, angemeldet: computed(() => !!nutzer()) } },
      ],
    });
    sessionStorage.clear();
    g = await glocke(12);
    expect(g.element.querySelector('.zaehler')?.textContent).toBe('9+');
  });

  it('öffnet das Center mit Fokus und schließt mit Esc zurück zur Glocke', async () => {
    const { knopf, panel, oeffnen, stabil } = await glocke(1);
    await oeffnen();
    expect(knopf().getAttribute('aria-expanded')).toBe('true');
    expect(panel()?.getAttribute('aria-labelledby')).toBe('meldungscenter-titel');
    expect(document.activeElement).toBe(panel());

    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await stabil();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(knopf());
  });

  it('zeigt den leeren Zustand', async () => {
    const { panel, oeffnen } = await glocke();
    await oeffnen();
    expect(panel()?.textContent).toContain('Keine Benachrichtigungen');
    expect(panel()?.textContent).toContain('Keine Meldungen');
    expect(panel()?.querySelector('ul')).toBeNull();
  });

  it('listet die Einträge, markiert gelesen, entfernt, alle als gelesen und alle entfernen', async () => {
    const { b, panel, oeffnen, stabil, schaltflaeche } = await glocke(2, 1);
    await oeffnen();
    const titel = () =>
      [...panel()!.querySelectorAll('li .titel')].map((t) =>
        t.textContent?.replace(/\s+/g, ' ').trim(),
      );
    expect(titel()).toEqual([
      'Ungelesen, Erfolg: Neu 1',
      'Ungelesen, Erfolg: Neu 0',
      'Fehler: Gelesen 0',
    ]);
    expect(panel()!.textContent).toContain('2 ungelesen');
    expect(panel()!.textContent).toContain('Gerade eben');

    schaltflaeche('„Neu 1“ als gelesen markieren').click();
    await stabil();
    expect(b.ungelesen()).toBe(1);
    expect(document.activeElement).toBe(panel());

    schaltflaeche('„Gelesen 0“ entfernen').click();
    await stabil();
    expect(b.eintraege()).toHaveLength(2);

    schaltflaeche('Alle als gelesen').click();
    await stabil();
    expect(b.ungelesen()).toBe(0);
    expect(panel()!.textContent).toContain('Alles gelesen');
    expect(schaltflaeche('Alle als gelesen')).toBeUndefined();

    schaltflaeche('Alle entfernen').click();
    await stabil();
    expect(b.eintraege()).toEqual([]);
    expect(panel()!.textContent).toContain('Keine Benachrichtigungen');
  });

  it('dem Link zu folgen markiert gelesen und schließt mit der Navigation', async () => {
    // Vor dem Erzeugen der Glocke: Die Zeit der Meldung läuft ab, sie ist ungelesen im Center.
    const vorher = TestBed.inject(Benachrichtigungen);
    vi.useFakeTimers();
    vorher.melden({
      art: 'warnung',
      titel: 'Frist',
      link: { ziel: '/vertraege/kfz', text: 'Vertrag ansehen' },
    });
    vi.advanceTimersByTime(8000);
    vi.useRealTimers();
    const { b, element, panel, oeffnen, stabil } = await glocke();
    expect(b.eintraege()[0].gelesen).toBe(false);
    await oeffnen();
    element.querySelector<HTMLAnchorElement>('[role="dialog"] a')!.click();
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/vertraege/kfz'));
    await stabil();
    expect(b.eintraege()[0].gelesen).toBe(true);
    expect(panel()).toBeNull();
  });

  it('schließt, wenn der Fokus das Center per Tab verlässt', async () => {
    const { panel, oeffnen, stabil } = await glocke(1);
    const draussen = document.createElement('button');
    document.body.appendChild(draussen);
    await oeffnen();
    panel()!.dispatchEvent(new FocusEvent('focusout', { relatedTarget: draussen }));
    await stabil();
    expect(panel()).toBeNull();
    draussen.remove();
  });
});
