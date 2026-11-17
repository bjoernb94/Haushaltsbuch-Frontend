import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface Chip {
  text: string;
  /** {@code hinweis} gelb (Preisänderung), {@code info} blau (Anteil). */
  art: 'hinweis' | 'info';
}

/** Hinweise unter dem Namen eines Vertrags in der Liste, z. B. „Preis ↑ ab …“ und „Anteil 50 %“. */
@Component({
  selector: 'app-vertrag-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (chip of chips(); track chip.text) {
    <span class="chip" [class]="chip.art">{{ chip.text }}</span>
  }`,
  styles: `
    @use 'masse' as *;

    :host {
      display: flex;
      flex-wrap: wrap;
      gap: $abstand-2;
      padding-top: $abstand-halb;
    }

    .chip {
      padding: $abstand-halb $abstand-2;
      border-radius: $radius-pille;
      font-size: $schrift-klein;
      font-weight: 700;
    }

    .hinweis {
      background: var(--app-hinweis-grund);
      color: var(--app-hinweis-text);
    }

    .info {
      background: var(--app-info-grund);
      color: var(--app-info-text);
    }
  `,
})
export class VertragChips {
  readonly chips = input.required<Chip[]>();
}
