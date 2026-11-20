import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import {
  ControlContainer,
  FormArray,
  FormGroupDirective,
  ReactiveFormsModule,
} from '@angular/forms';
import { VertragVorschauAntwort, Zahlungsweg, Zahlweise } from '../../../../core/api/api';
import { betragText } from '../../../../shared/format/betrag.pipe';
import { datumText } from '../../../../shared/format/datum.pipe';
import { InfoKnopf } from '../../../../shared/info-knopf/info-knopf';
import { INFO_RUNDUNG, ZAHLUNGSWEG_TEXT, ZAHLWEISE_TEXT } from '../../vertrag-texte';
import {
  EinmalkostenZeile,
  VertragEinmalkostenZeilen,
} from '../vertrag-einmalkosten-zeilen/vertrag-einmalkosten-zeilen';
import { EinmalkostenWerte, VertragWerte } from '../vertrag-pruefung';
import { optionen, VertragTab } from '../vertrag-tabs';

/**
 * Tab Kosten des Vertragsformulars: Betrag ab Vertragsbeginn, Zahlweise, Beginn, Zahlungsweg, Anteil und
 * Einmalkosten.
 * Anteil und Summe der Einmalkosten kommen aus der Vorschau des Formulars; die Zeilen der Einmalkosten
 * fügt das Formular hinzu und entfernt sie.
 */
@Component({
  selector: 'app-vertrag-tab-kosten',
  imports: [ReactiveFormsModule, InfoKnopf, VertragEinmalkostenZeilen],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tab-kosten.html',
  styleUrl: '../_tab.scss',
})
export class VertragTabKosten extends VertragTab {
  private readonly locale = inject(LOCALE_ID);

  readonly einmalkosten = input.required<FormArray<EinmalkostenZeile>>();
  /** Zeichen der Währung für die Bezeichnungen, z. B. „€“. */
  readonly waehrung = input.required<string>();
  readonly werte = input.required<VertragWerte>();
  readonly vorschau = input.required<VertragVorschauAntwort | null>();

  readonly hinzufuegen = output();
  readonly entfernen = output<number>();
  readonly geaendert = output<{ index: number; feld: keyof EinmalkostenWerte }>();

  protected readonly zahlweisen = optionen<Zahlweise>(ZAHLWEISE_TEXT);
  protected readonly zahlungswege = optionen<Zahlungsweg>(ZAHLUNGSWEG_TEXT);

  /**
   * „50 % von 586,80 € = 293,40 € jährlich“: Prozent wie eingegeben, beide Beträge aus der Vorschau.
   * Ohne Anteil unter 100 % (oder ohne Preis) keine Zeile.
   */
  protected readonly anteilText = computed(() => {
    const vorschau = this.vorschau();
    const w = this.werte();
    if (!vorschau?.eigenerAnteil || !vorschau.betrag || !w.anteilProzent.trim()) {
      return null;
    }
    const zahlweise = w.zahlweise ? ` ${ZAHLWEISE_TEXT[w.zahlweise]}` : '';
    return (
      `${w.anteilProzent.trim()} % von ${betragText(vorschau.betrag, this.locale)} = ` +
      `${betragText(vorschau.eigenerAnteil.betrag, this.locale)}${zahlweise}`
    );
  });

  /**
   * „Aktuell: 52,20 € seit 01.07.2021“, wenn heute laut Vorschau ein späterer Preis gilt als der Betrag
   * ab Vertragsbeginn; sonst keine Zeile.
   */
  protected readonly aktuell = computed(() => {
    const preise = this.vorschau()?.preise ?? [];
    const aktuell = preise.find(({ art }) => art === 'AKTUELL');
    return aktuell && aktuell !== preise[0]
      ? `Aktuell: ${betragText(aktuell.betrag, this.locale)} seit ${datumText(aktuell.gueltigAb)}`
      : null;
  });

  protected readonly infoAnteil = computed(() => (this.anteilText() ? [INFO_RUNDUNG] : []));

  /** Summe der vollständigen Zeilen aus der Vorschau; ohne Zeilen keine. */
  protected readonly summe = computed(() => {
    const summe = this.vorschau()?.einmalkosten;
    return this.werte().einmalkosten.length && summe
      ? `Einmalkosten gesamt: ${betragText(summe, this.locale)}`
      : null;
  });
}
