import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Systemstatus, SystemstatusService } from '../../core/systemstatus/systemstatus.service';
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
        provideRouter([]),
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

  it('verlangt E-Mail-Adresse und Passwort', async () => {
    await eingeben('max@beispiel.de', '');
    await absenden();

    expect(fehlertext()).toBe('Bitte gib E-Mail-Adresse und Passwort ein.');
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

  it('zeigt den Grund einer abgelehnten Anmeldung', async () => {
    anmelden.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, error: { grund: 'UNGUELTIG' } })),
    );
    await eingeben('max@beispiel.de', 'falsch');
    await absenden();

    expect(fehlertext()).toBe('E-Mail-Adresse oder Passwort ist falsch. Bitte versuche es erneut.');
    expect(element.querySelector('#login-passwort')?.getAttribute('aria-invalid')).toBe('true');
    expect(navigiert).not.toHaveBeenCalled();
  });

  it('blendet den Fehler beim Tippen aus', async () => {
    await absenden();
    expect(fehlertext()).toBeDefined();

    await eingeben('m', '');
    expect(fehlertext()).toBeUndefined();
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
