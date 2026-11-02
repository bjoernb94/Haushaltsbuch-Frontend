import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Komponente } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { StartSeite } from './start-seite';

registerLocaleData(localeDe);

describe('StartSeite', () => {
  const komponenten = signal<Komponente[]>([]);

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 15));
    komponenten.set([]);
    await TestBed.configureTestingModule({
      imports: [StartSeite],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'de-DE' },
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
    [...element.querySelectorAll('h2')].map((h2) => h2.textContent);

  it('begrüßt mit Vornamen und aktuellem Monat', async () => {
    const element = await seite();
    expect(element.querySelector('h1')?.textContent).toBe('Willkommen, Max!');
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

  it('verlinkt die verfügbare Vertragskachel', async () => {
    komponenten.set(['VERTRAGSUEBERSICHT']);
    const element = await seite();
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/vertraege');
    expect(element.querySelector('.hinweis')).toBeNull();
    expect(element.querySelector('.inhalt')?.hasAttribute('aria-hidden')).toBe(false);
  });

  it('zeigt noch nicht verfügbare Kacheln ohne Link und verbirgt ihren Aufbau', async () => {
    komponenten.set(['FINANZUEBERSICHT', 'VERSORGUNGSVERTRAEGE', 'PORTFOLIO']);
    const element = await seite();
    expect(element.querySelector('a')).toBeNull();
    expect(element.querySelectorAll('.hinweis').length).toBe(3);
    expect(element.querySelector('.hinweis')?.textContent).toBe('Demnächst verfügbar');
    for (const inhalt of element.querySelectorAll('.inhalt')) {
      expect(inhalt.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('erfindet keine Werte für noch nicht verfügbare Kacheln', async () => {
    komponenten.set(['FINANZUEBERSICHT', 'VERSORGUNGSVERTRAEGE', 'PORTFOLIO']);
    expect((await seite()).querySelector('.raster')?.textContent).not.toMatch(/\d|€/);
  });
});
