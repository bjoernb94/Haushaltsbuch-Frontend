import { Location } from '@angular/common';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfilAntwort } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { Aktionen, Seitenaktionen } from '../seitenaktionen/seitenaktionen';
import { kopfAusrichten, Kopfzeile } from './kopfzeile';

const MAX: ProfilAntwort = { vorname: 'Max', name: 'Muster', email: 'max@beispiel.de' };

describe('Kopfzeile', () => {
  const nutzer = signal<ProfilAntwort | null>(MAX);

  beforeEach(async () => {
    nutzer.set(MAX);
    await TestBed.configureTestingModule({
      imports: [Kopfzeile],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { nutzer, angemeldet: computed(() => !!nutzer()) },
        },
      ],
    }).compileComponents();
  });

  async function kopfzeile(aktionen?: Aktionen, variante: 'app' | 'einfach' = 'einfach') {
    if (aktionen) {
      TestBed.inject(Seitenaktionen).melden(signal(aktionen));
    }
    const fixture = TestBed.createComponent(Kopfzeile);
    fixture.componentRef.setInput('variante', variante);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('zeigt ohne gemeldete Aktionen nur Logo, Glocke und Nutzermenü', async () => {
    const { element } = await kopfzeile();
    expect(element.querySelector('.logo')?.textContent).toContain('Haushaltsbuch');
    expect(element.querySelector('app-glocke')?.nextElementSibling?.tagName).toBe(
      'APP-NUTZERMENUE',
    );
    expect(element.querySelector('.nutzer-knopf')).not.toBeNull();
    expect(element.querySelector('a')).toBeNull();
    expect(element.querySelector('h1')).toBeNull();
  });

  it('zeigt in der Shell den Titel als h1 statt des Logos', async () => {
    const { element } = await kopfzeile({ titel: 'Verträge' }, 'app');
    expect(element.querySelector('.logo')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toBe('Verträge');
    expect(element.querySelector('.pfad')).toBeNull();
  });

  it('zeigt den Pfad vor dem Titel und geht auf Wunsch im Verlauf zurück', async () => {
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    const { element } = await kopfzeile(
      {
        titel: 'Profil',
        pfad: { ziel: '/einstellungen', label: null, text: 'Einstellungen', verlauf: true },
      },
      'app',
    );
    const pfad = element.querySelector<HTMLAnchorElement>('a.pfad')!;
    expect(pfad.textContent).toBe('Einstellungen');
    expect(pfad.getAttribute('href')).toBe('/einstellungen');
    expect(element.querySelector('.titel')?.textContent?.trim()).toBe('EinstellungenProfil');

    pfad.click();
    expect(back).toHaveBeenCalledOnce();
  });

  it('zeigt auf Impressum und Datenschutz keinen Titel', async () => {
    const { element } = await kopfzeile({ titel: 'Impressum' });
    expect(element.querySelector('h1')).toBeNull();
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

  it('zeigt die Hauptaktion als Knopf mit Tastenkürzel und als „+“', async () => {
    const { element } = await kopfzeile(
      { titel: 'Verträge', neu: { ziel: '/vertraege/neu', text: 'Neuer Vertrag', taste: 'n' } },
      'app',
    );
    const plus = element.querySelector('a.plus')!;
    expect(plus.getAttribute('href')).toBe('/vertraege/neu');
    expect(plus.getAttribute('aria-label')).toBe('Neuer Vertrag');

    const knopf = element.querySelector('a.hauptaktion')!;
    expect(knopf.getAttribute('href')).toBe('/vertraege/neu');
    expect(knopf.textContent?.trim()).toBe('Neuer Vertrag');
    expect(knopf.getAttribute('title')).toBe('Neuer Vertrag (N)');
    expect(knopf.getAttribute('aria-keyshortcuts')).toBe('n');
    expect(element.querySelector('.trenner')?.nextElementSibling?.classList).toContain('rechts');
  });

  it('zeigt die Hauptaktion ohne Tastenkürzel ohne Tooltip', async () => {
    const { element } = await kopfzeile({ neu: { ziel: '/x', text: 'Neu' } }, 'app');
    const knopf = element.querySelector('a.hauptaktion')!;
    expect(knopf.hasAttribute('title')).toBe(false);
    expect(knopf.hasAttribute('aria-keyshortcuts')).toBe(false);
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
    expect(element.querySelector('app-glocke')).toBeNull();
  });

  describe('kopfAusrichten', () => {
    it('lässt mit Platz eine Lücke bis zum Inhaltsrand, ohne Trennstrich', () => {
      // 1688 px Spalte: Rand 268 px; Glocke und Nutzermenü 178 px breit.
      expect(kopfAusrichten(1688, 178)).toEqual({ luecke: 268 - 24 - 178 - 8, getrennt: true });
    });

    it('stellt ohne Platz alles nebeneinander, mit Trennstrich', () => {
      expect(kopfAusrichten(1048, 178)).toEqual({ luecke: 0, getrennt: false });
      // Knapp: 24 px Abstand reichen nicht für Abstand, Strich und Abstand (25 px).
      expect(kopfAusrichten(2 * (576 + 24 + 178 + 24), 178)).toEqual({
        luecke: 0,
        getrennt: false,
      });
    });

    it('endet ohne Session am Inhaltsrand', () => {
      expect(kopfAusrichten(1688, null)).toEqual({ luecke: 244, getrennt: true });
      expect(kopfAusrichten(1000, null)).toEqual({ luecke: 0, getrennt: true });
    });
  });
});
