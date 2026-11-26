import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Chip, ChipTon } from '../../../../shared/chip/chip';

export interface VertragChip {
  text: string;
  /** {@code warnung} gelb (Preisänderung), {@code info} blau (Anteil). */
  ton: ChipTon;
}

/** Hinweise unter dem Namen eines Vertrags in der Liste, z. B. „Preis ↑ ab …“ und „Anteil 50 %“. */
@Component({
  selector: 'app-vertrag-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chip],
  template: `@for (chip of chips(); track chip.text) {
    <app-chip [ton]="chip.ton">{{ chip.text }}</app-chip>
  }`,
  styles: `
    @use 'masse' as *;

    :host {
      display: flex;
      flex-wrap: wrap;
      gap: $abstand-2;
      padding-top: $abstand-halb;
    }
  `,
})
export class VertragChips {
  readonly chips = input.required<VertragChip[]>();
}
