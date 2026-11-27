import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, of } from 'rxjs';
import { Systemstatus, SystemstatusService } from '../../core/systemstatus/systemstatus.service';
import { VersionService } from '../../core/version/version.service';
import { Seitenaktionen } from '../../shared/seitenaktionen/seitenaktionen';
import { EinstellungenSeite } from './einstellungen-seite';

describe('EinstellungenSeite', () => {
  async function seite(
    optionen: {
      status?: Systemstatus;
      stage?: string;
      herkunft?: unknown;
    } = {},
  ) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'einstellungen', component: EinstellungenSeite },
          { path: 'einstellungen/profil', children: [] },
          { path: 'vertraege', children: [] },
          { path: 'start', children: [] },
          { path: 'impressum', children: [] },
        ]),
        {
          provide: SystemstatusService,
          useValue: { beobachten: () => (optionen.status ? of(optionen.status) : NEVER) },
        },
        {
          provide: VersionService,
          useValue: { frontend: { version: '0.2.0' }, stage: () => optionen.stage },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await TestBed.inject(Router).navigateByUrl('/einstellungen', {
      state: optionen.herkunft === undefined ? {} : { herkunft: optionen.herkunft },
    });
    await harness.fixture.whenStable();
    return harness.routeNativeElement!;
  }

  const zeilen = (element: HTMLElement, titel: string) =>
    [...element.querySelectorAll('section')]
      .find((s) => s.querySelector('h2')?.textContent === titel)!
      .querySelectorAll('li');

  it('zeigt Überschrift und den Status der drei Dienste', async () => {
    const element = await seite({
      status: { backend: true, datenbank: false, anmeldeserver: true },
    });
    expect(element.querySelector('h1')?.textContent).toBe('Einstellungen');
    expect([...zeilen(element, 'Systemstatus')].map((z) => z.textContent?.trim())).toEqual([
      'Backend Verfügbar',
      'Datenbank Nicht erreichbar',
      'Anmeldeserver Verfügbar',
    ]);
  });

  it('wartet ohne Antwort auf den Status', async () => {
    const element = await seite();
    expect(zeilen(element, 'Systemstatus')[0].textContent).toContain('Wird geprüft');
  });

  it('zeigt Version und Umgebung, ohne Antwort „Unbekannt“', async () => {
    let element = await seite({ stage: 'DEV' });
    let app = zeilen(element, 'App');
    expect(app[0].textContent).toContain('0.2.0');
    expect(app[1].querySelector('.stage')?.textContent).toBe('DEV');
    expect(app[1].querySelector('.stage')?.classList.contains('prod')).toBe(false);

    TestBed.resetTestingModule();
    element = await seite();
    app = zeilen(element, 'App');
    expect(app[1].querySelector('.stage')).toBeNull();
    expect(app[1].textContent).toContain('Unbekannt');
  });

  it('verlinkt im Abschnitt Konto Profil und Komponenten, die im Verlauf hierher zurückkehren', async () => {
    const element = await seite({ herkunft: '/vertraege' });
    const konto = zeilen(element, 'Konto');
    expect([...konto].map((z) => z.textContent?.trim())).toEqual(['Profil', 'Komponenten']);
    expect(konto[1].querySelector('a')?.getAttribute('href')).toBe('/einstellungen/komponenten');
    expect([...element.querySelectorAll('section h2')].map((h) => h.textContent)).toEqual([
      'Konto',
      'Systemstatus',
      'App',
      'Rechtliches',
    ]);

    konto[0].querySelector('a')!.click();
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/einstellungen/profil'));
    expect(TestBed.inject(Location).getState()).toMatchObject({ intern: true });
  });

  it('verlinkt Impressum und Datenschutz mit den Einstellungen als Herkunft', async () => {
    const element = await seite();
    const impressum = element.querySelector<HTMLAnchorElement>('a[href="/impressum"]')!;
    expect(element.querySelector('a[href="/datenschutz"]')).not.toBeNull();

    impressum.click();
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/impressum'));
    expect(TestBed.inject(Location).getState()).toMatchObject({ herkunft: '/einstellungen' });
  });

  it.each([
    ['/vertraege', '/vertraege', 'Zurück zu Verträge'],
    [undefined, '/start', 'Zurück zu Startseite'],
    ['/einstellungen', '/start', 'Zurück zu Startseite'],
    ['//boese.example', '/start', 'Zurück zu Startseite'],
  ])('führt mit Herkunft %s zurück zu %s', async (herkunft, ziel, label) => {
    const element = await seite({ herkunft });
    expect(element.querySelector('a.zurueck')).toBeNull();
    const aktionen = TestBed.inject(Seitenaktionen).aktionen();
    expect(aktionen.titel).toBe('Einstellungen');
    expect(TestBed.inject(Router).serializeUrl(aktionen.zurueck!.ziel as UrlTree)).toBe(ziel);
    expect(aktionen.zurueck?.label).toBe(label);
  });
});
