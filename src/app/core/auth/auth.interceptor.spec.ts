import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { OHNE_ANMELDE_UMLEITUNG } from './auth-context';
import { authInterceptor } from './auth.interceptor';
import { AuthService, KOMPONENTEN_URL } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let navigiert: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    navigiert = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('leitet bei 401 zum Login um', () => {
    http.get('/api/buchungen').subscribe({ error: () => undefined });
    backend.expectOne('/api/buchungen').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(navigiert).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/' } });
  });

  it('erhält die returnUrl, wenn ein weiteres 401 auf dem Login ankommt', () => {
    const zuruecksetzen = vi.spyOn(TestBed.inject(AuthService), 'zuruecksetzen');
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/login?returnUrl=%2Fvertraege');

    http.get('/api/buchungen').subscribe({ error: () => undefined });
    backend.expectOne('/api/buchungen').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(navigiert).not.toHaveBeenCalled();
    expect(zuruecksetzen).toHaveBeenCalled();
  });

  it('lässt 401 bei Aufrufen mit erwarteter 401 durch', () => {
    const context = new HttpContext().set(OHNE_ANMELDE_UMLEITUNG, true);
    http.post('/api/anmeldung', {}, { context }).subscribe({ error: () => undefined });
    backend.expectOne('/api/anmeldung').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(navigiert).not.toHaveBeenCalled();
  });

  it('leitet bei anderen Fehlern nicht um', () => {
    http.get('/api/buchungen').subscribe({ error: () => undefined });
    backend.expectOne('/api/buchungen').flush(null, { status: 403, statusText: 'Forbidden' });

    expect(navigiert).not.toHaveBeenCalled();
  });

  describe('bei 403', () => {
    const verboten = (code: string) => ({
      body: { status: 403, code },
      optionen: { status: 403, statusText: 'Forbidden' },
    });
    let zurStartseite: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      zurStartseite = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    });

    it('lädt bei KEIN_ZUGRIFF die Komponenten neu und geht zur Startseite', () => {
      let fehler: unknown;
      http.get('/api/vertraege').subscribe({ error: (e: unknown) => (fehler = e) });
      const { body, optionen } = verboten('KEIN_ZUGRIFF');
      backend.expectOne('/api/vertraege').flush(body, optionen);

      expect(fehler).toBeDefined();
      expect(zurStartseite).not.toHaveBeenCalled();
      backend.expectOne(KOMPONENTEN_URL).flush({ komponenten: ['PORTFOLIO'], version: 0 });

      expect(TestBed.inject(AuthService).komponenten()).toEqual(['PORTFOLIO']);
      expect(zurStartseite).toHaveBeenCalledWith('/start');
    });

    it('lässt CSRF_TOKEN_UNGUELTIG unberührt', () => {
      http.post('/api/vertraege', {}).subscribe({ error: () => undefined });
      const { body, optionen } = verboten('CSRF_TOKEN_UNGUELTIG');
      backend.expectOne('/api/vertraege').flush(body, optionen);

      backend.expectNone(KOMPONENTEN_URL);
      expect(zurStartseite).not.toHaveBeenCalled();
    });

    it('lädt nicht in einer Schleife, wenn der Komponentenabruf selbst 403 liefert', () => {
      TestBed.inject(AuthService).komponentenLaden().subscribe();
      const { body, optionen } = verboten('KEIN_ZUGRIFF');
      backend.expectOne(KOMPONENTEN_URL).flush(body, optionen);

      backend.expectNone(KOMPONENTEN_URL);
    });
  });
});
