import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { datumText } from '../../../../shared/format/datum.pipe';
import { preisFeld, PreisWerte, VertragFeld } from '../vertrag-pruefung';

export type PreisZeile = FormGroup<{ [F in keyof PreisWerte]: FormControl<string> }>;

/**
 * Liste „Frühere und angekündigte Preise“ im Tab Preisverlauf des Vertragsformulars, darunter der
 * Preisverlauf aus der Vorschau. Zeilen und Fehler gehören dem Formular, das auch hinzufügt und
 * entfernt; IDs: {@code <idPrefix>-preise-<i>-<feld>}.
 */
@Component({
  selector: 'app-vertrag-preisliste',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-preisliste.html',
  styleUrl: './vertrag-preisliste.scss',
})
export class VertragPreisliste {
  readonly zeilen = input.required<FormArray<PreisZeile>>();
  readonly waehrung = input.required<string>();
  readonly verlauf = input.required<{ text: string; aktuell: boolean }[]>();
  readonly fehler = input.required<ReadonlyMap<VertragFeld, string>>();
  readonly idPrefix = input.required<string>();

  readonly hinzufuegen = output();
  readonly entfernen = output<number>();
  readonly geaendert = output<{ index: number; feld: keyof PreisWerte }>();

  protected id(index: number, feld: keyof PreisWerte): string {
    return `${this.idPrefix()}-preise-${index}-${feld}`;
  }

  protected fehlerText(index: number, feld: keyof PreisWerte): string | null {
    return this.fehler().get(preisFeld(index, feld)) ?? null;
  }

  /** Ein Fehler je Zeile: zuerst der zum Datum, dann der zum Betrag. */
  protected zeilenFehler(index: number): string | null {
    return this.fehlerText(index, 'gueltigAb') ?? this.fehlerText(index, 'betrag');
  }

  /** Text für „Entfernen“, damit Screenreader wissen, welche Zeile gemeint ist. */
  protected entfernenLabel(index: number): string {
    const ab = this.zeilen().at(index).controls.gueltigAb.value;
    return ab ? `Preis ab ${datumText(ab)} entfernen` : 'Preis entfernen';
  }
}
