import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { Benachrichtigungen } from '../../../core/benachrichtigungen/benachrichtigungen';
import { AuthService } from '../../../core/auth/auth.service';
import { Systemstatus, SystemstatusService } from '../../../core/systemstatus/systemstatus.service';
import { RegistrierungSeite } from './registrierung-seite';

describe('RegistrierungSeite', () => {
  const melden = vi.fn();
  let fixture: ComponentFixture<RegistrierungSeite>;
  let element: HTMLElement;
  let registrieren: ReturnType<typeof vi.fn>;
  let router: Router;
  let systemstatus: BehaviorSubject<Systemstatus>;

  beforeEach(async () => {
    registrieren = vi.fn(() => of(true));
    melden.mockClear();
    systemstatus = new BehaviorSubject<Systemstatus>({
      backend: true,
      datenbank: true,
      anmeldeserver: true,
    });
    await TestBed.configureTestingModule({
      imports: [RegistrierungSeite],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { registrieren } },
        { provide: Benachrichtigungen, useValue: { melden } },
        { provide: SystemstatusService, useValue: { beobachten: () => systemstatus } },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(RegistrierungSeite);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const feld = (id: string) => element.querySelector<HTMLInputElement>('#' + id)!;

  async function ausfuellen(werte: Partial<Record<string, string>>) {
    for (const [id, wert] of Object.entries(werte)) {
      feld(id).value = wert!;
      feld(id).dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
  }

  async function komponenteWaehlen(titel: string) {
    const karte = [...element.querySelectorAll('label.karte')].find((l) =>
      l.textContent?.includes(titel),
    );
    karte!.querySelector('input')!.click();
    await fixture.whenStable();
  }

  async function absenden() {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  }

  async function gueltigAusfuellen() {
    await ausfuellen({
      'reg-email': 'max@beispiel.de',
      'reg-passwort': 'Geheim12!',
      'reg-name': 'Muster',
      'reg-vorname': 'Max',
    });
    await komponenteWaehlen('Portfolio');
  }

  const hinweis = () => element.querySelector('[role="alert"]')?.textContent?.trim();
  const ungueltig = (id: string) => feld(id).getAttribute('aria-invalid') === 'true';

  it('markiert nach dem Absenden alle fehlerhaften Felder', async () => {
    await ausfuellen({ 'reg-email': 'max@beispiel.de', 'reg-passwort': 'kurz' });
    expect(ungueltig('reg-name')).toBe(false);

    await absenden();

    expect(hinweis()).toBe('Bitte fülle alle Felder aus.');
    expect(ungueltig('reg-email')).toBe(false);
    expect(ungueltig('reg-passwort')).toBe(true);
    expect(ungueltig('reg-name')).toBe(true);
    expect(ungueltig('reg-vorname')).toBe(true);
    expect(element.querySelector('.karten')?.classList).toContain('ungueltig');
    expect(registrieren).not.toHaveBeenCalled();
  });

  it('nimmt die Markierung zurück, sobald ein Feld passt', async () => {
    await absenden();
    await ausfuellen({ 'reg-name': 'Muster' });

    expect(hinweis()).toBeUndefined();
    expect(ungueltig('reg-name')).toBe(false);
    expect(ungueltig('reg-vorname')).toBe(true);
  });

  it('hakt die Passwortregeln beim Tippen ab', async () => {
    const zustaende = () =>
      [...element.querySelectorAll('#reg-passwort-regeln li')].map((li) => li.className);
    expect(zustaende().every((z) => z === 'offen')).toBe(true);

    await ausfuellen({ 'reg-passwort': 'Geheim1' });

    expect(zustaende()).toEqual([
      'verletzt',
      'erfuellt',
      'erfuellt',
      'erfuellt',
      'verletzt',
      'erfuellt',
    ]);
  });

  it('registriert und geht zur Startseite', async () => {
    await gueltigAusfuellen();
    await absenden();

    expect(registrieren).toHaveBeenCalledWith({
      email: 'max@beispiel.de',
      passwort: 'Geheim12!',
      name: 'Muster',
      vorname: 'Max',
      komponenten: ['PORTFOLIO'],
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/start');
  });

  it('schickt zum Login, wenn die automatische Anmeldung scheitert', async () => {
    registrieren.mockReturnValue(of(false));
    await gueltigAusfuellen();
    await absenden();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    await vi.waitFor(() =>
      expect(melden).toHaveBeenCalledWith({
        art: 'erfolg',
        titel: 'Dein Konto wurde angelegt.',
        text: 'Bitte melde dich an.',
      }),
    );
  });

  it('markiert eine vergebene E-Mail-Adresse', async () => {
    registrieren.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { code: 'EMAIL_BEREITS_VERGEBEN' } }),
      ),
    );
    await gueltigAusfuellen();
    await absenden();

    expect(hinweis()).toBe('Für diese E-Mail-Adresse gibt es bereits ein Konto.');
    expect(ungueltig('reg-email')).toBe(true);
  });

  it('zeigt bei einer Ablehnung den eigenen Text statt detail', async () => {
    registrieren.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { code: 'REGISTRIERUNG_ABGELEHNT', detail: 'Invalid password.' },
          }),
      ),
    );
    await gueltigAusfuellen();
    await absenden();

    expect(hinweis()).toBe(
      'Das Konto konnte mit diesen Daten nicht angelegt werden. Bitte prüfe deine Eingaben, vor allem das Passwort.',
    );
    expect(ungueltig('reg-passwort')).toBe(false);
  });

  it('markiert die Felder eines Validierungsfehlers', async () => {
    registrieren.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              code: 'VALIDIERUNG',
              felder: [
                { feld: 'email', code: 'Email', parameter: {} },
                { feld: 'name', code: 'Size', parameter: { max: 255 } },
                { feld: 'unbekannt', code: 'NotNull', parameter: {} },
              ],
            },
          }),
      ),
    );
    await gueltigAusfuellen();
    await absenden();

    expect(hinweis()).toBe('Bitte prüfe die markierten Felder.');
    expect(ungueltig('reg-email')).toBe(true);
    expect(ungueltig('reg-name')).toBe(true);
    expect(ungueltig('reg-vorname')).toBe(false);

    await ausfuellen({ 'reg-name': 'Muster' });
    expect(hinweis()).toBeUndefined();
    expect(ungueltig('reg-email')).toBe(false);
  });

  it('zeigt ohne Code den allgemeinen Text, auch bei Status 409', async () => {
    registrieren.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'x' } })),
    );
    await gueltigAusfuellen();
    await absenden();

    expect(hinweis()).toBe(
      'Die Registrierung ist gerade nicht möglich. Bitte versuche es später erneut.',
    );
    expect(ungueltig('reg-email')).toBe(false);
  });

  it('bittet bei nicht erreichbarem Keycloak, es später erneut zu versuchen', async () => {
    registrieren.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 503, error: { code: 'KEYCLOAK_NICHT_ERREICHBAR' } }),
      ),
    );
    await gueltigAusfuellen();
    await absenden();

    expect(hinweis()).toBe(
      'Die Registrierung ist gerade nicht möglich. Bitte versuche es später erneut.',
    );
    expect(ungueltig('reg-email')).toBe(false);
  });

  it('sperrt das Formular, wenn ein Dienst fehlt', async () => {
    systemstatus.next({ backend: true, datenbank: true, anmeldeserver: false });
    await fixture.whenStable();

    expect(hinweis()).toBe('Registrierung gerade nicht möglich.');
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    expect(element.textContent).toContain('Anmeldeserver nicht erreichbar');
  });

  it('sendet nur einmal, solange die Registrierung läuft', async () => {
    registrieren.mockReturnValue(new Subject<boolean>());
    await gueltigAusfuellen();
    await absenden();
    await absenden();

    expect(registrieren).toHaveBeenCalledTimes(1);
  });
});
