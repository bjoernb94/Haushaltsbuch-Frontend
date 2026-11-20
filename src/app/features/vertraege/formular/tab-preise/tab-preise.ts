import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { FormArray } from '@angular/forms';
import { VertragVorschauAntwort } from '../../../../core/api/api';
import { betragText } from '../../../../shared/format/betrag.pipe';
import { datumText } from '../../../../shared/format/datum.pipe';
import { preisText } from '../../vertrag-texte';
import { PreisZeile, VertragPreisliste } from '../vertrag-preisliste/vertrag-preisliste';
import {
  PrognoseAnzeige,
  VertragPreissteigerung,
} from '../vertrag-preissteigerung/vertrag-preissteigerung';
import { PreisWerte, VertragWerte } from '../vertrag-pruefung';
import { VertragTab } from '../vertrag-tabs';

const PROGNOSE_UNVOLLSTAENDIG =
  'Gib Wert und Datum der nächsten Erhöhung ein, dann zeigen wir hier die nächsten drei Preise.';

const PROGNOSE_KEINE = 'Bis zum Vertragsende ist keine Erhöhung zu erwarten.';

/**
 * Tab Preisverlauf des Vertragsformulars: Preisliste und Preissteigerung, Verlauf und Prognose aus der
 * Vorschau des Formulars. Die Zeilen der Preisliste fügt das Formular hinzu und entfernt sie.
 */
@Component({
  selector: 'app-vertrag-tab-preise',
  imports: [VertragPreisliste, VertragPreissteigerung],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tab-preise.html',
  styleUrl: '../_tab.scss',
})
export class VertragTabPreise extends VertragTab {
  private readonly locale = inject(LOCALE_ID);

  readonly preise = input.required<FormArray<PreisZeile>>();
  /** Zeichen der Währung für die Bezeichnungen, z. B. „€“. */
  readonly waehrung = input.required<string>();
  /** Name der Währung für die Auswahl, z. B. „Euro“. */
  readonly waehrungName = input.required<string>();
  readonly werte = input.required<VertragWerte>();
  readonly vorschau = input.required<VertragVorschauAntwort | null>();

  /** Eingabe in der ersten Zeile der Preisliste, dem Betrag aus dem Tab Kosten. */
  readonly betragGeaendert = output<string>();
  readonly hinzufuegen = output();
  readonly entfernen = output<number>();
  readonly geaendert = output<{ index: number; feld: keyof PreisWerte }>();

  /** Alle Preise mit „aktuell“ und „angekündigt“ aus der Vorschau, sobald es weitere Preise gibt. */
  protected readonly verlauf = computed(() =>
    this.werte().preise.length
      ? (this.vorschau()?.preise ?? []).map((preis) => ({
          text: preisText(preis, this.locale),
          aktuell: preis.art === 'AKTUELL',
        }))
      : [],
  );

  /**
   * Die nächsten drei Preise der Vorschau. Ohne Prognose ein Hinweis: Fehlen Wert oder Datum, dazu; sonst
   * verhindern Garantie oder Vertragsende jede Erhöhung. „–“, solange die Vorschau nichts liefert.
   */
  protected readonly prognose = computed<PrognoseAnzeige>(() => {
    const w = this.werte();
    if (!w.steigerungswert.trim() || !w.naechsteErhoehungAm) {
      return { zeilen: [], hinweis: PROGNOSE_UNVOLLSTAENDIG };
    }
    const vorschau = this.vorschau();
    if (!vorschau) {
      return { zeilen: [], hinweis: '–' };
    }
    const zeilen = vorschau.prognose.map(
      ({ ab, betrag }) => `ab ${datumText(ab)} voraussichtlich ${betragText(betrag, this.locale)}`,
    );
    return { zeilen, hinweis: zeilen.length ? null : PROGNOSE_KEINE };
  });

  /** Wie im Design: bei kündbaren Verträgen mit Regel oder angekündigtem Preis (laut Vorschau). */
  protected readonly erinnerung = computed(() => {
    const w = this.werte();
    return (
      !w.nichtKuendbar &&
      (w.steigt || !!this.vorschau()?.preise.some(({ art }) => art === 'ANGEKUENDIGT'))
    );
  });
}
