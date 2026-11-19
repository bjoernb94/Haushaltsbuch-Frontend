import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ProfilAntwort } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { Seitenaktionen } from '../../../shared/seitenaktionen/seitenaktionen';
import { UNTERSEITE_STATE } from '../unterseite';
import { ProfilSeite } from './profil-seite';

const MAX: ProfilAntwort = { vorname: 'Max', name: 'Mustermann', email: 'max@beispiel.de' };

describe('ProfilSeite', () => {
  async function seite(state: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'einstellungen', children: [] },
          { path: 'einstellungen/profil', component: ProfilSeite },
        ]),
        { provide: AuthService, useValue: { nutzer: signal(MAX) } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await TestBed.inject(Router).navigateByUrl('/einstellungen/profil', { state });
    await harness.fixture.whenStable();
    return harness.routeNativeElement!;
  }

  it('zeigt Initialen, Name und E-Mail und die persönlichen Angaben', async () => {
    const element = await seite();
    expect(element.querySelector('h1')?.textContent).toBe('Profil');
    expect(element.querySelector('.initialen')?.textContent).toBe('MM');
    expect(element.querySelector('.name')?.textContent).toBe('Max Mustermann');
    expect(element.querySelector('.email')?.textContent).toBe('max@beispiel.de');
    expect(element.querySelector('section h2')?.textContent).toBe('Persönliche Angaben');
    const felder = [...element.querySelectorAll('.feld')].map((f) => [
      f.querySelector('dt')?.textContent,
      f.querySelector('dd')?.textContent,
    ]);
    expect(felder).toEqual([
      ['Vorname', 'Max'],
      ['Name', 'Mustermann'],
      ['E-Mail-Adresse', 'max@beispiel.de'],
    ]);
  });

  it('führt direkt aufgerufen vorwärts zu den Einstellungen, auch in der Kopfzeile', async () => {
    const element = await seite();
    const zurueck = element.querySelector<HTMLAnchorElement>('a.zurueck')!;
    expect(zurueck.textContent?.trim()).toBe('Einstellungen');
    expect(zurueck.getAttribute('href')).toBe('/einstellungen');
    expect(zurueck.getAttribute('aria-label')).toBe('Zurück zu Einstellungen');
    expect(TestBed.inject(Seitenaktionen).aktionen().zurueck).toEqual({
      ziel: '/einstellungen',
      label: 'Zurück zu Einstellungen',
      text: 'Einstellungen',
      verlauf: false,
    });

    zurueck.click();
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/einstellungen'));
  });

  it('geht von den Einstellungen aus geöffnet im Verlauf zurück', async () => {
    const element = await seite(UNTERSEITE_STATE);
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    expect(TestBed.inject(Seitenaktionen).aktionen().zurueck?.verlauf).toBe(true);

    element.querySelector<HTMLAnchorElement>('a.zurueck')!.click();
    expect(back).toHaveBeenCalledOnce();
  });
});
