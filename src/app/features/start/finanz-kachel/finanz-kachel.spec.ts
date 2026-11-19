import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FinanzKachel, ZEILENHOEHE } from './finanz-kachel';

@Component({
  imports: [FinanzKachel],
  template: '<div class="raster"><app-finanz-kachel /></div>',
})
class Rahmen {}

/** jsdom misst nicht: Breiten und Höhen setzt der Test, der Test löst den Beobachter aus. */
class Beobachter {
  static rueckruf: (() => void) | null = null;
  constructor(rueckruf: () => void) {
    Beobachter.rueckruf = rueckruf;
  }
  observe(): void {
    // Der Test ruft den Rückruf selbst auf.
  }
  disconnect(): void {
    Beobachter.rueckruf = null;
  }
}

function setzen(element: Element, eigenschaft: 'clientWidth' | 'offsetWidth', wert: number): void {
  Object.defineProperty(element, eigenschaft, { configurable: true, value: wert });
}

describe('FinanzKachel', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', Beobachter));
  afterEach(() => vi.unstubAllGlobals());

  async function kachel(rasterBreite: number, karteBreite: number, platzHoehe: number) {
    const fixture = TestBed.createComponent(Rahmen);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    setzen(element.querySelector('.raster')!, 'clientWidth', rasterBreite);
    setzen(element.querySelector('app-finanz-kachel')!, 'offsetWidth', karteBreite);
    const platz = element.querySelector('.platz')!;
    platz.getBoundingClientRect = () => ({ height: platzHoehe }) as DOMRect;
    Beobachter.rueckruf?.();
    await fixture.whenStable();
    return {
      zeilen: element.querySelectorAll('.zeile').length,
      mindesthoehe: element.querySelector<HTMLElement>('.platz')!.style.minHeight,
    };
  }

  it('zeigt neben einer anderen Karte so viele Buchungen, wie vollständig passen', async () => {
    expect(await kachel(1000, 490, 7 * ZEILENHOEHE - 1)).toEqual({
      zeilen: 6,
      mindesthoehe: `${3 * ZEILENHOEHE}px`,
    });
  });

  it('zeigt neben einer anderen Karte mindestens 3 und höchstens alle Buchungen', async () => {
    expect((await kachel(1000, 490, ZEILENHOEHE)).zeilen).toBe(3);
    expect((await kachel(1000, 490, 20 * ZEILENHOEHE)).zeilen).toBe(10);
  });

  it('zeigt allein in der Zeile fest 5 Buchungen', async () => {
    expect(await kachel(390, 390, 9 * ZEILENHOEHE)).toEqual({
      zeilen: 5,
      mindesthoehe: `${5 * ZEILENHOEHE}px`,
    });
  });
});
