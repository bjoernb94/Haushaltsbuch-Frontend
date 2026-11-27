import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MeldungArt } from '../../core/benachrichtigungen/benachrichtigungen';

/** Bezeichnung der Art für Screenreader, vor dem Titel. */
export const ART_TEXT: Record<MeldungArt, string> = {
  erfolg: 'Erfolg',
  info: 'Info',
  warnung: 'Warnung',
  fehler: 'Fehler',
};

/** Rundes Symbol je Art einer Meldung, wie im Canvas (Baustein Benachrichtigungen). */
@Component({
  selector: 'app-meldung-symbol',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    @switch (art()) {
      @case ('erfolg') {
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M8 12.5l2.8 2.8L16 10"></path>
      }
      @case ('info') {
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 11v5"></path>
        <path d="M12 7.5h.01"></path>
      }
      @case ('warnung') {
        <path
          d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
        ></path>
        <path d="M12 9v4"></path>
        <path d="M12 17h.01"></path>
      }
      @case ('fehler') {
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 7.5v5.5"></path>
        <path d="M12 16.5h.01"></path>
      }
    }
  </svg>`,
  styleUrl: './meldung-symbol.scss',
  host: { '[class]': 'art()', 'aria-hidden': 'true' },
})
export class MeldungSymbol {
  readonly art = input.required<MeldungArt>();
}
