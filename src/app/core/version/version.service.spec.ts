import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { version } from '../../../../package.json';
import { FRONTEND, INFO_URL, VersionService } from './version.service';

describe('VersionService', () => {
  let service: VersionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VersionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('nimmt die Frontend-Version aus der package.json, ohne Commit und Build-Zeit bei npm start', () => {
    expect(FRONTEND).toEqual({ version, commit: undefined, buildZeit: undefined });
    expect(service.frontend.version).toBe(version);
  });

  it('liest Version, Commit, Build-Zeit und Stage des Backends', () => {
    service.laden();
    http.expectOne(INFO_URL).flush({
      build: { version: '0.1.0', time: '2026-11-05T17:00:00Z' },
      git: { commit: { id: '48eaea5' } },
      app: { stage: 'DEV' },
    });
    expect(service.backend()).toEqual({
      version: '0.1.0',
      commit: '48eaea5',
      buildZeit: '2026-11-05T17:00:00Z',
    });
    expect(service.stage()).toBe('DEV');
  });

  it('kommt ohne build und git aus, wie beim Start aus der IDE', () => {
    service.laden();
    http.expectOne(INFO_URL).flush({ app: { stage: 'DEV' }, git: {} });
    expect(service.backend()).toEqual({
      version: undefined,
      commit: undefined,
      buildZeit: undefined,
    });
    expect(service.stage()).toBe('DEV');
  });

  it('fragt nach einer Antwort nicht erneut und während einer Anfrage nicht doppelt', () => {
    service.laden();
    service.laden();
    http.expectOne(INFO_URL).flush({});
    service.laden();
    http.expectNone(INFO_URL);
    expect(service.stage()).toBeUndefined();
  });

  it('bleibt ohne Antwort leer und versucht es beim nächsten Aufruf erneut', () => {
    service.laden();
    http.expectOne(INFO_URL).flush(null, { status: 502, statusText: 'Bad Gateway' });
    expect(service.backend()).toBeUndefined();
    expect(service.stage()).toBeUndefined();

    service.laden();
    http.expectOne(INFO_URL).flush({ app: { stage: 'PROD' } });
    expect(service.stage()).toBe('PROD');
  });

  it('gibt nach 5 s auf', () => {
    vi.useFakeTimers();
    service.laden();
    const anfrage = http.expectOne(INFO_URL);
    vi.advanceTimersByTime(5_000);
    expect(anfrage.cancelled).toBe(true);
    service.laden();
    http.expectOne(INFO_URL).flush({ app: { stage: 'PROD' } });
    expect(service.stage()).toBe('PROD');
  });
});
