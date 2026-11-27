import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfilAntwort } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { Benachrichtigungen } from '../../core/benachrichtigungen/benachrichtigungen';
import { Toasts } from './toasts';

const MAX: ProfilAntwort = { vorname: 'Max', name: 'Muster', email: 'max@beispiel.de' };

describe('Toasts', () => {
  const nutzer = signal<ProfilAntwort | null>(MAX);

  beforeEach(() => {
    sessionStorage.clear();
    nutzer.set(MAX);
    TestBed.configureTestingModule({
      imports: [Toasts],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { nutzer, angemeldet: computed(() => !!nutzer()) } },
      ],
    });
  });

  async function toasts() {
    const fixture = TestBed.createComponent(Toasts);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const b = TestBed.inject(Benachrichtigungen);
    return {
      fixture,
      element,
      b,
      melden: async (...args: Parameters<Benachrichtigungen['melden']>) => {
        b.melden(...args);
        await fixture.whenStable();
      },
    };
  }

  it('hat die Live-Region schon ohne Meldung', async () => {
    const { element } = await toasts();
    expect(
      element.querySelector('section[aria-label="Meldungen"] [aria-live="polite"]'),
    ).not.toBeNull();
    expect(element.querySelector('.toast')).toBeNull();
  });

  it('zeigt Titel mit der Art für Screenreader, Text und Zeitbalken; neueste zuletzt im DOM', async () => {
    const { element, melden } = await toasts();
    await melden({ art: 'erfolg', titel: 'Gespeichert.' });
    await melden({ art: 'info', titel: 'Hinweis', text: 'Mehr dazu' });
    const alle = element.querySelectorAll('.toast');
    expect(alle).toHaveLength(2);
    expect(alle[0].getAttribute('role')).toBe('status');
    expect(alle[0].querySelector('.titel')?.textContent?.trim()).toBe('Erfolg: Gespeichert.');
    expect(alle[1].querySelector('.text')?.textContent).toBe('Mehr dazu');
    expect(alle[0].querySelector<HTMLElement>('.zeit')?.style.animationDuration).toBe('5000ms');
  });

  it('zeigt Fehler als alert, ohne Zeitbalken', async () => {
    const { element, melden } = await toasts();
    await melden({ art: 'fehler', titel: 'Ging nicht.' });
    const toast = element.querySelector('.toast')!;
    expect(toast.getAttribute('role')).toBe('alert');
    expect(toast.querySelector('.zeit')).toBeNull();
  });

  it('schließt mit ×, gelesen ins Center', async () => {
    const { element, fixture, b, melden } = await toasts();
    await melden({ art: 'fehler', titel: 'Ging nicht.' });
    element.querySelector<HTMLButtonElement>('button[aria-label="Meldung schließen"]')!.click();
    await fixture.whenStable();
    expect(element.querySelector('.toast')).toBeNull();
    expect(b.eintraege()).toMatchObject([{ titel: 'Ging nicht.', gelesen: true }]);
  });

  it('hält die Zeit bei Maus und Fokus an', async () => {
    const { element, b, melden } = await toasts();
    const anhalten = vi.spyOn(b, 'anhalten');
    const fortsetzen = vi.spyOn(b, 'fortsetzen');
    await melden({ art: 'erfolg', titel: 'x' });
    const toast = element.querySelector('.toast')!;
    toast.dispatchEvent(new MouseEvent('mouseenter'));
    toast.dispatchEvent(new MouseEvent('mouseleave'));
    toast.dispatchEvent(new FocusEvent('focusin'));
    // Fokus wandert innerhalb des Toasts: weiter angehalten.
    toast.dispatchEvent(
      new FocusEvent('focusout', { relatedTarget: toast.querySelector('button') }),
    );
    expect(anhalten).toHaveBeenCalledTimes(2);
    expect(fortsetzen).toHaveBeenCalledTimes(2); // mouseleave und der Start beim Melden
    toast.dispatchEvent(new FocusEvent('focusout'));
    expect(fortsetzen).toHaveBeenCalledTimes(3);
  });

  it('steht unter dem, was oben steht (data-kopf), und folgt ihm, solange Toasts stehen', async () => {
    const kopf = document.createElement('header');
    kopf.setAttribute('data-kopf', '');
    let unten = 84;
    kopf.getBoundingClientRect = () => ({ height: 60, bottom: unten }) as DOMRect;
    const { element, melden } = await toasts();
    expect(element.classList.contains('mit-kopfzeile')).toBe(false);

    document.body.appendChild(kopf);
    await melden({ art: 'fehler', titel: 'x' });
    await vi.waitFor(() => expect(element.style.getPropertyValue('--toasts-kante')).toBe('84px'));
    expect(element.classList.contains('mit-kopfzeile')).toBe(true);

    // Gescrollt: Die Kopfzeile klebt oben, der Toast geht mit.
    unten = 60;
    await vi.waitFor(() => expect(element.style.getPropertyValue('--toasts-kante')).toBe('60px'));

    // Ausgeblendet zählt nicht.
    kopf.getBoundingClientRect = () => ({ height: 0, bottom: 0 }) as DOMRect;
    await vi.waitFor(() => expect(element.classList.contains('mit-kopfzeile')).toBe(false));
    kopf.remove();
  });
});
