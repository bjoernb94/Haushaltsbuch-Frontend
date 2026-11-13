import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { Komponente } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { SystemstatusService } from '../core/systemstatus/systemstatus.service';
import { Shell } from './shell';

const ROUTEN: Routes = [
  { path: 'start', data: { ohneNavigation: true }, children: [] },
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

  it('zeigt Kopfzeile, Nutzermenü und Navigation', async () => {
    komponenten.set(['VERTRAGSUEBERSICHT']);
    const element = await shell();
    expect(element.querySelector('header')?.textContent).toContain('Haushaltsbuch');
    expect(element.querySelector('header button')?.getAttribute('aria-label')).toBe(
      'Konto von Max Muster',
    );
    expect(element.querySelector('nav[aria-label="Hauptmenü"]')).not.toBeNull();
    expect(element.querySelector('footer nav')?.getAttribute('aria-label')).toBe('Rechtliches');
    expect(element.querySelector('nav[aria-label="Hauptmenü"]')?.textContent).toContain(
      'Komponenten',
    );
    expect(links(element)).toEqual(['/start', '/vertraege']);
  });

  it('blendet nicht gebuchte Bereiche und den leeren Abschnitt aus', async () => {
    const element = await shell();
    expect(links(element)).toEqual(['/start']);
    expect(element.querySelector('nav[aria-label="Hauptmenü"]')?.textContent).not.toContain(
      'Komponenten',
    );
    expect(element.querySelector('nav[aria-label="Hauptmenü"]')?.textContent).not.toContain(
      'Demnächst',
    );
  });

  it('zeigt gebuchte, noch nicht verfügbare Bereiche ohne Link', async () => {
    komponenten.set(['PORTFOLIO']);
    const element = await shell();
    expect(links(element)).toEqual(['/start']);
    const eintrag = element.querySelector('.demnaechst');
    expect(eintrag?.textContent).toContain('Portfolio');
    expect(eintrag?.textContent).toContain('Demnächst verfügbar');
  });

  it('nennt lange Bereiche mit Lang- und Kurzform', async () => {
    komponenten.set(['FINANZUEBERSICHT']);
    const eintrag = (await shell()).querySelector('.demnaechst');
    expect(eintrag?.querySelector('.lang')?.textContent).toBe('Finanzübersicht');
    expect(eintrag?.querySelector('.kurz')?.textContent).toBe('Finanzen');
  });

  it('richtet das Layout nach der Route', async () => {
    const harness = await RouterTestingHarness.create();
    const fixture = TestBed.createComponent(Shell);
    const shellElement = fixture.nativeElement as HTMLElement;

    await harness.navigateByUrl('/start');
    await fixture.whenStable();
    expect(shellElement.querySelector('nav[aria-label="Hauptmenü"]')).toBeNull();

    await harness.navigateByUrl('/vertraege');
    await fixture.whenStable();
    expect(shellElement.querySelector('nav[aria-label="Hauptmenü"]')).not.toBeNull();
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

  it('zeigt in der Fußzeile das Copyright, den Systemstatus nur auf den Einstellungen', async () => {
    const fusszeile = (await shell()).querySelector('footer');
    expect(fusszeile?.textContent).toContain('© Björn Bochmann');
    expect(fusszeile?.textContent).not.toContain('Datenbank');
  });

  it('setzt das Kontomenü nur mit Navigation in die Seitenleiste', async () => {
    const harness = await RouterTestingHarness.create();
    const fixture = TestBed.createComponent(Shell);
    const element = fixture.nativeElement as HTMLElement;
    const inSeitenleiste = () =>
      element.querySelector('app-kopfzeile')!.classList.contains('seitenleiste');

    await harness.navigateByUrl('/start');
    await fixture.whenStable();
    expect(inSeitenleiste()).toBe(false);

    await harness.navigateByUrl('/vertraege');
    await fixture.whenStable();
    expect(inSeitenleiste()).toBe(true);
    expect(element.querySelectorAll('app-nutzermenue')).toHaveLength(1);
    expect(element.querySelector('nav[aria-label="Hauptmenü"]')?.textContent).toContain(
      'Haushaltsbuch',
    );
  });
});
