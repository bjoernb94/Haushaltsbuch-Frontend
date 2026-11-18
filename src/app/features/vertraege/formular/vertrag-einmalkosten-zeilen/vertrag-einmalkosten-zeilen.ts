import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EinmalkostenWerte, einmalkostenFeld, VertragFeld } from '../vertrag-pruefung';

export type EinmalkostenZeile = FormGroup<{
  [F in keyof EinmalkostenWerte]: FormControl<string>;
}>;

/**
 * Abschnitt „Einmalkosten“ im Tab Kosten des Vertragsformulars, darunter die Summe aus der Vorschau.
 * Zeilen und Fehler gehören dem Formular, das auch hinzufügt und entfernt; IDs:
 * {@code <idPrefix>-einmalkosten-<i>-<feld>}.
 */
@Component({
  selector: 'app-vertrag-einmalkosten-zeilen',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-einmalkosten-zeilen.html',
  styleUrl: './vertrag-einmalkosten-zeilen.scss',
})
export class VertragEinmalkostenZeilen {
  readonly zeilen = input.required<FormArray<EinmalkostenZeile>>();
  readonly waehrung = input.required<string>();
  /** „Einmalkosten gesamt: …“, {@code null} ohne Summe aus der Vorschau. */
  readonly summe = input.required<string | null>();
  readonly fehler = input.required<ReadonlyMap<VertragFeld, string>>();
  readonly idPrefix = input.required<string>();

  readonly hinzufuegen = output();
  readonly entfernen = output<number>();
  readonly geaendert = output<{ index: number; feld: keyof EinmalkostenWerte }>();

  protected id(index: number, feld: keyof EinmalkostenWerte): string {
    return `${this.idPrefix()}-einmalkosten-${index}-${feld}`;
  }

  protected fehlerText(index: number, feld: keyof EinmalkostenWerte): string | null {
    return this.fehler().get(einmalkostenFeld(index, feld)) ?? null;
  }

  /** Ein Fehler je Zeile, in der Reihenfolge der Felder. */
  protected zeilenFehler(index: number): string | null {
    return (
      this.fehlerText(index, 'bezeichnung') ??
      this.fehlerText(index, 'betrag') ??
      this.fehlerText(index, 'faelligAm')
    );
  }

  /** Text für „Entfernen“, damit Screenreader wissen, welche Zeile gemeint ist. */
  protected entfernenLabel(index: number): string {
    return `${this.zeilen().at(index).controls.bezeichnung.value.trim() || 'Einmalkosten'} entfernen`;
  }
}
