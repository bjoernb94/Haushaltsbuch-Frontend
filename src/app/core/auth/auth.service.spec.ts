import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OHNE_ANMELDE_UMLEITUNG } from './auth-context';
import { anmeldungFehlgrund, AuthService, Nutzer } from './auth.service';

const MAX: Nutzer = { vorname: 'Max', name: 'Muster', email: 'max@beispiel.de' };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fragt den Status nur beim ersten Mal ab', () => {
    const ergebnisse: boolean[] = [];
    auth.sitzungPruefen().subscribe((a) => ergebnisse.push(a));
    const req = http.expectOne('/api/nutzer/ich');
    expect(req.request.context.get(OHNE_ANMELDE_UMLEITUNG)).toBe(true);
    req.flush(MAX);

    auth.sitzungPruefen().subscribe((a) => ergebnisse.push(a));
    http.expectNone('/api/nutzer/ich');

    expect(ergebnisse).toEqual([true, true]);
    expect(auth.nutzer()).toEqual(MAX);
  });

  it('wertet 401 beim Status als abgemeldet', () => {
    let angemeldet: boolean | undefined;
    auth.sitzungPruefen().subscribe((a) => (angemeldet = a));
    http.expectOne('/api/nutzer/ich').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(angemeldet).toBe(false);
    expect(auth.angemeldet()).toBe(false);
  });

  it('wertet ein nicht erreichbares Backend als abgemeldet und fragt erneut', () => {
    const ergebnisse: boolean[] = [];
    auth.sitzungPruefen().subscribe((a) => ergebnisse.push(a));
    http.expectOne('/api/nutzer/ich').flush(null, { status: 504, statusText: 'Gateway Timeout' });

    auth.sitzungPruefen().subscribe((a) => ergebnisse.push(a));
    http.expectOne('/api/nutzer/ich').flush(MAX);

    expect(ergebnisse).toEqual([false, true]);
  });

  it('meldet an und lädt danach den Nutzer', () => {
    let fertig = false;
    auth.anmelden('max@beispiel.de', 'geheim123').subscribe(() => (fertig = true));

    const req = http.expectOne({ method: 'POST', url: '/api/anmeldung' });
    expect(req.request.body).toEqual({ email: 'max@beispiel.de', passwort: 'geheim123' });
    expect(req.request.context.get(OHNE_ANMELDE_UMLEITUNG)).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/nutzer/ich').flush(MAX);

    expect(fertig).toBe(true);
    expect(auth.angemeldet()).toBe(true);
  });

  it('vergisst den Nutzer beim Abmelden', () => {
    auth.anmelden('max@beispiel.de', 'geheim123').subscribe();
    http.expectOne('/api/anmeldung').flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/nutzer/ich').flush(MAX);

    auth.abmelden().subscribe();
    http.expectOne({ method: 'POST', url: '/api/abmeldung' }).flush(null, {
      status: 204,
      statusText: 'No Content',
    });

    expect(auth.angemeldet()).toBe(false);
  });
});

describe('anmeldungFehlgrund', () => {
  it('liest den Grund aus dem ProblemDetail', () => {
    const error = new HttpErrorResponse({ status: 403, error: { grund: 'GESPERRT' } });
    expect(anmeldungFehlgrund(error)).toBe('GESPERRT');
  });

  it('liefert null ohne bekannten Grund', () => {
    expect(anmeldungFehlgrund(new HttpErrorResponse({ status: 0 }))).toBeNull();
    expect(anmeldungFehlgrund(new HttpErrorResponse({ status: 500, error: 'x' }))).toBeNull();
  });
});
