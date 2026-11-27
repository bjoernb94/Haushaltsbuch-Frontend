import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { Komponente } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { SystemstatusService } from '../core/systemstatus/systemstatus.service';
import { Seitenaktionen } from '../shared/seitenaktionen/seitenaktionen';
import { Shell } from './shell';

const ROUTEN: Routes = [
  { path: 'start', children: [] },
  { path: 'vertraege', children: [] },
];

describe('Shell', () => {
  const komponenten = signal<Komponente[]>([]);
  const komponentenFehler = signal(false);
  const komponentenLaden = vi.fn(() => of(undefined));

  beforeEach(async () => {
    komponenten.set([]);
    komponentenFehler.set(false);
    komponentenLaden.mockClear();
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter(ROUTEN),
        {
          provide: AuthService,
          useValue: {
            komponenten,
            komponentenFehler,
            komponentenLaden,
            nutzer: signal({ vorname: 'Max', name: 'Muster', email: 'max@beispiel.de' }),
            angemeldet: computed(() => true),
          },
        },
        {
          provide: SystemstatusService,
          useValue: {
            beobachten: () => of({ backend: true, datenbank: false, anmeldeserver: true }),
          },
        },
      ],
    }).compileComponents();
  });

  async function shell() {
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const links = (element: HTMLElement) =>
    [...element.querySelectorAll('nav[aria-label="Hauptmenü"] a')].map((a) =>
      a.getAttribute('href'),
    );

  const eintraege = (element: HTMLElement) =>
    [...element.querySelectorAll('nav[aria-label="Hauptmenü"] .naveintrag')].map((e) =>
      e.textContent?.replace(/\s+/g, ' ').trim(),
    );

  it('zeigt Kopfzeile mit Glocke und Nutzermenü und die Navigation', async () => {
    komponenten.set(['VERTRAGSUEBERSICHT']);
    const element = await shell();
    expect(element.querySelector('header .logo')).toBeNull();
    expect(element.querySelector('header app-glocke')).not.toBeNull();
    expect(element.querySelector('header .nutzer-knopf')?.getAttribute('aria-label')).toBe(
      'Konto von Max Muster',
    );
    expect(element.querySelectorAll('app-nutzermenue')).toHaveLength(1);
    const navigation = element.querySelector('nav[aria-label="Hauptmenü"]');
    expect(navigation?.textContent).toContain('Haushaltsbuch');
    expect(navigation?.textContent).toContain('Komponenten');
    expect(navigation?.querySelector('.copyright')?.textContent).toBe('© Björn Bochmann');
    expect(links(element)).toEqual(['/start', '/vertraege', '/einstellungen']);
  });

  it('zeigt nicht gebuchte Bereiche gedimmt als ausgeschaltet, ohne Link', async () => {
    const element = await shell();
    expect(links(element)).toEqual(['/start', '/einstellungen']);
    expect(eintraege(element)).toEqual([
      'Übersicht',
      'FinanzübersichtFinanzenAusgeschaltet',
      'Verträge Ausgeschaltet',
      'VersorgungsverträgeVersorgungAusgeschaltet',
      'Portfolio Ausgeschaltet',
      'Einstellungen',
    ]);
    expect(element.querySelectorAll('nav[aria-label="Hauptmenü"] .inaktiv')).toHaveLength(4);
  });

  it('zeigt gebuchte, noch nicht verfügbare Bereiche ohne Link', async () => {
    komponenten.set(['PORTFOLIO']);
    const element = await shell();
    expect(links(element)).toEqual(['/start', '/einstellungen']);
    expect(eintraege(element)).toContain('Portfolio Demnächst verfügbar');
  });

  it('nennt lange Bereiche mit Lang- und Kurzform', async () => {
    komponenten.set(['FINANZUEBERSICHT']);
    const eintrag = (await shell()).querySelector('.inaktiv');
    expect(eintrag?.querySelector('.lang')?.textContent).toBe('Finanzübersicht');
    expect(eintrag?.querySelector('.kurz')?.textContent).toBe('Finanzen');
  });

  it('zeigt ohne geladene Komponenten keine Bereiche', async () => {
    komponentenFehler.set(true);
    const element = await shell();
    expect(eintraege(element)).toEqual(['Übersicht', 'Einstellungen']);
    expect(element.querySelector('nav[aria-label="Hauptmenü"]')?.textContent).not.toContain(
      'Komponenten',
    );
  });

  it('zeigt die Seitenleiste auf allen Seiten, auch auf der Startseite', async () => {
    const harness = await RouterTestingHarness.create();
    const fixture = TestBed.createComponent(Shell);
    const element = fixture.nativeElement as HTMLElement;

    await harness.navigateByUrl('/start');
    await fixture.whenStable();
    expect(element.querySelector('nav[aria-label="Hauptmenü"]')).not.toBeNull();
    expect(element.querySelector('a[href="/start"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('zeigt Titel und Hauptaktion der Seite in der Kopfzeile', async () => {
    TestBed.inject(Seitenaktionen).melden(
      signal({ titel: 'Verträge', neu: { ziel: '/vertraege/neu', text: 'Neuer Vertrag' } }),
    );
    const element = await shell();
    expect(element.querySelector('header h1')?.textContent).toBe('Verträge');
    expect(element.querySelector('header .hauptaktion')?.textContent?.trim()).toBe('Neuer Vertrag');
  });

  it('lässt Kopf und Tab-Leiste weg, solange eine Seite eine eigene Leiste meldet', async () => {
    const fixture = TestBed.createComponent(Shell);
    const element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(element.querySelector('.seite')!.classList.contains('eigene-leiste')).toBe(false);

    const entfernen = TestBed.inject(Seitenaktionen).melden(signal({ eigeneLeiste: true }));
    await fixture.whenStable();
    expect(element.querySelector('.seite')!.classList.contains('eigene-leiste')).toBe(true);

    entfernen();
    await fixture.whenStable();
    expect(element.querySelector('.seite')!.classList.contains('eigene-leiste')).toBe(false);
  });

  it('markiert den aktiven Eintrag', async () => {
    komponenten.set(['VERTRAGSUEBERSICHT']);
    await TestBed.inject(Router).navigateByUrl('/vertraege');
    const element = await shell();
    expect(element.querySelector('a[href="/vertraege"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    expect(element.querySelector('a[href="/start"]')?.hasAttribute('aria-current')).toBe(false);
  });

  it('bietet nach einem Ladefehler einen neuen Versuch an', async () => {
    komponentenFehler.set(true);
    const element = await shell();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Deine Bereiche konnten nicht geladen werden.',
    );

    element.querySelector<HTMLButtonElement>('.ladefehler button')!.click();

    expect(komponentenLaden).toHaveBeenCalledOnce();
  });

  it('zeigt ohne Ladefehler keinen Hinweis', async () => {
    expect((await shell()).querySelector('.ladefehler')).toBeNull();
  });

  it('zeigt in der Fußzeile nur die rechtlichen Links', async () => {
    const fusszeile = (await shell()).querySelector('footer');
    expect(fusszeile?.querySelector('nav')?.getAttribute('aria-label')).toBe('Rechtliches');
    expect(fusszeile?.textContent).not.toContain('©');
    expect(fusszeile?.textContent).not.toContain('Datenbank');
    expect(fusszeile?.querySelector('app-version-anzeige')).toBeNull();
  });
});
