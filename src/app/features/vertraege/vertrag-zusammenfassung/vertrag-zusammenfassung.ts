import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Rundungshinweis } from '../../../shared/rundungshinweis/rundungshinweis';

export interface Uebersicht {
  name: string;
  /** „Anbieter · Kategorie“ */
  unter: string;
  zeilen: { label: string; wert: string }[];
}

let letzte = 0;

/**
 * Zusammenfassung neben dem Formular „Neuer Vertrag“; die Werte bereitet das Formular auf. Pro Monat,
 * Anteil und Summen sind gerundet, daher der Hinweis darunter.
 */
@Component({
  selector: 'app-vertrag-zusammenfassung',
  imports: [Rundungshinweis],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 [id]="titelId">Zusammenfassung</h2>
    <div class="titel">
      <span class="name">{{ uebersicht().name }}</span>
      <span class="unter">{{ uebersicht().unter }}</span>
    </div>
    <dl>
      @for (zeile of uebersicht().zeilen; track zeile.label) {
        <div>
          <dt>{{ zeile.label }}</dt>
          <dd>{{ zeile.wert }}</dd>
        </div>
      }
    </dl>
    <app-rundungshinweis />`,
  styleUrl: './vertrag-zusammenfassung.scss',
  host: { role: 'complementary', '[attr.aria-labelledby]': 'titelId' },
})
export class VertragZusammenfassung {
  readonly uebersicht = input.required<Uebersicht>();

  protected readonly titelId = `zusammenfassung-${++letzte}`;
}
