import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Über den Kacheln der Details: „Gekündigt zum …“ bzw. „Beendet am …“ mit „Wieder aufnehmen“. */
@Component({
  selector: 'app-wiederaufnahme-leiste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wiederaufnahme-leiste.html',
  styleUrl: './wiederaufnahme-leiste.scss',
})
export class WiederaufnahmeLeiste {
  readonly text = input.required<string>();

  readonly wiederaufnehmen = output();
}
