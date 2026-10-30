import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { allesErreichbar, Systemstatus, SystemstatusService } from './systemstatus.service';

const URL = '/actuator/health/systemstatus';

describe('SystemstatusService', () => {
  let service: SystemstatusService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SystemstatusService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function abfragen(antwort: (url: string) => void): Systemstatus | undefined {
    let status: Systemstatus | undefined;
    service.abfragen().subscribe((s) => (status = s));
    antwort(URL);
    return status;
  }

  it('meldet alles erreichbar', () => {
    const status = abfragen((url) =>
      http.expectOne(url).flush({
        status: 'UP',
        components: { db: { status: 'UP' }, keycloak: { status: 'UP' } },
      }),
    );
    expect(status).toEqual({ backend: true, datenbank: true, anmeldeserver: true });
    expect(allesErreichbar(status!)).toBe(true);
  });

  it('wertet 503 mit Komponenten aus', () => {
    const status = abfragen((url) =>
      http
        .expectOne(url)
        .flush(
          { status: 'DOWN', components: { db: { status: 'UP' }, keycloak: { status: 'DOWN' } } },
          { status: 503, statusText: 'Service Unavailable' },
        ),
    );
    expect(status).toEqual({ backend: true, datenbank: true, anmeldeserver: false });
    expect(allesErreichbar(status!)).toBe(false);
  });

  it('wertet eine fehlende Komponente als nicht erreichbar', () => {
    const status = abfragen((url) =>
      http.expectOne(url).flush({ status: 'UP', components: { db: { status: 'UP' } } }),
    );
    expect(status?.anmeldeserver).toBe(false);
  });

  it('meldet ohne Backend alles als nicht erreichbar', () => {
    const status = abfragen((url) =>
      http.expectOne(url).flush('Bad Gateway', { status: 502, statusText: 'Bad Gateway' }),
    );
    expect(status).toEqual({ backend: false, datenbank: false, anmeldeserver: false });
  });

  it('fragt alle 30 Sekunden erneut', () => {
    vi.useFakeTimers();
    try {
      const sub = service.beobachten().subscribe();
      vi.advanceTimersByTime(0);
      http.expectOne(URL).flush({});
      vi.advanceTimersByTime(29_999);
      http.expectNone(URL);
      vi.advanceTimersByTime(1);
      http.expectOne(URL).flush({});
      sub.unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });
});
