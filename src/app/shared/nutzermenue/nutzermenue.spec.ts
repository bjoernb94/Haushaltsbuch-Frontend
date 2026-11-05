import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Profil } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { UngespeicherteEingaben } from '../../core/ungespeichert/ungespeicherte-eingaben';
import { Nutzermenue } from './nutzermenue';

const MAX: Profil = { vorname: 'Max', name: 'Muster', email: 'max@beispiel.de' };

describe('Nutzermenue', () => {
  const nutzer = signal<Profil | null>(MAX);
  const abmelden = vi.fn(() => of<void>(undefined));

  beforeEach(async () => {
    nutzer.set(MAX);
    abmelden.mockReset();
    abmelden.mockReturnValue(of(undefined));
    await TestBed.configureTestingModule({
      imports: [Nutzermenue],
      providers: [
        provideRouter([{ path: 'andere', children: [] }]),
        { provide: AuthService, useValue: { nutzer, abmelden } },
      ],
    }).compileComponents();
  });

  async function menue() {
    const fixture = TestBed.createComponent(Nutzermenue);
    // Der Fokus funktioniert nur im Dokument.
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      element,
      knopf: () => element.querySelector<HTMLButtonElement>('.nutzer-knopf')!,
      panel: () => element.querySelector<HTMLElement>('[role="dialog"]'),
      oeffnen: async () => {
        element.querySelector<HTMLButtonElement>('.nutzer-knopf')!.click();
        await fixture.whenStable();
      },
    };
  }

  it('zeigt Initialen und Vorname, geschlossen ohne Panel', async () => {
    const { knopf, panel } = await menue();
    expect(knopf().querySelector('.initialen')?.textContent).toBe('MM');
    expect(knopf().querySelector('.vorname')?.textContent).toBe('Max');
    expect(knopf().getAttribute('aria-label')).toBe('Konto von Max Muster');
    expect(knopf().getAttribute('aria-expanded')).toBe('false');
    expect(knopf().getAttribute('aria-controls')).toBe('nutzermenue');
    expect(panel()).toBeNull();
  });

  it.each([
    ['Änne', 'Özdemir', 'ÄÖ'],
    ['anna maria', 'von der Leyen', 'AV'],
    ['  Lea ', ' Roth', 'LR'],
    ['Émilie', 'Blanc', 'ÉB'],
    ['😀nna', '𝒵eta', '😀𝒵'],
  ])('bildet die Initialen aus %s %s', async (vorname, name, erwartet) => {
    nutzer.set({ ...MAX, vorname, name });
    const { knopf } = await menue();
    expect(knopf().querySelector('.initialen')?.textContent).toBe(erwartet);
  });

  it('öffnet das Panel mit Name und E-Mail und fokussiert es', async () => {
    const { knopf, panel, oeffnen } = await menue();
    await oeffnen();
    expect(knopf().getAttribute('aria-expanded')).toBe('true');
    expect(panel()?.id).toBe('nutzermenue');
    expect(panel()?.getAttribute('aria-label')).toBe('Dein Konto');
    expect(panel()?.textContent).toContain('Max Muster');
    expect(panel()?.textContent).toContain('max@beispiel.de');
    expect(document.activeElement).toBe(panel());
  });

  it('Escape schließt und gibt den Fokus zurück', async () => {
    const { fixture, knopf, panel, oeffnen } = await menue();
    await oeffnen();
    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(knopf());
  });

  it('Klick daneben schließt und gibt den Fokus zurück', async () => {
    const { fixture, element, knopf, panel, oeffnen } = await menue();
    await oeffnen();
    element.querySelector<HTMLButtonElement>('.hintergrund')!.click();
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(knopf());
  });

  it('schließt, wenn der Fokus das Panel verlässt', async () => {
    const { fixture, panel, oeffnen } = await menue();
    await oeffnen();
    const danach = document.createElement('button');
    document.body.appendChild(danach);
    panel()!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: danach }));
    await fixture.whenStable();
    danach.remove();
    expect(panel()).toBeNull();
  });

  it('bleibt offen bei Fokus im Panel und wenn das Fenster den Fokus verliert', async () => {
    const { fixture, element, panel, oeffnen } = await menue();
    await oeffnen();
    const abmeldenKnopf = element.querySelector('.abmelden');
    panel()!.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: abmeldenKnopf }),
    );
    panel()!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await fixture.whenStable();
    expect(panel()).not.toBeNull();
  });

  it('schließt beim Seitenwechsel', async () => {
    const { fixture, panel, oeffnen } = await menue();
    await oeffnen();
    await TestBed.inject(Router).navigateByUrl('/andere');
    await fixture.whenStable();
    expect(panel()).toBeNull();
  });

  it('meldet ab und geht zum Login', async () => {
    const { element, oeffnen } = await menue();
    const navigiert = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await oeffnen();
    element.querySelector<HTMLButtonElement>('.abmelden')!.click();
    await vi.waitFor(() => expect(navigiert).toHaveBeenCalledWith('/login'));
    expect(abmelden).toHaveBeenCalledOnce();
  });

  it('geht auch zum Login, wenn das Backend beim Abmelden nicht antwortet', async () => {
    abmelden.mockReturnValue(throwError(() => new Error('kein Backend')));
    const { element, oeffnen } = await menue();
    const navigiert = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await oeffnen();
    element.querySelector<HTMLButtonElement>('.abmelden')!.click();
    await vi.waitFor(() => expect(navigiert).toHaveBeenCalledWith('/login'));
  });

  it('schließt vor der Rückfrage und bleibt bei „Weiter bearbeiten“ angemeldet', async () => {
    const eingaben = TestBed.inject(UngespeicherteEingaben);
    eingaben.melden(true);
    const { fixture, element, knopf, panel, oeffnen } = await menue();
    await oeffnen();
    element.querySelector<HTMLButtonElement>('.abmelden')!.click();
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(knopf());
    expect(eingaben.frageOffen()).toBe(true);
    expect(abmelden).not.toHaveBeenCalled();

    eingaben.antworten(false);
    await fixture.whenStable();
    expect(abmelden).not.toHaveBeenCalled();
    eingaben.melden(false);
  });

  it('meldet nach „Verwerfen“ ab', async () => {
    const eingaben = TestBed.inject(UngespeicherteEingaben);
    eingaben.melden(true);
    const { element, oeffnen } = await menue();
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await oeffnen();
    element.querySelector<HTMLButtonElement>('.abmelden')!.click();
    eingaben.antworten(true);
    await vi.waitFor(() => expect(abmelden).toHaveBeenCalledOnce());
  });

  it('zeigt ohne Nutzer nichts', async () => {
    nutzer.set(null);
    const { element } = await menue();
    expect(element.querySelector('button')).toBeNull();
  });
});
