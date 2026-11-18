import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { Verlaengerung, VertragVorschauAntwort } from '../../../../core/api/api';
import { kuendigungText, VERLAENGERUNG_TEXT } from '../../vertrag-texte';
import { optionen, VertragTab } from '../vertrag-tabs';

const FRISTEN = [
  { wert: '0', text: 'Keine Frist' },
  { wert: '1', text: '1 Monat' },
  { wert: '2', text: '2 Monate' },
  { wert: '3', text: '3 Monate' },
  { wert: '6', text: '6 Monate' },
];

/** Das Backend erlaubt mehr Fristen, als die Auswahl bietet; eine gespeicherte darf nicht verloren gehen. */
function fristenMit(gespeichert: number | null | undefined) {
  const wert = gespeichert?.toString();
  return wert === undefined || FRISTEN.some((frist) => frist.wert === wert)
    ? FRISTEN
    : [...FRISTEN, { wert, text: `${wert} Monate` }];
}

/**
 * Tab Laufzeit des Vertragsformulars: Laufzeit, Verlängerung und Frist mit dem nächsten
 * Kündigungstermin aus der Vorschau, dazu der Status „Gekündigt“.
 */
@Component({
  selector: 'app-vertrag-tab-laufzeit',
  imports: [ReactiveFormsModule],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tab-laufzeit.html',
  styleUrl: '../_tab.scss',
})
export class VertragTabLaufzeit extends VertragTab {
  /** Die Frist des gespeicherten Vertrags, damit die Auswahl sie anbietet. */
  readonly gespeicherteFrist = input<number | null>();
  readonly nichtKuendbar = input.required<boolean>();
  readonly gekuendigt = input.required<boolean>();
  readonly vorschau = input.required<VertragVorschauAntwort | null>();

  protected readonly verlaengerungen = optionen<Verlaengerung>({
    ...VERLAENGERUNG_TEXT,
    KEINE: 'Keine – Vertrag endet zum Laufzeitende',
  });
  protected readonly fristen = computed(() => fristenMit(this.gespeicherteFrist()));

  /** „–“ ohne Termin, z. B. bei Werten, die das Backend ablehnt. */
  protected readonly vorschauText = computed(() => {
    const vorschau = this.vorschau();
    return vorschau ? kuendigungText(vorschau.kuendigung) : '–';
  });
}
