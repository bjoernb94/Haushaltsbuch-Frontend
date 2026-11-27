import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Komponente } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { VertragService } from '../vertraege/vertrag.service';
import { Seitenaktionen } from '../../shared/seitenaktionen/seitenaktionen';
import { StartSeite } from './start-seite';

describe('StartSeite', () => {
  const komponenten = signal<Komponente[]>([]);
  const uebersicht = vi.fn();

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 15));
    komponenten.set([]);
    uebersicht.mockReset();
    uebersicht.mockReturnValue(
      of({
        laufendeVertraege: 0,
        kostenProMonat: [],
        kostenImJahr: [],
        kostenImJahrMitPrognose: false,
        einmalkostenImJahr: [],
        hatAnteile: false,
        jahr: 2026,
        naechsteKuendigungsfristen: [],
      }),
    );
    await TestBed.configureTestingModule({
      imports: [StartSeite],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'de-DE' },
        { provide: VertragService, useValue: { uebersicht } },
        {
          provide: AuthService,
          useValue: {
            nutzer: signal({ vorname: 'Max', name: 'Muster', email: 'max@beispiel.de' }),
            komponenten,
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  async function seite() {
    const fixture = TestBed.createComponent(StartSeite);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const titel = (element: HTMLElement) =>
    [...element.querySelectorAll('.raster h2')].map((h2) => h2.textContent);

  it('begrüßt mit Vornamen und aktuellem Monat, Titel „Übersicht“', async () => {
    const element = await seite();
    expect(element.querySelector('h1')?.textContent).toBe('Übersicht');
    expect(TestBed.inject(Seitenaktionen).aktionen().titel).toBe('Übersicht');
    expect(element.querySelector('.kopf h2')?.textContent).toBe('Willkommen, Max!');
    expect(element.querySelector('.kopf p')?.textContent).toBe('Dein Überblick für November 2026.');
  });

  it('zeigt nur Kacheln gebuchter Komponenten', async () => {
    komponenten.set(['VERTRAGSUEBERSICHT', 'PORTFOLIO']);
    expect(titel(await seite())).toEqual(['Vertragsübersicht', 'Portfolio']);
  });

  it('zeigt alle Kacheln in der Reihenfolge des Designs', async () => {
    komponenten.set([
      'PORTFOLIO',
      'VERSORGUNGSVERTRAEGE',
      'VERTRAGSUEBERSICHT',
      'FINANZUEBERSICHT',
    ]);
    expect(titel(await seite())).toEqual([
      'Finanzübersicht',
      'Vertragsübersicht',
      'Versorgungsverträge',
      'Portfolio',
    ]);
  });

  it('fragt die Vertragsübersicht ohne gebuchte Komponente nicht ab', async () => {
    komponenten.set(['PORTFOLIO']);
    await seite();
    expect(uebersicht).not.toHaveBeenCalled();
  });

  it('fragt die Vertragsübersicht mit gebuchter Komponente ab', async () => {
    komponenten.set(['VERTRAGSUEBERSICHT']);
    await seite();
    expect(uebersicht).toHaveBeenCalledOnce();
  });

  it('verlinkt die verfügbare Vertragskachel', async () => {
    komponenten.set(['VERTRAGSUEBERSICHT']);
    const element = await seite();
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/vertraege');
    expect(element.querySelector('.kopf app-chip')).toBeNull();
    expect(element.querySelector('.inhalt')?.hasAttribute('aria-hidden')).toBe(false);
  });

  it('zeigt noch nicht verfügbare Kacheln ohne Link und verbirgt ihren Aufbau', async () => {
    komponenten.set(['FINANZUEBERSICHT', 'VERSORGUNGSVERTRAEGE', 'PORTFOLIO']);
    const element = await seite();
    expect(element.querySelector('a')).toBeNull();
    expect(element.querySelectorAll('.kopf app-chip').length).toBe(3);
    expect(element.querySelector('.kopf app-chip')?.textContent).toBe('Demnächst verfügbar');
    for (const inhalt of element.querySelectorAll('.inhalt')) {
      expect(inhalt.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('kennzeichnet die Werte noch nicht verfügbarer Kacheln als Beispiel', async () => {
    komponenten.set([
      'FINANZUEBERSICHT',
      'VERSORGUNGSVERTRAEGE',
      'PORTFOLIO',
      'VERTRAGSUEBERSICHT',
    ]);
    const element = await seite();
    expect(element.querySelectorAll('.beispiel').length).toBe(3);
    expect(element.querySelector('.beispiel')?.textContent).toBe(
      'Beispielwerte, nicht deine Daten',
    );
  });
});
