import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Seitenrahmen für Login und Registrierung: links die Markenfläche mit Überschrift, rechts
 * der projizierte Inhalt (das Formular). Auf schmalen Bildschirmen untereinander.
 */
@Component({
  selector: 'app-anmelde-rahmen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './anmelde-rahmen.html',
  styleUrl: './anmelde-rahmen.scss',
})
export class AnmeldeRahmen {
  readonly ueberschrift = input.required<string>();
  readonly text = input.required<string>();
}
