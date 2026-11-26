import { TestBed } from '@angular/core/testing';
import { HinweisArt, HinweisBox } from './hinweis-box';

describe('HinweisBox', () => {
  const box = async (werte: { art?: HinweisArt; aktionText?: string }) => {
    const fixture = TestBed.createComponent(HinweisBox);
    fixture.componentRef.setInput('text', 'Die Verträge konnten nicht geladen werden.');
    for (const [name, wert] of Object.entries(werte)) {
      fixture.componentRef.setInput(name, wert);
    }
    await fixture.whenStable();
    return fixture;
  };

  it('meldet Fehler und Warnung als alert, Info und Erfolg als status', async () => {
    const rollen: Record<HinweisArt, string> = {
      fehler: 'alert',
      warnung: 'alert',
      info: 'status',
      erfolg: 'status',
    };
    for (const [art, rolle] of Object.entries(rollen) as [HinweisArt, string][]) {
      const element: HTMLElement = (await box({ art })).nativeElement;
      const meldung = element.querySelector('.box')!;
      expect(meldung.getAttribute('role')).toBe(rolle);
      expect(meldung.classList).toContain(art);
    }
  });

  it('ist ohne Angabe ein Fehler ohne Knopf', async () => {
    const element: HTMLElement = (await box({})).nativeElement;
    expect(element.querySelector('.box')?.classList).toContain('fehler');
    expect(element.querySelector('button')).toBeNull();
  });

  it('meldet den Knopf daneben als Aktion', async () => {
    const fixture = await box({ aktionText: 'Erneut versuchen' });
    const aktion = vi.fn();
    fixture.componentInstance.aktion.subscribe(aktion);
    const knopf: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(knopf.textContent?.trim()).toBe('Erneut versuchen');
    expect(knopf.type).toBe('button');
    knopf.click();
    expect(aktion).toHaveBeenCalledOnce();
  });
});
