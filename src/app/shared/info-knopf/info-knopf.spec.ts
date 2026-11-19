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
});
