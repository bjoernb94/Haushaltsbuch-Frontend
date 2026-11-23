import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { Erhoehungsrhythmus, Steigerungsart } from '../../../../core/api/api';
import { datumText } from '../../../../shared/format/datum.pipe';
import { InfoKnopf } from '../../../../shared/info-knopf/info-knopf';
import { VertragFeld } from '../vertrag-pruefung';
import { INFO_RUNDUNG_PROGNOSE, RHYTHMUS_TEXT } from '../../vertrag-texte';

/** Die Prognose in der Box: drei Zeilen oder ein Hinweis, warum es keine gibt. */
export interface PrognoseAnzeige {
  zeilen: string[];
  hinweis: string | null;
}

const RHYTHMEN = (Object.keys(RHYTHMUS_TEXT) as Erhoehungsrhythmus[]).map((wert) => ({
  wert,
  text: RHYTHMUS_TEXT[wert],
}));

/**
 * Preisgarantie, regelmäßige Erhöhung mit Prognose und Erinnerung ans Sonderkündigungsrecht im Tab
 * Preisverlauf des Vertragsformulars. Die Felder gehören zum Formular ({@code formControlName} im
 * umgebenden {@code formGroup}); Fehler, Prognose und ob die Erinnerung erscheint, kommen von dort.
 */
@Component({
  selector: 'app-vertrag-preissteigerung',
  imports: [ReactiveFormsModule, InfoKnopf],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-preissteigerung.html',
  styleUrl: './vertrag-preissteigerung.scss',
})
export class VertragPreissteigerung {
  readonly idPrefix = input.required<string>();
  readonly fehler = input.required<ReadonlyMap<VertragFeld, string>>();
  /** Zeichen der Währung für die Bezeichnung, z. B. „€“. */
  readonly waehrung = input.required<string>();
  /** Name der Währung für die Auswahl, z. B. „Euro“. */
  readonly waehrungName = input.required<string>();
  readonly steigt = input.required<boolean>();
  readonly art = input.required<Steigerungsart>();
  readonly prognose = input.required<PrognoseAnzeige>();
  readonly erinnerung = input.required<boolean>();
  /**
   * Der vom Backend vorgeschlagene Termin, wenn sich der Beginn geändert hat und das Feld ihm nicht
   * mehr folgt; dann steht ein Hinweis mit „Vorschlag übernehmen“ am Feld.
   */
  readonly terminVorschlag = input<string | null>(null);
  /** Hinweis, dass eine geänderte Regel bereits angelegte Preise nicht ändert. */
  readonly regelGeaendert = input(false);

  readonly vorschlagUebernehmen = output<string>();

  protected readonly vorschlagText = computed(() => {
    const vorschlag = this.terminVorschlag();
    return vorschlag ? datumText(vorschlag) : '';
  });

  protected readonly rhythmen = RHYTHMEN;

  protected readonly infoPrognose = computed(() =>
    this.prognose().zeilen.length ? [INFO_RUNDUNG_PROGNOSE] : [],
  );

  protected readonly wertLabel = computed(() =>
    this.art() === 'PROZENT' ? 'Erhöhung in % *' : `Erhöhung in ${this.waehrung()} *`,
  );
  protected readonly wertPlatzhalter = computed(() =>
    this.art() === 'PROZENT' ? 'z. B. 2,5' : 'z. B. 1,00',
  );

  protected id(feld: string): string {
    return `${this.idPrefix()}-${feld}`;
  }

  protected fehlerText(feld: VertragFeld): string | null {
    return this.fehler().get(feld) ?? null;
  }

  /** Für {@code aria-describedby}: der Fehlertext, wenn es ihn gibt, und feste Hinweise. */
  protected beschreibung(feld: VertragFeld, ...hinweisIds: (string | null)[]): string | null {
    const fehlerId = this.fehlerText(feld) ? `${this.id(feld)}-fehler` : null;
    return [fehlerId, ...hinweisIds].filter(Boolean).join(' ') || null;
  }
}
