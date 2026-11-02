import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { Komponente } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { SystemstatusService } from '../core/systemstatus/systemstatus.service';
import { Shell } from './shell';

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
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            nutzer: signal({ vorname: 'Max', name: 'Muster', email: 'max@beispiel.de' }),
            komponenten,
            komponentenFehler,
            komponentenLaden,
            abmelden: () => of(undefined),
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
    [...element.querySelectorAll('mat-nav-list a')].map((a) => a.getAttribute('href'));

  it('zeigt Kopfzeile und Navigation', async () => {
    komponenten.set(['VERTRAGSUEBERSICHT']);
    const element = await shell();
    expect(element.querySelector('mat-toolbar')?.textContent).toContain('Haushaltsbuch');
    expect(links(element)).toEqual(['/start', '/vertraege', '/nutzer']);
  });

  it('blendet nicht gebuchte Bereiche aus', async () => {
    const element = await shell();
    expect(links(element)).toEqual(['/start', '/nutzer']);
    expect(element.querySelector('mat-nav-list')?.textContent).not.toContain('Demnächst');
  });

  it('zeigt gebuchte, noch nicht verfügbare Bereiche ohne Link', async () => {
    komponenten.set(['PORTFOLIO']);
    const element = await shell();
    expect(links(element)).toEqual(['/start', '/nutzer']);
    const eintrag = element.querySelector('.demnaechst');
    expect(eintrag?.textContent).toContain('Portfolio');
    expect(eintrag?.textContent).toContain('Demnächst verfügbar');
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

  it('zeigt Copyright und Systemstatus in der Fußzeile', async () => {
    const fusszeile = (await shell()).querySelector('footer');
    expect(fusszeile?.textContent).toContain('© Björn Bochmann');
    expect(fusszeile?.textContent).toContain('Datenbank nicht erreichbar');
  });

  it('meldet ab und geht zum Login', async () => {
    const element = await shell();
    const navigiert = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    element.querySelector<HTMLButtonElement>('button[aria-label="Abmelden"]')!.click();

    expect(navigiert).toHaveBeenCalledWith('/login');
  });
});
