import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { LoginSeite } from './login-seite';

describe('LoginSeite', () => {
  let fixture: ComponentFixture<LoginSeite>;
  let element: HTMLElement;
  let anmelden: ReturnType<typeof vi.fn>;
  let navigiert: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    anmelden = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [LoginSeite],
      providers: [provideRouter([]), { provide: AuthService, useValue: { anmelden } }],
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
});
