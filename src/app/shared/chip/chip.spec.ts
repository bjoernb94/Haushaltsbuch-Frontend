import { TestBed } from '@angular/core/testing';
import { Chip, ChipTon } from './chip';

describe('Chip', () => {
  it('trägt seinen Ton als Attribut für die Farbe', async () => {
    for (const ton of ['warnung', 'info', 'erfolg', 'neutral'] satisfies ChipTon[]) {
      const fixture = TestBed.createComponent(Chip);
      fixture.componentRef.setInput('ton', ton);
      await fixture.whenStable();
      expect((fixture.nativeElement as HTMLElement).getAttribute('data-ton')).toBe(ton);
    }
  });
});
