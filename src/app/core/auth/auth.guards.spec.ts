import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { Komponente } from '../api/api';
import {
  abgemeldetGuard,
  angemeldetGuard,
  bereichGuard,
  sichereRuecksprungUrl,
} from './auth.guards';
import { AuthService } from './auth.service';

describe('Auth-Guards', () => {
  let angemeldet: boolean;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { sitzungPruefen: () => of(angemeldet) } },
      ],
    });
  });

  function ausfuehren(guard: typeof angemeldetGuard, url: string) {
    const ergebnis = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
    return firstValueFrom(ergebnis as Observable<boolean | UrlTree>);
  }

  const alsText = (wert: boolean | UrlTree) =>
    wert instanceof UrlTree ? TestBed.inject(Router).serializeUrl(wert) : wert;

  it('lässt Angemeldete in die App', async () => {
    angemeldet = true;
    expect(await ausfuehren(angemeldetGuard, '/vertraege')).toBe(true);
  });

  it('schickt Abgemeldete mit Rücksprung zum Login', async () => {
    angemeldet = false;
    expect(alsText(await ausfuehren(angemeldetGuard, '/vertraege'))).toBe(
      '/login?returnUrl=%2Fvertraege',
    );
  });

  it('schickt Angemeldete vom Login zur Startseite', async () => {
    angemeldet = true;
    expect(alsText(await ausfuehren(abgemeldetGuard, '/login'))).toBe('/start');
  });

  it('zeigt Abgemeldeten den Login', async () => {
    angemeldet = false;
    expect(await ausfuehren(abgemeldetGuard, '/login')).toBe(true);
  });
});

describe('bereichGuard', () => {
  let gebucht: Komponente[];
  let fehler: boolean;
  let komponentenLaden: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gebucht = [];
    fehler = false;
    komponentenLaden = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            komponenten: () => gebucht,
            komponentenFehler: () => fehler,
            komponentenLaden,
          },
        },
      ],
    });
  });

  function ausfuehren(komponente: Komponente) {
    const ergebnis = TestBed.runInInjectionContext(() =>
      bereichGuard(komponente)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return firstValueFrom(ergebnis as Observable<boolean | UrlTree>).then((wert) =>
      wert instanceof UrlTree ? TestBed.inject(Router).serializeUrl(wert) : wert,
    );
  }

  it('lässt in gebuchte und verfügbare Bereiche', async () => {
    gebucht = ['VERTRAGSUEBERSICHT'];
    expect(await ausfuehren('VERTRAGSUEBERSICHT')).toBe(true);
    expect(komponentenLaden).not.toHaveBeenCalled();
  });

  it('schickt aus nicht gebuchten Bereichen zur Startseite', async () => {
    gebucht = ['PORTFOLIO'];
    expect(await ausfuehren('VERTRAGSUEBERSICHT')).toBe('/start');
  });

  it('schickt aus gebuchten, noch nicht verfügbaren Bereichen zur Startseite', async () => {
    gebucht = ['PORTFOLIO'];
    expect(await ausfuehren('PORTFOLIO')).toBe('/start');
  });

  it('versucht nach einem Ladefehler erneut zu laden', async () => {
    fehler = true;
    komponentenLaden.mockImplementation(() => {
      gebucht = ['VERTRAGSUEBERSICHT'];
      return of(undefined);
    });

    expect(await ausfuehren('VERTRAGSUEBERSICHT')).toBe(true);
    expect(komponentenLaden).toHaveBeenCalledOnce();
  });

  it('schickt zur Startseite, wenn auch der neue Versuch scheitert', async () => {
    fehler = true;
    expect(await ausfuehren('VERTRAGSUEBERSICHT')).toBe('/start');
  });
});

describe('sichereRuecksprungUrl', () => {
  it('übernimmt Pfade der App', () => {
    expect(sichereRuecksprungUrl('/vertraege?x=1')).toBe('/vertraege?x=1');
  });

  it('weist fremde Ziele und den Login zurück', () => {
    for (const url of [undefined, '', 'https://boese.de', '//boese.de', '/login?returnUrl=%2F']) {
      expect(sichereRuecksprungUrl(url)).toBe('/start');
    }
  });
});
