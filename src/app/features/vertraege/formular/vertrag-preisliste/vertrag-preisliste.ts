import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { datumText } from '../../../../shared/format/datum.pipe';
import { preisFeld, PreisWerte, VertragFeld } from '../vertrag-pruefung';

export type PreisZeile = FormGroup<{ [F in keyof PreisWerte]: FormControl<string> }>;

/**
 * Liste „Preise“ im Tab Preisverlauf des Vertragsformulars, darunter der Preisverlauf aus der Vorschau.
 * Die erste Zeile ist der Betrag aus dem Tab Kosten (derselbe Wert), ihr Datum der Vertragsbeginn;
 * sie lässt sich nicht entfernen. Zeilen und Fehler gehören dem Formular, das auch hinzufügt und
 * entfernt; IDs: {@code <idPrefix>-preise-erster-<feld>}, sonst {@code <idPrefix>-preise-<i>-<feld>}.
 */
@Component({
  selector: 'app-vertrag-preisliste',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-preisliste.html',
  styleUrl: './vertrag-preisliste.scss',
})
export class VertragPreisliste {
  /**
   * Der Betrag ab Vertragsbeginn aus dem Tab Kosten. Eine Eingabe hier meldet {@link betragGeaendert};
   * ein zweites Feld am selben FormControl bekäme Eingaben im anderen nicht mit.
   */
  readonly betrag = input.required<string>();
  /** ISO-Datum, leer solange kein Vertragsbeginn eingegeben ist. */
  readonly beginn = input.required<string>();
  readonly zeilen = input.required<FormArray<PreisZeile>>();
  readonly waehrung = input.required<string>();
  readonly verlauf = input.required<{ text: string; aktuell: boolean }[]>();
  readonly fehler = input.required<ReadonlyMap<VertragFeld, string>>();
  readonly idPrefix = input.required<string>();

  readonly betragGeaendert = output<string>();
  readonly hinzufuegen = output();
  readonly entfernen = output<number>();
  readonly geaendert = output<{ index: number; feld: keyof PreisWerte }>();

  protected readonly beginnText = computed(() => datumText(this.beginn()));

  protected erstId(feld: keyof PreisWerte | 'fehler' | 'hinweis'): string {
    return `${this.idPrefix()}-preise-erster-${feld}`;
  }

  /** Fehler am Betrag zeigt auch die erste Zeile; gezählt wird er im Tab Kosten. */
  protected readonly ersterFehler = computed(() => this.fehler().get('betrag') ?? null);

  protected betragEingabe(event: Event): void {
    this.betragGeaendert.emit((event.target as HTMLInputElement).value);
  }

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
