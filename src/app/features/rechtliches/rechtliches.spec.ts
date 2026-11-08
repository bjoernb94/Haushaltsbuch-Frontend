import { Location } from '@angular/common';
import { LOCALE_ID, signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Instanzangaben, Instanzstand, InstanzService } from '../../core/instanz/instanz.service';
import { SystemstatusService } from '../../core/systemstatus/systemstatus.service';
import { Stand, VersionService } from '../../core/version/version.service';
import { zeitpunktText } from '../../shared/format/zeitpunkt';
import { DatenschutzSeite } from './datenschutz-seite';
import { ImpressumSeite } from './impressum-seite';

const ANGABEN: Instanzangaben = {
  betreiber: {
    name: 'Max Muster',
    anschrift: ['Musterweg 1', '12345 Musterstadt'],
    email: 'betrieb@beispiel.de',
  },
  rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO',
  speicherort: 'Server in Deutschland',
  logAufbewahrungTage: 14,
  stand: '2026-11-08',
};

describe('Impressum und Datenschutz', () => {
  const angemeldet = signal(false);
  const stand = signal<Instanzstand>({ zustand: 'da', angaben: ANGABEN });
  const backend = signal<Stand | undefined>(undefined);
  const instanzLaden = vi.fn();
  const sitzungPruefen = vi.fn(() => of(false));

  beforeEach(async () => {
    angemeldet.set(false);
    stand.set({ zustand: 'da', angaben: ANGABEN });
    backend.set(undefined);
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'de-DE' },
        {
          provide: AuthService,
          useValue: { angemeldet, sitzungPruefen, nutzer: signal(null) },
        },
        { provide: InstanzService, useValue: { stand, laden: instanzLaden } },
        {
          provide: SystemstatusService,
          useValue: {
            beobachten: () => of({ backend: true, datenbank: true, anmeldeserver: true }),
          },
        },
        {
          provide: VersionService,
          useValue: {
            frontend: { version: '0.1.0', commit: 'abc1234', buildZeit: '2026-11-08T15:26:00Z' },
            backend,
            stage: signal(undefined),
          },
        },
      ],
    }).compileComponents();
  });

  async function seite<T>(typ: Type<T>) {
    const fixture = TestBed.createComponent(typ);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const zurueck = (element: HTMLElement) => element.querySelector<HTMLAnchorElement>('a.zurueck')!;

  describe('Rahmen', () => {
    it('prüft die Session und lädt die Angaben', async () => {
      await seite(ImpressumSeite);
      expect(sitzungPruefen).toHaveBeenCalledOnce();
      expect(instanzLaden).toHaveBeenCalledOnce();
    });

    it('führt ohne Herkunft zum Login, mit Session zur Startseite', async () => {
      const element = await seite(ImpressumSeite);
      expect(zurueck(element).getAttribute('href')).toBe('/login');
      expect(zurueck(element).getAttribute('aria-label')).toBe('Zurück zu Login');
    });

    it('führt mit Session ohne Herkunft zur Startseite', async () => {
      angemeldet.set(true);
      const element = await seite(DatenschutzSeite);
      expect(zurueck(element).getAttribute('href')).toBe('/start');
      expect(zurueck(element).getAttribute('aria-label')).toBe('Zurück zu Startseite');
    });

    it('führt zur Herkunft aus dem Navigations-State, samt Query', async () => {
      vi.spyOn(TestBed.inject(Location), 'getState').mockReturnValue({
        herkunft: '/vertraege/neu?x=1',
      });
      const element = await seite(ImpressumSeite);
      expect(zurueck(element).getAttribute('href')).toBe('/vertraege/neu?x=1');
      expect(zurueck(element).getAttribute('aria-label')).toBe('Zurück zu Neuer Vertrag');
    });

    it('hat denselben Footer wie die Shell: Status, Links, Version und Copyright', async () => {
      const footer = (await seite(ImpressumSeite)).querySelector('app-fusszeile footer')!;
      expect(footer.querySelector('app-systemstatus-leiste')?.textContent).toContain('Datenbank');
      expect(footer.querySelector('nav')?.textContent).toContain('Datenschutz');
      expect(footer.querySelector('app-version-anzeige')?.textContent).toContain('v0.1.0');
      expect(footer.textContent).toContain('© Björn Bochmann');
      expect(TestBed.inject(Router)).toBeTruthy();
    });
  });

  describe('Impressum', () => {
    it('zeigt Betreiber, Anschrift, E-Mail und Stand', async () => {
      const element = await seite(ImpressumSeite);
      expect(element.querySelector('h1')?.textContent).toBe('Impressum');
      expect(element.querySelector('.stand')?.textContent).toBe('Stand: 08.11.2026');
      expect(element.textContent).toContain('Max Muster');
      const anschrift = element.querySelector('section p')!;
      expect(anschrift.querySelectorAll('br')).toHaveLength(2);
      expect(anschrift.textContent!.replace(/\s+/g, ' ').trim()).toBe(
        'Max Muster Musterweg 1 12345 Musterstadt',
      );
      expect(element.querySelector('a[href="mailto:betrieb@beispiel.de"]')).not.toBeNull();
    });

    it('nennt beide Versionen getrennt, fehlendes als nicht bekannt', async () => {
      const element = await seite(ImpressumSeite);
      const werte = [...element.querySelectorAll('dd.technisch')].map((dd) => dd.textContent);
      // Die Uhrzeit hängt von der Zeitzone ab (lokal Europe/Berlin, in der CI UTC).
      expect(werte[0]).toBe(
        `v0.1.0 · Commit abc1234 · Build ${zeitpunktText('2026-11-08T15:26:00Z', 'de-DE')}`,
      );
      expect(werte[1]).toBe('nicht bekannt');
    });

    it('nennt vom Backend, was es liefert', async () => {
      backend.set({ version: undefined, commit: '48eaea5', buildZeit: undefined });
      const element = await seite(ImpressumSeite);
      expect(element.querySelectorAll('dd.technisch')[1].textContent).toBe(
        'Version nicht bekannt · Commit 48eaea5',
      );
    });

    it('zeigt Lizenz und Quellcode nur, wenn sie hinterlegt sind', async () => {
      let element = await seite(ImpressumSeite);
      expect(element.textContent).not.toContain('Lizenz');
      expect(element.textContent).not.toContain('Quellcode');

      stand.set({
        zustand: 'da',
        angaben: { ...ANGABEN, lizenz: 'MIT', quellcode: 'https://example.org/repo' },
      });
      element = await seite(ImpressumSeite);
      expect(element.textContent).toContain('MIT');
      expect(element.querySelector('a[href="https://example.org/repo"]')).not.toBeNull();
    });

    it('meldet fehlende Angaben, die Versionen bleiben', async () => {
      stand.set({ zustand: 'fehlt' });
      const element = await seite(ImpressumSeite);
      expect(element.querySelector('[role="alert"]')?.textContent).toContain(
        'keine Angaben zum Betreiber hinterlegt',
      );
      expect(element.querySelector('.stand')).toBeNull();
      expect(element.textContent).toContain('Version Frontend');
    });

    it('bietet nach einem Fehler einen neuen Versuch an', async () => {
      stand.set({ zustand: 'fehler' });
      const element = await seite(ImpressumSeite);
      instanzLaden.mockClear();
      element.querySelector<HTMLButtonElement>('.fehler button')!.click();
      expect(instanzLaden).toHaveBeenCalledOnce();
    });

    it('zeigt den Ladezustand', async () => {
      stand.set({ zustand: 'laedt' });
      const element = await seite(ImpressumSeite);
      expect(element.querySelector('[role="status"].laedt')?.textContent).toBe('Wird geladen …');
    });
  });

  describe('Datenschutz', () => {
    it('setzt die Angaben des Betreibers ein', async () => {
      const element = await seite(DatenschutzSeite);
      expect(element.querySelector('h1')?.textContent).toBe('Datenschutzerklärung');
      expect(element.textContent).toContain('Musterweg 1, 12345 Musterstadt');
      expect(element.textContent).toContain('Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.');
      expect(element.textContent).toContain('Server des Betreibers: Server in Deutschland.');
      expect(element.textContent).toContain('nach 14 Tagen');
    });

    it('nennt Export und Löschen als Funktion der Vollversion', async () => {
      const text = (await seite(DatenschutzSeite)).textContent!.replace(/\s+/g, ' ');
      expect(text).toContain(
        'Den Export deiner Daten und das Löschen deines Kontos gibt es erst ab der Vollversion',
      );
    });

    it('schreibt einen Tag im Singular', async () => {
      stand.set({ zustand: 'da', angaben: { ...ANGABEN, logAufbewahrungTage: 1 } });
      expect((await seite(DatenschutzSeite)).textContent).toContain('nach einem Tag');
    });

    it('zeigt ohne Angaben nur den Hinweis', async () => {
      stand.set({ zustand: 'fehlt' });
      const element = await seite(DatenschutzSeite);
      expect(element.querySelectorAll('section')).toHaveLength(0);
      expect(element.querySelector('[role="alert"]')).not.toBeNull();
    });
  });
});
