import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Instanzangaben, INSTANZ_URL, InstanzService } from './instanz.service';

const ANGABEN: Instanzangaben = {
  betreiber: {
    name: 'Max Muster',
    anschrift: ['Musterweg 1', '12345 Musterstadt'],
    email: 'betrieb@beispiel.de',
  },
  rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO',
  speicherort: 'Server in Deutschland',
  logAufbewahrungTage: 14,
  stand: '2026-11-08',
};

describe('InstanzService', () => {
  let service: InstanzService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InstanzService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function laden(antwort: (anfrage: ReturnType<HttpTestingController['expectOne']>) => void) {
    service.laden();
    antwort(http.expectOne(INSTANZ_URL));
    return service.stand();
  }

  it('liest die Angaben und lädt danach nicht erneut', () => {
    expect(laden((a) => a.flush(ANGABEN))).toEqual({
      zustand: 'da',
      angaben: ANGABEN,
      quellcode: { frontend: undefined, backend: undefined },
    });
    service.laden();
    http.expectNone(INSTANZ_URL);
  });

  it('übernimmt eigene http(s)-Links zum Quellcode, auch einzeln', () => {
    const stand = laden((a) =>
      a.flush({ ...ANGABEN, quellcode: { backend: 'https://example.org/backend' } }),
    );
    expect(stand).toMatchObject({
      quellcode: { frontend: undefined, backend: 'https://example.org/backend' },
    });
  });

  it.each([
    ['ohne http(s)', { frontend: 'javascript:alert(1)', backend: 'example.org/backend' }],
    ['als einzelner Text', 'https://example.org/repo'],
  ])('verwirft Links zum Quellcode %s', (_fall, quellcode) => {
    const stand = laden((a) => a.flush({ ...ANGABEN, quellcode }));
    expect(stand).toMatchObject({ quellcode: { frontend: undefined, backend: undefined } });
  });

  it('liest den Quellcode auch ohne vollständige Betreiberangaben', () => {
    const stand = laden((a) =>
      a.flush({ quellcode: { frontend: 'https://example.org/frontend' } }),
    );
    expect(stand).toEqual({
      zustand: 'fehlt',
      quellcode: { frontend: 'https://example.org/frontend', backend: undefined },
    });
  });

  it.each([
    ['ohne Betreiber', { ...ANGABEN, betreiber: undefined }],
    ['mit leerer Anschrift', { ...ANGABEN, betreiber: { ...ANGABEN.betreiber, anschrift: [] } }],
    ['mit Tagen als Text', { ...ANGABEN, logAufbewahrungTage: '14' }],
    ['mit Stand ohne ISO-Datum', { ...ANGABEN, stand: '08.11.2026' }],
    ['als Liste', []],
  ])('gilt %s als nicht hinterlegt', (_fall, antwort) => {
    expect(laden((a) => a.flush(antwort))).toMatchObject({ zustand: 'fehlt' });
  });

  it('404 heißt: nichts hinterlegt', () => {
    expect(laden((a) => a.flush('', { status: 404, statusText: 'Not Found' }))).toEqual({
      zustand: 'fehlt',
      quellcode: {},
    });
  });

  it('meldet einen Fehler und versucht es beim nächsten Aufruf erneut', () => {
    expect(laden((a) => a.flush('', { status: 502, statusText: 'Bad Gateway' }))).toEqual({
      zustand: 'fehler',
    });
    expect(laden((a) => a.flush(ANGABEN)).zustand).toBe('da');
  });
});
