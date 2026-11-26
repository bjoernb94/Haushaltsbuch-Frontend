import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Töne eines Chips wie im Design System. */
export type ChipTon = 'warnung' | 'info' | 'erfolg' | 'neutral';

/**
 * Kurzer Zustand, nur Text, keine Handlung (Baustein Chips im Design System): Warnung für Zeitkritisches
 * (Kündigungsfrist), Info für gut zu wissen, Erfolg (z. B. „aktuell“) und Neutral (z. B. „Beendet“,
 * „Demnächst verfügbar“) für einen Status. Der Text steht als Inhalt.
 */
@Component({
  selector: 'app-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-ton]': 'ton()' },
  template: '<ng-content />',
  styles: `
    @use 'masse' as *;

    :host {
      display: inline-block;
      box-sizing: border-box;
      padding: $abstand-halb $abstand-2;
      border-radius: $radius-pille;
      font-size: $schrift-klein;
      line-height: 16px; // Zeilenhöhe des Stils „klein“
      font-weight: 700;
      white-space: nowrap;
    }

    :host([data-ton='warnung']) {
      background: var(--app-warnung-grund);
      color: var(--app-warnung-text);
    }

    :host([data-ton='info']) {
      background: var(--app-info-grund);
      color: var(--app-info-text);
    }

    :host([data-ton='erfolg']) {
      background: var(--app-gruen-hell);
      color: var(--app-gruen-dunkel);
    }

    :host([data-ton='neutral']) {
      background: var(--app-grund);
      color: var(--app-text-gedaempft);
    }
  `,
})
export class Chip {
  readonly ton = input.required<ChipTon>();
}
