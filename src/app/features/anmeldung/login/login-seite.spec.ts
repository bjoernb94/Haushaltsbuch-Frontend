import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Systemstatus, SystemstatusService } from '../../../core/systemstatus/systemstatus.service';
import { LoginSeite } from './login-seite';

describe('LoginSeite', () => {
  let fixture: ComponentFixture<LoginSeite>;
  let element: HTMLElement;
  let anmelden: ReturnType<typeof vi.fn>;
  let navigiert: ReturnType<typeof vi.spyOn>;
  let systemstatus: BehaviorSubject<Systemstatus>;

  beforeEach(async () => {
    anmelden = vi.fn(() => of(undefined));
    systemstatus = new BehaviorSubject<Systemstatus>({
      backend: true,
      datenbank: true,
      anmeldeserver: true,
    });
    await TestBed.configureTestingModule({
      imports: [LoginSeite],
      providers: [
        provideRouter([
          { path: 'login', children: [] },
          { path: 'impressum', children: [] },
        ]),
        { provide: AuthService, useValue: { anmelden } },
        { provide: SystemstatusService, useValue: { beobachten: () => systemstatus } },
      ],
    }).compileComponents();
    navigiert = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginSeite);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  async function eingeben(email: string, passwort: string) {
    for (const [id, wert] of [
      ['login-email', email],
      ['login-passwort', passwort],
    ]) {
      const input = element.querySelector<HTMLInputElement>('#' + id)!;
      input.value = wert;
      input.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
  }

  async function absenden() {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  }

  const fehlertext = () => element.querySelector('[role="alert"]')?.textContent?.trim();

  const felderMarkiert = () =>
    ['login-email', 'login-passwort'].map(
      (id) => element.querySelector('#' + id)?.getAttribute('aria-invalid') === 'true',
    );

  it('verlangt E-Mail-Adresse und Passwort', async () => {
    await eingeben('max@beispiel.de', '');
    await absenden();

    expect(fehlertext()).toBe('Bitte gib E-Mail-Adresse und Passwort ein.');
    expect(felderMarkiert()).toEqual([true, true]);
    expect(anmelden).not.toHaveBeenCalled();
  });

  it('meldet an und geht zur Startseite', async () => {
    await eingeben(' max@beispiel.de ', 'geheim123');
    await absenden();

    expect(anmelden).toHaveBeenCalledWith('max@beispiel.de', 'geheim123');
    expect(navigiert).toHaveBeenCalledWith('/start');
  });

  it('geht nach der Anmeldung zur ursprünglichen Seite zurück', async () => {
    fixture.componentRef.setInput('returnUrl', '/vertraege');
    await eingeben('max@beispiel.de', 'geheim123');
    await absenden();

    expect(navigiert).toHaveBeenCalledWith('/vertraege');
  });

  async function ablehnen(status: number, error: unknown) {
    anmelden.mockReturnValue(throwError(() => new HttpErrorResponse({ status, error })));
    await eingeben('max@beispiel.de', 'falsch');
    await absenden();
  }

  it('zeigt den Grund einer abgelehnten Anmeldung', async () => {
    anmelden.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 401, error: { code: 'ANMELDUNG_UNGUELTIG' } }),
      ),
    );
    await eingeben('max@beispiel.de', 'falsch');
    await absenden();

    expect(fehlertext()).toBe('E-Mail-Adresse oder Passwort ist falsch. Bitte versuche es erneut.');
    expect(felderMarkiert()).toEqual([true, true]);
    expect(navigiert).not.toHaveBeenCalled();
  });

  it('hat für gesperrte und nicht eingerichtete Konten eigene Texte', async () => {
    await ablehnen(403, { code: 'ANMELDUNG_GESPERRT' });
    expect(fehlertext()).toBe('Das Konto ist gesperrt. Bitte versuche es später erneut.');

    await ablehnen(403, { code: 'ANMELDUNG_NICHT_EINGERICHTET' });
    expect(fehlertext()).toBe('Das Konto ist noch nicht vollständig eingerichtet.');
  });

  it('verweist bei unvollständigem Konto auf den Support statt auf später', async () => {
    await ablehnen(403, { code: 'KONTO_UNVOLLSTAENDIG' });

    expect(fehlertext()).toBe(
      'Dein Konto wurde nicht vollständig angelegt. Bitte wende dich an den Support, er kann es ' +
        'entfernen. Danach kannst du dich neu registrieren.',
    );
    expect(fehlertext()).not.toContain('Das Konto ist noch nicht vollständig eingerichtet.');
    expect(felderMarkiert()).toEqual([false, false]);

    const support = element.querySelector<HTMLAnchorElement>('[role="alert"] a')!;
    expect(support.textContent?.trim()).toBe('Support');
    expect(support.getAttribute('href')).toBe('/impressum#kontakt');
  });

  it('gibt dem Support-Link die Login-Seite als Herkunft mit', async () => {
    const router = TestBed.inject(Router);
    navigiert.mockRestore();
    await router.navigateByUrl('/login?returnUrl=%2Fvertraege');
    await ablehnen(403, { code: 'KONTO_UNVOLLSTAENDIG' });

    element.querySelector<HTMLAnchorElement>('[role="alert"] a')!.click();
    await fixture.whenStable();

    expect(router.url).toBe('/impressum#kontakt');
    expect(TestBed.inject(Location).getState()).toMatchObject({
      herkunft: '/login?returnUrl=%2Fvertraege',
    });
  });

  it('blendet den Support-Hinweis beim Tippen aus, gesperrt geht vor', async () => {
    await ablehnen(403, { code: 'KONTO_UNVOLLSTAENDIG' });
    systemstatus.next({ backend: true, datenbank: false, anmeldeserver: true });
    await fixture.whenStable();
    expect(fehlertext()).toBe('Login gerade nicht möglich.');

    systemstatus.next({ backend: true, datenbank: true, anmeldeserver: true });
    await fixture.whenStable();
    expect(fehlertext()).toContain('Support');

    await eingeben('max@beispiel.de', 'x');
    expect(fehlertext()).toBeUndefined();
  });

  it('bittet bei nicht erreichbarem Keycloak, es später erneut zu versuchen', async () => {
    await ablehnen(503, { code: 'KEYCLOAK_NICHT_ERREICHBAR' });
    expect(fehlertext()).toBe(
      'Die Anmeldung ist gerade nicht möglich. Bitte versuche es später erneut.',
    );
    expect(felderMarkiert()).toEqual([false, false]);
  });

  it('meldet Validierungsfehler des Backends', async () => {
    await ablehnen(400, { code: 'VALIDIERUNG', felder: [] });
    expect(fehlertext()).toBe('Bitte gib E-Mail-Adresse und Passwort ein.');
  });

  it('zeigt bei unbekanntem oder fehlendem Code den allgemeinen Text, nie detail', async () => {
    const allgemein = 'Die Anmeldung ist gerade nicht möglich. Bitte versuche es später erneut.';

    await ablehnen(500, { code: 'INTERNER_FEHLER', detail: 'Unexpected error.' });
    expect(fehlertext()).toBe(allgemein);

    await ablehnen(401, { detail: 'Invalid credentials.' });
    expect(fehlertext()).toBe(allgemein);

    await ablehnen(502, '<html>');
    expect(fehlertext()).toBe(allgemein);
  });

  it('markiert die Felder nur, wenn es an den Eingaben liegt', async () => {
    await ablehnen(400, { code: 'VALIDIERUNG', felder: [] });
    expect(felderMarkiert()).toEqual([true, true]);

    await ablehnen(403, { code: 'ANMELDUNG_GESPERRT' });
    expect(felderMarkiert()).toEqual([false, false]);

    await ablehnen(401, { code: 'ANMELDUNG_UNGUELTIG' });
    await ablehnen(403, { code: 'ANMELDUNG_NICHT_EINGERICHTET' });
    expect(felderMarkiert()).toEqual([false, false]);

    await ablehnen(401, { code: 'ANMELDUNG_UNGUELTIG' });
    await ablehnen(500, { code: 'INTERNER_FEHLER' });
    expect(felderMarkiert()).toEqual([false, false]);

    await ablehnen(401, { code: 'ANMELDUNG_UNGUELTIG' });
    await ablehnen(0, null);
    expect(felderMarkiert()).toEqual([false, false]);
  });

  it('markiert keine Felder, wenn das Formular gesperrt ist', async () => {
    await ablehnen(401, { code: 'ANMELDUNG_UNGUELTIG' });
    expect(felderMarkiert()).toEqual([true, true]);

    systemstatus.next({ backend: true, datenbank: false, anmeldeserver: true });
    await fixture.whenStable();
    expect(felderMarkiert()).toEqual([false, false]);
  });

  it('blendet den Fehler und die Markierung beim Tippen aus', async () => {
    await absenden();
    expect(fehlertext()).toBeDefined();
    expect(felderMarkiert()).toEqual([true, true]);

    await eingeben('m', '');
    expect(fehlertext()).toBeUndefined();
    expect(felderMarkiert()).toEqual([false, false]);
  });

  it('sperrt den Knopf, solange die Anmeldung läuft', async () => {
    anmelden.mockReturnValue(new Subject<void>());
    await eingeben('max@beispiel.de', 'geheim123');
    await absenden();
    await absenden();

    expect(anmelden).toHaveBeenCalledTimes(1);
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it('zeigt den Systemstatus', () => {
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Datenbank');
  });

  it('sperrt Login und Registrierung, wenn ein Dienst fehlt', async () => {
    systemstatus.next({ backend: true, datenbank: false, anmeldeserver: true });
    await fixture.whenStable();

    expect(fehlertext()).toBe('Login gerade nicht möglich.');
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    const registrieren = [...element.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Registrieren',
    );
    expect(registrieren?.disabled).toBe(true);
    expect(element.querySelector('a[href="/registrierung"]')).toBeNull();
    expect(element.textContent).toContain('Datenbank nicht erreichbar');

    await eingeben('max@beispiel.de', 'geheim123');
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(anmelden).not.toHaveBeenCalled();
  });

  it('gibt den Login wieder frei, sobald alle Dienste erreichbar sind', async () => {
    systemstatus.next({ backend: false, datenbank: false, anmeldeserver: false });
    await fixture.whenStable();
    systemstatus.next({ backend: true, datenbank: true, anmeldeserver: true });
    await fixture.whenStable();

    expect(fehlertext()).toBeUndefined();
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });

  it('bestätigt nach einer Registrierung das angelegte Konto', async () => {
    fixture.componentRef.setInput('registriert', 'true');
    await fixture.whenStable();

    expect(element.querySelector('[role="status"]:not([aria-label])')?.textContent?.trim()).toBe(
      'Dein Konto wurde angelegt. Bitte melde dich an.',
    );
  });
});
