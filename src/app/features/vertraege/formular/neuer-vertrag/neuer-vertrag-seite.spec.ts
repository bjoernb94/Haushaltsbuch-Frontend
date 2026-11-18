import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { Seitenaktionen } from '../../../../shared/seitenaktionen/seitenaktionen';
import { VertragService } from '../../vertrag.service';
import { NeuerVertragSeite } from './neuer-vertrag-seite';

const KATEGORIEN = [{ id: 'k1', schluessel: 'VERSICHERUNG', name: null }] as const;

async function erstellen(service: Partial<VertragService>) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: VertragService, useValue: { vorschau: () => NEVER, ...service } },
    ],
  });
  const navigieren = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(NeuerVertragSeite);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const setzen = (name: string, wert: string) => {
    const control = el.querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
    control.value = wert;
    control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
  };
  const absenden = async () => {
    setzen('anbieter', 'Anbieter');
    setzen('kategorieId', 'k1');
    setzen('betrag', '19,99');
    setzen('zahlweise', 'MONATLICH');
    setzen('beginn', '2027-01-01');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { fixture, el, navigieren, absenden };
}

describe('NeuerVertragSeite', () => {
  it('zeigt den Ladezustand, bis die Kategorien da sind', async () => {
    const { el } = await erstellen({ kategorien: () => NEVER });
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Wird geladen');
    expect(el.querySelector('form')).toBeNull();
  });

  it('zeigt statt des Formulars einen Hinweis, wenn die Kategorien fehlen, und lädt erneut', async () => {
    const kategorien = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(of(KATEGORIEN));
    const { fixture, el } = await erstellen({ kategorien });
    expect(el.querySelector('form')).toBeNull();
    expect(el.textContent).toContain('Die Kategorien konnten nicht geladen werden.');

    el.querySelector<HTMLButtonElement>('.fehler button')!.click();
    await fixture.whenStable();
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('kehrt nach dem Anlegen mit Meldung zur Liste zurück', async () => {
    const anlegen = vi
      .fn()
      .mockReturnValue(of({ id: 'v1', anbieter: 'Anbieter', bezeichnung: null }));
    const { navigieren, absenden } = await erstellen({
      kategorien: () => of([...KATEGORIEN]),
      anlegen,
    });
    await absenden();
    expect(anlegen).toHaveBeenCalledOnce();
    expect(navigieren).toHaveBeenCalledWith(['/vertraege'], {
      state: { meldung: '„Anbieter“ wurde gespeichert.', vertragId: 'v1' },
    });
  });

  it('nennt in der Meldung die Bezeichnung, wenn es eine gibt', async () => {
    const anlegen = vi
      .fn()
      .mockReturnValue(of({ id: 'v1', anbieter: 'Anbieter', bezeichnung: 'Kfz' }));
    const { navigieren, absenden } = await erstellen({
      kategorien: () => of([...KATEGORIEN]),
      anlegen,
    });
    await absenden();
    expect(navigieren.mock.calls[0][1]).toEqual({
      state: { meldung: '„Kfz“ wurde gespeichert.', vertragId: 'v1' },
    });
  });

  it('bleibt bei einem Fehler auf der Seite und zeigt ihn am Feld', async () => {
    const fehler = new HttpErrorResponse({
      status: 400,
      error: {
        code: 'VALIDIERUNG',
        felder: [{ feld: 'preise[0].betrag.wert', code: 'Digits', parameter: { fraction: 2 } }],
      },
    });
    const anlegen = vi.fn().mockReturnValue(throwError(() => fehler));
    const { el, navigieren, absenden } = await erstellen({
      kategorien: () => of([...KATEGORIEN]),
      anlegen,
    });
    await absenden();
    expect(navigieren).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Höchstens 2 Nachkommastellen.');
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });

  it('bricht ohne Anfrage ab', async () => {
    const anlegen = vi.fn();
    const { el, navigieren } = await erstellen({ kategorien: () => of([...KATEGORIEN]), anlegen });
    el.querySelector<HTMLButtonElement>('form .aktionen button[type="button"]')!.click();
    expect(anlegen).not.toHaveBeenCalled();
    expect(navigieren).toHaveBeenCalledWith(['/vertraege']);
  });

  describe('Leiste bis 900 px', () => {
    const leiste = (el: HTMLElement) => el.querySelector<HTMLElement>('.leiste')!;
    const sichern = (el: HTMLElement) =>
      [...leiste(el).querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Sichern')!;

    it('meldet der Shell eine eigene Leiste, bis die Seite geht', async () => {
      const { fixture } = await erstellen({ kategorien: () => NEVER });
      const aktionen = TestBed.inject(Seitenaktionen).aktionen;
      expect(aktionen().eigeneLeiste).toBe(true);
      fixture.destroy();
      expect(aktionen()).toEqual({});
    });

    it('„Sichern“ sendet das Formular ab', async () => {
      const anlegen = vi.fn().mockReturnValue(NEVER);
      const { fixture, el } = await erstellen({ kategorien: () => of([...KATEGORIEN]), anlegen });
      const formular = el.querySelector('form')!;
      expect(sichern(el).getAttribute('form')).toBe(formular.id);
      expect(formular.id).not.toBe('');

      const absenden = vi.fn((e: Event) => e.preventDefault());
      formular.addEventListener('submit', absenden);
      sichern(el).click();
      await fixture.whenStable();
      expect(absenden).toHaveBeenCalledOnce();
    });

    it('„Sichern“ ist gesperrt, solange die Kategorien fehlen oder gesendet wird', async () => {
      const { el } = await erstellen({ kategorien: () => NEVER });
      expect(sichern(el).disabled).toBe(true);
    });

    it('„Abbrechen“ führt zur Liste', async () => {
      const { el, navigieren } = await erstellen({ kategorien: () => of([...KATEGORIEN]) });
      leiste(el).querySelector<HTMLButtonElement>('button[type="button"]')!.click();
      expect(navigieren).toHaveBeenCalledWith(['/vertraege']);
    });
  });
});
