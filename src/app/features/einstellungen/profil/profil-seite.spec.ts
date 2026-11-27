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

  it('meldet Titel, Pfad und „Zurück“ vorwärts zu den Einstellungen, wenn direkt aufgerufen', async () => {
    await seite();
    const zurueck = {
      ziel: '/einstellungen',
      label: 'Zurück zu Einstellungen',
      text: 'Einstellungen',
      verlauf: false,
    };
    expect(TestBed.inject(Seitenaktionen).aktionen()).toEqual({
      titel: 'Profil',
      pfad: { ...zurueck, label: null },
      zurueck,
    });
  });

  it('geht von den Einstellungen aus geöffnet im Verlauf zurück', async () => {
    await seite(UNTERSEITE_STATE);
    const aktionen = TestBed.inject(Seitenaktionen).aktionen();
    expect(aktionen.zurueck?.verlauf).toBe(true);
    expect(aktionen.pfad?.verlauf).toBe(true);
  });
});
