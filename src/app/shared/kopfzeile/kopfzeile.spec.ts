import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfilAntwort } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { Aktionen, Seitenaktionen } from '../seitenaktionen/seitenaktionen';
import { Kopfzeile } from './kopfzeile';

const MAX: ProfilAntwort = { vorname: 'Max', name: 'Muster', email: 'max@beispiel.de' };

describe('Kopfzeile', () => {
  const nutzer = signal<ProfilAntwort | null>(MAX);

  beforeEach(async () => {
    nutzer.set(MAX);
    await TestBed.configureTestingModule({
      imports: [Kopfzeile],
      providers: [provideRouter([]), { provide: AuthService, useValue: { nutzer } }],
    }).compileComponents();
  });

  async function kopfzeile(aktionen?: Aktionen) {
    if (aktionen) {
      TestBed.inject(Seitenaktionen).melden(signal(aktionen));
    }
    const fixture = TestBed.createComponent(Kopfzeile);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('zeigt ohne gemeldete Aktionen nur Logo und Nutzermenü', async () => {
    const { element } = await kopfzeile();
    expect(element.textContent).toContain('Haushaltsbuch');
    expect(element.querySelector('.nutzer-knopf')).not.toBeNull();
    expect(element.querySelector('.aktion')).toBeNull();
  });

  it('zeigt „Zurück“ zur gemeldeten Seite mit Beschriftung', async () => {
    const { element } = await kopfzeile({
      zurueck: { ziel: '/vertraege', label: 'Zurück zu Verträge' },
    });
    const zurueck = element.querySelector('a.zurueck')!;
    expect(zurueck.textContent?.trim()).toBe('Zurück');
    expect(zurueck.getAttribute('href')).toBe('/vertraege');
    expect(zurueck.getAttribute('aria-label')).toBe('Zurück zu Verträge');
  });

  it('zeigt einen eigenen Text und geht auf Wunsch im Verlauf zurück', async () => {
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    const { element } = await kopfzeile({
      zurueck: {
        ziel: '/einstellungen',
        label: 'Zurück zu Einstellungen',
        text: 'Einstellungen',
        verlauf: true,
      },
    });
    const zurueck = element.querySelector<HTMLAnchorElement>('a.zurueck')!;
    expect(zurueck.textContent?.trim()).toBe('Einstellungen');
    expect(zurueck.getAttribute('href')).toBe('/einstellungen');

    zurueck.click();
    expect(back).toHaveBeenCalledOnce();
  });

  it('zeigt „+“ mit Beschriftung vor dem Nutzermenü', async () => {
    const { element } = await kopfzeile({
      neu: { ziel: '/vertraege/neu', label: 'Neuer Vertrag' },
    });
    const neu = element.querySelector('a.neu')!;
    expect(neu.getAttribute('href')).toBe('/vertraege/neu');
    expect(neu.getAttribute('aria-label')).toBe('Neuer Vertrag');
    expect(neu.nextElementSibling?.tagName).toBe('APP-NUTZERMENUE');
  });

  it('hebt sich, solange das Kontomenü offen ist', async () => {
    const { fixture, element } = await kopfzeile();
    expect(element.classList.contains('menue-offen')).toBe(false);

    element.querySelector<HTMLButtonElement>('.nutzer-knopf')!.click();
    await fixture.whenStable();
    expect(element.classList.contains('menue-offen')).toBe(true);

    element.querySelector<HTMLButtonElement>('.hintergrund')!.click();
    await fixture.whenStable();
    expect(element.classList.contains('menue-offen')).toBe(false);
  });

  it('zeigt Aktionen auch ohne Session, z. B. auf dem Impressum', async () => {
    nutzer.set(null);
    const { element } = await kopfzeile({ zurueck: { ziel: '/login', label: 'Zurück zu Login' } });
    expect(element.querySelector('a.zurueck')).not.toBeNull();
    expect(element.querySelector('.nutzer-knopf')).toBeNull();
  });
});
