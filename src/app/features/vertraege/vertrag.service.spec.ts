import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { VertragAnfrage } from '../../core/api/api';
import { VertragService } from './vertrag.service';

const ANFRAGE: VertragAnfrage = {
  anbieter: 'Musterversicherung AG',
  kategorieId: '7cb7a2b8-38a6-432d-8546-03b3d74f76ec',
  preise: [{ gueltigAb: '2026-01-01', betrag: { wert: 586.8, waehrung: 'EUR' } }],
  einmalkosten: [],
  erinnerungSonderkuendigung: true,
  zahlweise: 'JAEHRLICH',
  beginn: '2026-01-01',
  kuendbar: true,
};

describe('VertragService', () => {
  let service: VertragService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VertragService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listet auf', () => {
    service.auflisten().subscribe();
    http.expectOne({ method: 'GET', url: '/api/vertraege' }).flush([]);
  });

  it('legt an', () => {
    service.anlegen(ANFRAGE).subscribe();
    const req = http.expectOne({ method: 'POST', url: '/api/vertraege' });
    expect(req.request.body).toEqual(ANFRAGE);
    req.flush({});
  });

  it('ändert mit der Version im Body', () => {
    const aenderung = { ...ANFRAGE, version: 3, unterbrechungIds: [] };
    service.aendern('v1', aenderung).subscribe();
    const req = http.expectOne({ method: 'PUT', url: '/api/vertraege/v1' });
    expect(req.request.body).toEqual(aenderung);
    req.flush({});
  });

  it('löscht mit der Version als Parameter', () => {
    let fertig = false;
    service.loeschen('v1', 3).subscribe(() => (fertig = true));
    http
      .expectOne({ method: 'DELETE', url: '/api/vertraege/v1?version=3' })
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(fertig).toBe(true);
  });

  it('ruft die Kategorien ab', () => {
    service.kategorien().subscribe();
    http.expectOne({ method: 'GET', url: '/api/vertraege/kategorien' }).flush([]);
  });

  it('ruft die Übersicht ab', () => {
    service.uebersicht().subscribe();
    http.expectOne({ method: 'GET', url: '/api/vertraege/uebersicht' }).flush({});
  });

  it('fragt die Vorschau an', () => {
    service.vorschau({ kuendbar: true }).subscribe();
    const req = http.expectOne({ method: 'POST', url: '/api/vertraege/vorschau' });
    expect(req.request.body).toEqual({ kuendbar: true });
    req.flush({});
  });
});
