import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InfoKnopf } from './info-knopf';

@Component({
  imports: [InfoKnopf],
  template: `
    <app-info-knopf beschriftung="Kosten pro Monat" [saetze]="saetze()" />
    <app-info-knopf beschriftung="Andere Zahl" [saetze]="['Noch ein Satz.']" />
    <p>Daneben</p>
  `,
})
class Rahmen {
  readonly saetze = signal<string[]>(['Erster Satz.', 'Zweiter Satz.']);
}

@Component({
  imports: [InfoKnopf],
  template: `
    <div class="rahmen" style="overflow-x: auto">
      <span class="anker" style="position: relative"
        >Kosten <app-info-knopf beschriftung="Kosten" [saetze]="['Ein Satz.']"
      /></span>
    </div>
  `,
})
class ImRahmen {}

const rechteck = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

describe('InfoKnopf', () => {
  async function aufbauen(saetze?: string[]) {
    const fixture = TestBed.createComponent(Rahmen);
    if (saetze) {
      fixture.componentInstance.saetze.set(saetze);
    }
    // Fokus und Klick daneben funktionieren nur im Dokument.
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const info = () => element.querySelector('app-info-knopf')!;
    return {
      fixture,
      element,
      knopf: () => info().querySelector('button'),
      status: () => info().querySelector('[role="status"]'),
      klicken: async (ziel: Element | null) => {
        (ziel as HTMLElement).click();
        await fixture.whenStable();
      },
    };
  }

  it('zeigt geschlossen nur den Knopf, die Live-Region ist schon da', async () => {
    const { knopf, status } = await aufbauen();
    expect(knopf()?.getAttribute('aria-label')).toBe('Info zu Kosten pro Monat');
    expect(knopf()?.getAttribute('aria-expanded')).toBe('false');
    expect(knopf()?.hasAttribute('aria-controls')).toBe(false);
    expect(status()?.textContent?.trim()).toBe('');
  });

  it('öffnet per Klick und zeigt die Sätze in der Live-Region', async () => {
    const { knopf, status, klicken } = await aufbauen();
    await klicken(knopf());

    expect(knopf()?.getAttribute('aria-expanded')).toBe('true');
    const blase = status()?.querySelector('ul');
    expect(knopf()?.getAttribute('aria-controls')).toBe(blase?.id);
    expect([...(blase?.querySelectorAll('li') ?? [])].map((li) => li.textContent)).toEqual([
      'Erster Satz.',
      'Zweiter Satz.',
    ]);
  });

  it('schließt bei erneutem Klick', async () => {
    const { knopf, status, klicken } = await aufbauen();
    await klicken(knopf());
    await klicken(knopf());
    expect(knopf()?.getAttribute('aria-expanded')).toBe('false');
    expect(status()?.querySelector('ul')).toBeNull();
  });

  it('schließt mit Esc und gibt den Fokus an den Knopf zurück', async () => {
    const { fixture, knopf, status, klicken } = await aufbauen();
    await klicken(knopf());
    document.body.focus();
    status()!
      .querySelector('ul')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(status()?.querySelector('ul')).toBeNull();
    expect(document.activeElement).toBe(knopf());
  });

  it('schließt bei einem Klick daneben, nicht bei einem Klick in die Blase', async () => {
    const { element, status, knopf, klicken } = await aufbauen();
    await klicken(knopf());
    await klicken(status()!.querySelector('li'));
    expect(status()?.querySelector('ul')).not.toBeNull();

    await klicken(element.querySelector('p'));
    expect(status()?.querySelector('ul')).toBeNull();
  });

  it('lässt höchstens eine Blase offen', async () => {
    const { element, status, knopf, klicken } = await aufbauen();
    await klicken(knopf());
    await klicken(element.querySelectorAll('app-info-knopf button')[1]);

    expect(status()?.querySelector('ul')).toBeNull();
    expect(element.querySelectorAll('.blase').length).toBe(1);
  });

  it('zeigt ohne Sätze keinen Knopf', async () => {
    const { knopf, status } = await aufbauen([]);
    expect(knopf()).toBeNull();
    expect(status()).toBeNull();
  });

  it('hält die Blase im Rahmen: unter dem Knopf, links verschoben, höchstens so breit wie er', async () => {
    const fixture = TestBed.createComponent(ImRahmen);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const anker = element.querySelector<HTMLElement>('.anker')!;
    const knopf = element.querySelector('button')!;
    // Ohne Layout (jsdom) die Maße vorgeben: Rahmen 0–250 px, Anker ab 150 px, Knopf bei 220 px.
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(390);
    Object.defineProperty(element.querySelector('app-info-knopf'), 'offsetParent', {
      value: anker,
    });
    vi.spyOn(element.querySelector('.rahmen')!, 'getBoundingClientRect').mockReturnValue(
      rechteck(0, 0, 250, 400),
    );
    vi.spyOn(anker, 'getBoundingClientRect').mockReturnValue(rechteck(150, 100, 100, 20));
    vi.spyOn(knopf, 'getBoundingClientRect').mockReturnValue(rechteck(220, 98, 24, 24));

    knopf.click();
    await fixture.whenStable();

    const blase = element.querySelector<HTMLElement>('.blase')!;
    expect(blase.style.width).toBe('234px');
    expect(blase.style.left).toBe('-142px');
    expect(blase.style.top).toBe('30px');
  });
});
