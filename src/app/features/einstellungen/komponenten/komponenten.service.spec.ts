import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { KomponentenService } from './komponenten.service';

describe('KomponentenService', () => {
  it('lädt und ändert die Komponenten', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(KomponentenService);
    const http = TestBed.inject(HttpTestingController);
    const antwort = { komponenten: ['PORTFOLIO' as const], version: 2 };

    let geladen: unknown;
    service.laden().subscribe((a) => (geladen = a));
    http.expectOne({ url: '/api/nutzer/ich/komponenten', method: 'GET' }).flush(antwort);
    expect(geladen).toEqual(antwort);

    service.aendern(antwort).subscribe();
    const put = http.expectOne({ url: '/api/nutzer/ich/komponenten', method: 'PUT' });
    expect(put.request.body).toEqual(antwort);
    put.flush(antwort);
    http.verify();
  });
});
