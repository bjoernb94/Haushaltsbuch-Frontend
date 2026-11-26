import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { AuthService, KOMPONENTEN_URL } from '../../../core/auth/auth.service';
import { UngespeicherteEingaben } from '../../../core/ungespeichert/ungespeicherte-eingaben';
import { KomponentenSeite } from './komponenten-seite';

const problem = (status: number, code: string) => ({
  body: { type: 'about:blank', status, code },
  optionen: { status, statusText: 'Fehler' },
});

describe('KomponentenSeite', () => {
  let http: HttpTestingController;
  const komponentenLaden = vi.fn(() => of(undefined));

  async function seite() {
    komponentenLaden.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'einstellungen', children: [] },
          { path: 'einstellungen/komponenten', component: KomponentenSeite },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { komponentenLaden } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create();
    await TestBed.inject(Router).navigateByUrl('/einstellungen/komponenten');
    // Nicht whenStable: Das wartete auf die offene Anfrage, die der Test erst beantwortet.
    harness.detectChanges();
    const element = harness.routeNativeElement!;
    return {
      element,
      stabil: () => harness.fixture.whenStable(),
      schalter: () => [...element.querySelectorAll<HTMLInputElement>('input[role="switch"]')],
      knopf: (text: string) =>
        [...element.querySelectorAll<HTMLButtonElement>('button')].find(
          (b) => b.textContent?.trim() === text,
        )!,
      meldung: () => element.querySelector('app-hinweis-box [role]'),
    };
  }

  async function geladen(komponenten = ['VERTRAGSUEBERSICHT', 'PORTFOLIO'], version = 3) {
    const s = await seite();
    http.expectOne(KOMPONENTEN_URL).flush({ komponenten, version });
    await s.stabil();
    return s;
  }

  async function umschalten(s: Awaited<ReturnType<typeof seite>>, index: number) {
    s.schalter()[index].click();
    await s.stabil();
  }

  afterEach(() => {
    TestBed.inject(UngespeicherteEingaben).melden(false);
    http.verify();
  });

  it('lädt die Auswahl und zeigt je Komponente einen Schalter mit Zähler', async () => {
    const s = await seite();
    expect(s.element.querySelector('[role="status"].laedt')?.textContent).toBe('Wird geladen …');
    http.expectOne(KOMPONENTEN_URL).flush({ komponenten: ['VERTRAGSUEBERSICHT'], version: 3 });
    await s.stabil();

    expect(s.element.querySelector('h1')?.textContent).toBe('Komponenten');
    expect(s.element.querySelector('legend')?.textContent?.trim()).toBe('1 von 4 aktiv');
    expect(s.schalter().map((e) => e.checked)).toEqual([false, true, false, false]);
    expect(
      [...s.element.querySelectorAll('label .titel-komponente')].map((t) => t.textContent),
    ).toEqual([
      'Finanzübersicht',
      'Vertragsübersicht',
      'Übersicht über Versorgungsverträge',
      'Portfolio',
    ]);
    expect(s.knopf('Speichern').disabled).toBe(true);
    expect(s.knopf('Änderungen verwerfen').disabled).toBe(true);
  });

  it('bietet nach einem Ladefehler einen neuen Versuch an', async () => {
    const s = await seite();
    http.expectOne(KOMPONENTEN_URL).flush(null, { status: 500, statusText: 'Fehler' });
    await s.stabil();
    expect(s.meldung()?.textContent).toContain('konnten nicht geladen werden');

    s.knopf('Erneut versuchen').click();
    http.expectOne(KOMPONENTEN_URL).flush({ komponenten: ['PORTFOLIO'], version: 1 });
    await s.stabil();
    expect(s.schalter()).toHaveLength(4);
  });

  it('meldet Änderungen als ungespeichert und verwirft sie', async () => {
    const s = await geladen();
    const eingaben = TestBed.inject(UngespeicherteEingaben);
    await umschalten(s, 0);
    expect(s.element.querySelector('legend')?.textContent?.trim()).toBe('3 von 4 aktiv');
    expect(s.knopf('Speichern').disabled).toBe(false);
    expect(eingaben.vorhanden()).toBe(true);

    s.knopf('Änderungen verwerfen').click();
    await s.stabil();
    expect(s.schalter().map((e) => e.checked)).toEqual([false, true, false, true]);
    expect(s.knopf('Speichern').disabled).toBe(true);
    expect(eingaben.vorhanden()).toBe(false);
  });

  it('hin und zurück geschaltet zählt nicht als Änderung', async () => {
    const s = await geladen();
    await umschalten(s, 0);
    await umschalten(s, 0);
    expect(s.knopf('Speichern').disabled).toBe(true);
  });

  it('speichert nicht ohne Auswahl und rahmt die Liste rot', async () => {
    const s = await geladen();
    await umschalten(s, 1);
    await umschalten(s, 3);
    s.knopf('Speichern').click();
    await s.stabil();

    http.expectNone(KOMPONENTEN_URL);
    expect(s.meldung()?.getAttribute('role')).toBe('alert');
    expect(s.meldung()?.textContent).toContain('Bitte wähle mindestens eine Komponente aus.');
    expect(s.element.querySelector('.liste')?.classList.contains('ungueltig')).toBe(true);
    expect(s.schalter()[0].getAttribute('aria-invalid')).toBe('true');

    await umschalten(s, 2);
    expect(s.meldung()).toBeNull();
  });

  it('speichert in der Reihenfolge der Liste mit Version, lädt die Komponenten neu und meldet Erfolg', async () => {
    const s = await geladen();
    await umschalten(s, 0);
    s.knopf('Speichern').click();
    await s.stabil();
    expect(s.knopf('Wird gespeichert …').disabled).toBe(true);

    const anfrage = http.expectOne({ url: KOMPONENTEN_URL, method: 'PUT' });
    expect(anfrage.request.body).toEqual({
      komponenten: ['FINANZUEBERSICHT', 'VERTRAGSUEBERSICHT', 'PORTFOLIO'],
      version: 3,
    });
    anfrage.flush({ komponenten: anfrage.request.body.komponenten, version: 4 });
    await s.stabil();

    expect(komponentenLaden).toHaveBeenCalledOnce();
    expect(s.meldung()?.getAttribute('role')).toBe('status');
    expect(s.meldung()?.textContent).toContain('Deine Komponenten wurden gespeichert.');
    expect(s.knopf('Speichern').disabled).toBe(true);
    expect(TestBed.inject(UngespeicherteEingaben).vorhanden()).toBe(false);

    // Die nächste Änderung nimmt die Meldung weg und speichert mit der neuen Version.
    await umschalten(s, 3);
    expect(s.meldung()).toBeNull();
    s.knopf('Speichern').click();
    expect(http.expectOne({ url: KOMPONENTEN_URL, method: 'PUT' }).request.body.version).toBe(4);
  });

  it('lädt bei 409 den aktuellen Stand und weist darauf hin', async () => {
    const s = await geladen();
    await umschalten(s, 0);
    s.knopf('Speichern').click();
    const { body, optionen } = problem(409, 'KONFLIKT');
    http.expectOne({ url: KOMPONENTEN_URL, method: 'PUT' }).flush(body, optionen);
    http.expectOne({ url: KOMPONENTEN_URL, method: 'GET' }).flush({
      komponenten: ['FINANZUEBERSICHT'],
      version: 5,
    });
    await s.stabil();

    expect(s.meldung()?.getAttribute('role')).toBe('status');
    expect(s.meldung()?.textContent).toContain('inzwischen an anderer Stelle geändert');
    expect(s.element.querySelector('app-hinweis-box .box')?.classList.contains('info')).toBe(true);
    expect(s.schalter().map((e) => e.checked)).toEqual([true, false, false, false]);
    expect(komponentenLaden).toHaveBeenCalledOnce();
    expect(TestBed.inject(UngespeicherteEingaben).vorhanden()).toBe(false);
  });

  it.each([
    [problem(400, 'VALIDIERUNG'), 'Bitte wähle mindestens eine Komponente aus.'],
    [problem(500, 'INTERNER_FEHLER'), 'konnten nicht gespeichert werden'],
    [
      { body: null, optionen: { status: 0, statusText: 'Netzwerk' } },
      'konnten nicht gespeichert werden',
    ],
  ])(
    'zeigt Fehler beim Speichern und behält die Auswahl (%#)',
    async ({ body, optionen }, text) => {
      const s = await geladen();
      await umschalten(s, 0);
      s.knopf('Speichern').click();
      http.expectOne({ url: KOMPONENTEN_URL, method: 'PUT' }).flush(body, optionen);
      await s.stabil();

      expect(s.meldung()?.textContent).toContain(text);
      expect(s.schalter()[0].checked).toBe(true);
      expect(s.knopf('Speichern').disabled).toBe(false);
      expect(komponentenLaden).not.toHaveBeenCalled();
    },
  );

  it('führt mit „Zurück“ zu den Einstellungen', async () => {
    const s = await geladen();
    const zurueck = s.element.querySelector<HTMLAnchorElement>('a.zurueck')!;
    expect(zurueck.getAttribute('href')).toBe('/einstellungen');
    expect(zurueck.getAttribute('aria-label')).toBe('Zurück zu Einstellungen');
  });
});
