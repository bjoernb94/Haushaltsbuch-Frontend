import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
} from '@angular/core';
import {
  ControlContainer,
  FormControl,
  FormGroupDirective,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  Verlaengerung,
  VertragUnterbrechungAntwort,
  VertragVorschauAntwort,
} from '../../../../core/api/api';
import {
  kuendigungText,
  UNTERBRECHUNG_ART_TEXT,
  VERLAENGERUNG_TEXT,
  zeitraumText,
} from '../../vertrag-texte';
import { optionen, VertragTab } from '../vertrag-tabs';

const FRISTEN = [
  { wert: '0', text: 'Keine Frist' },
  { wert: '1', text: '1 Monat' },
  { wert: '2', text: '2 Monate' },
  { wert: '3', text: '3 Monate' },
  { wert: '6', text: '6 Monate' },
];

/** Das Backend erlaubt mehr Fristen, als die Auswahl bietet; eine gespeicherte darf nicht verloren gehen. */
export function fristenMit(gespeichert: number | null | undefined) {
  const wert = gespeichert?.toString();
  return wert === undefined || FRISTEN.some((frist) => frist.wert === wert)
    ? FRISTEN
    : [...FRISTEN, { wert, text: `${wert} Monate` }];
}

/** Auswahl „Verlängerung“, auch im Dialog „Wieder aufnehmen“. */
export const VERLAENGERUNGEN = optionen<Verlaengerung>({
  ...VERLAENGERUNG_TEXT,
  KEINE: 'Keine – Vertrag endet zum Laufzeitende',
});

/**
 * Tab Laufzeit des Vertragsformulars: Laufzeit, Verlängerung und Frist mit dem nächsten
 * Kündigungstermin aus der Vorschau und der Erinnerung ans Sonderkündigungsrecht, dazu der Status
 * „Gekündigt“. Beim Bearbeiten darunter die Unterbrechungen, die sich hier entfernen lassen (wirksam
 * beim Sichern, bis dahin rückgängig zu machen).
 */
@Component({
  selector: 'app-vertrag-tab-laufzeit',
  imports: [ReactiveFormsModule],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tab-laufzeit.html',
  styleUrls: ['../_tab.scss', './tab-laufzeit.scss'],
})
export class VertragTabLaufzeit extends VertragTab {
  /** Die Frist des gespeicherten Vertrags, damit die Auswahl sie anbietet. */
  readonly gespeicherteFrist = input<number | null>();
  readonly nichtKuendbar = input.required<boolean>();
  readonly gekuendigt = input.required<boolean>();
  /** „Preis steigt regelmäßig“ aus dem Tab Preisverlauf; davon hängt die Erinnerung ab. */
  readonly steigt = input.required<boolean>();
  readonly vorschau = input.required<VertragVorschauAntwort | null>();
  /** Die gespeicherten Unterbrechungen, beim Anlegen keine. */
  readonly unterbrechungen = input<VertragUnterbrechungAntwort[]>([]);
  /** IDs der zum Entfernen markierten, aus den Werten des Formulars. */
  readonly entfernt = input<string[]>([]);

  private readonly formular = inject(FormGroupDirective);
  private readonly injector = inject(Injector);

  protected readonly unterbrechungsZeilen = computed(() =>
    this.unterbrechungen().map((u) => ({
      id: u.id,
      zeitraum: zeitraumText(u),
      art: UNTERBRECHUNG_ART_TEXT[u.art],
      entfernt: this.entfernt().includes(u.id),
    })),
  );
  protected readonly bleibende = computed(() =>
    this.unterbrechungsZeilen().filter(({ entfernt }) => !entfernt),
  );
  /** In der Reihenfolge des Markierens, wie im Design unter der Liste. */
  protected readonly entfernte = computed(() =>
    this.entfernt()
      .map((id) => this.unterbrechungsZeilen().find((zeile) => zeile.id === id))
      .filter((zeile) => !!zeile),
  );

  protected readonly verlaengerungen = VERLAENGERUNGEN;
  protected readonly fristen = computed(() => fristenMit(this.gespeicherteFrist()));

  /**
   * Wie im Design: die Erinnerung ans Sonderkündigungsrecht bei kündbaren Verträgen mit Regel oder
   * angekündigtem Preis (laut Vorschau).
   */
  protected readonly erinnerung = computed(
    () =>
      !this.nichtKuendbar() &&
      (this.steigt() || !!this.vorschau()?.preise.some(({ art }) => art === 'ANGEKUENDIGT')),
  );

  /** Fürs Sichern vormerken; der Fokus geht an „Rückgängig“, denn der Knopf verschwindet. */
  protected entfernen(id: string): void {
    this.setzen([...this.entfernt(), id]);
    this.fokus(`${this.idPrefix()}-unterbrechung-${id}-zurueck`);
  }

  protected rueckgaengig(id: string): void {
    this.setzen(this.entfernt().filter((entfernt) => entfernt !== id));
    this.fokus(`${this.idPrefix()}-unterbrechung-${id}-entfernen`);
  }

  private setzen(ids: string[]): void {
    const control = this.formular.form.get('entfernteUnterbrechungen') as FormControl<string[]>;
    control.setValue(ids);
  }

  private fokus(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }

  /** „–“ ohne Termin, z. B. bei Werten, die das Backend ablehnt. */
  protected readonly vorschauText = computed(() => {
    const vorschau = this.vorschau();
    return vorschau ? kuendigungText(vorschau.kuendigung) : '–';
  });
}
