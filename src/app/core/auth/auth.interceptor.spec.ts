import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { OHNE_ANMELDE_UMLEITUNG } from './auth-context';
import { authInterceptor } from './auth.interceptor';

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
});
