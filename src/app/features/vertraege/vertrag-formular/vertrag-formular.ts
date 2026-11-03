import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  LOCALE_ID,
  OnInit,
  output,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { distinctUntilChanged, map } from 'rxjs';
import {
  Verlaengerung,
  VertragAntwort,
  VertragKategorieAntwort,
  Zahlungsweg,
  Zahlweise,
} from '../../../core/api/api';
import { problemFelder } from '../../../core/fehler/problem';
import { UngespeicherteEingaben } from '../../../core/ungespeichert/ungespeicherte-eingaben';
import { waehrungZeichen } from '../../../shared/format/betrag.pipe';
import { HinweisBox } from '../../../shared/hinweis-box/hinweis-box';
import {
  kategorieText,
  VERLAENGERUNG_TEXT,
  vertragName,
  ZAHLUNGSWEG_TEXT,
  ZAHLWEISE_TEXT,
} from '../vertrag-texte';
import { VertragEingabe } from '../vertrag.service';
import {
  anfrageAus,
  feldfehlerTexte,
  VertragFeld,
  vertragPruefen,
  werteAus,
} from './vertrag-pruefung';

const FEHLER_FELDER = 'Bitte prüfe die markierten Felder.';

const FEHLER_SPEICHERN =
  'Der Vertrag konnte nicht gespeichert werden. Bitte versuche es später erneut.';

/** Ausgeblendete Felder dürfen keinen Fehler behalten, den niemand mehr sieht. */
const BLENDET_AUS: Partial<Record<VertragFeld, VertragFeld[]>> = {
  nichtKuendbar: ['verlaengerung', 'kuendigungsfristMonate'],
  gekuendigt: ['gekuendigtZum'],
};

const HINWEIS_ZAHLWEISE = 'Bitte Datum der nächsten Abbuchung im neuen Rhythmus prüfen.';

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

function optionen<T extends string>(texte: Record<T, string>): { wert: T; text: string }[] {
  return (Object.keys(texte) as T[]).map((wert) => ({ wert, text: texte[wert] }));
}

let letztesFormular = 0;

/**
 * Felder eines Vertrags. Prüft nur Pflichtfelder und meldet dann {@link speichern}; das Speichern und
 * die Antwort darauf liegen bei der Seite, die Fehler zurückgibt über {@link fehlerAntwort}. Mit
 * {@link vertrag} bearbeitet es diesen Vertrag, sonst legt es einen neuen an.
 */
@Component({
  selector: 'app-vertrag-formular',
  imports: [NgTemplateOutlet, ReactiveFormsModule, HinweisBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-formular.html',
  styleUrl: './vertrag-formular.scss',
})
export class VertragFormular implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);
  private readonly locale = inject(LOCALE_ID);
  private readonly ungespeichert = inject(UngespeicherteEingaben);

  readonly kategorien = input.required<VertragKategorieAntwort[]>();
  /** Der gespeicherte Stand; die Felder belegt er nur beim Öffnen vor. */
  readonly vertrag = input<VertragAntwort | null>(null);
  readonly sendet = input(false);
  /** Fehler der letzten Anfrage, {@code null} wenn es keinen gibt. */
  readonly fehlerAntwort = input<unknown>(null);

  readonly speichern = output<Required<VertragEingabe>>();
  readonly abbrechen = output<void>();

  /** Eindeutige Feld-IDs, auch bei zwei Formularen auf einer Seite. */
  private readonly nummer = ++letztesFormular;

  private readonly formularElement =
    viewChild.required<ElementRef<HTMLFormElement>>('formularElement');

  protected readonly kategorieText = kategorieText;
  protected readonly zahlweisen = optionen<Zahlweise>(ZAHLWEISE_TEXT);
  protected readonly zahlungswege = optionen<Zahlungsweg>(ZAHLUNGSWEG_TEXT);
  protected readonly verlaengerungen = optionen<Verlaengerung>({
    ...VERLAENGERUNG_TEXT,
    KEINE: 'Keine – Vertrag endet zum Laufzeitende',
  });
  protected readonly hinweisZahlweise = HINWEIS_ZAHLWEISE;
  protected readonly fristen = computed(() => fristenMit(this.vertrag()?.kuendigungsfristMonate));
  protected readonly waehrung = computed(() =>
    waehrungZeichen(this.vertrag()?.betrag.waehrung ?? 'EUR', this.locale),
  );
  protected readonly name = computed(() => {
    const vertrag = this.vertrag();
    return vertrag && vertragName(vertrag);
  });

  protected readonly formular = this.fb.group({
    anbieter: [''],
    bezeichnung: [''],
    kategorieId: [''],
    vertragsnummer: [''],
    betrag: [''],
    zahlweise: this.fb.control<Zahlweise | ''>(''),
    abbuchungAb: [''],
    zahlungsweg: this.fb.control<Zahlungsweg | ''>(''),
    nichtKuendbar: [false],
    beginn: [''],
    laufzeitende: [''],
    verlaengerung: this.fb.control<Verlaengerung | ''>(''),
    kuendigungsfristMonate: [''],
    gekuendigt: [false],
    gekuendigtZum: [''],
    notiz: [''],
  });

  private ausgangswerte = JSON.stringify(this.formular.getRawValue());

  private readonly zahlweise = toSignal(this.formular.controls.zahlweise.valueChanges);

  protected readonly zahlweiseGeaendert = computed(() => {
    const zahlweise = this.zahlweise();
    const vertrag = this.vertrag();
    return !!vertrag && !!zahlweise && zahlweise !== vertrag.zahlweise;
  });

  protected readonly nichtKuendbar = toSignal(this.formular.controls.nichtKuendbar.valueChanges, {
    initialValue: false,
  });
  protected readonly gekuendigt = toSignal(this.formular.controls.gekuendigt.valueChanges, {
    initialValue: false,
  });

  private readonly feldFehler = linkedSignal<ReadonlyMap<VertragFeld, string>>(() =>
    feldfehlerTexte(problemFelder(this.fehlerAntwort())),
  );

  /** Fehler, der sich keinem Feld zuordnen lässt, z. B. Serverfehler oder keine Verbindung. */
  private readonly allgemeinerFehler = linkedSignal(
    () => !!this.fehlerAntwort() && !feldfehlerTexte(problemFelder(this.fehlerAntwort())).size,
  );

  protected readonly hinweis = computed(() => {
    if (this.feldFehler().size) {
      return FEHLER_FELDER;
    }
    return this.allgemeinerFehler() ? FEHLER_SPEICHERN : null;
  });

  constructor() {
    // Nur der Fehler des geänderten Feldes verschwindet, die übrigen bleiben als Orientierung.
    for (const feld of Object.keys(this.formular.controls) as VertragFeld[]) {
      const control: AbstractControl = this.formular.controls[feld];
      control.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.fehlerEntfernen(feld));
    }
    this.formular.valueChanges
      .pipe(
        map(() => JSON.stringify(this.formular.getRawValue()) !== this.ausgangswerte),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((geaendert) => this.ungespeichert.melden(geaendert));
    inject(DestroyRef).onDestroy(() => this.ungespeichert.melden(false));
    effect(() => {
      if (this.fehlerAntwort()) {
        this.fehlerZeigen();
      }
    });
  }

  ngOnInit(): void {
    const vertrag = this.vertrag();
    if (!vertrag) {
      return;
    }
    this.formular.setValue(werteAus(vertrag), { emitEvent: false });
    this.ausgangswerte = JSON.stringify(this.formular.getRawValue());
    // Die Signale folgen valueChanges, das setValue oben bewusst nicht auslöst.
    this.formular.controls.nichtKuendbar.updateValueAndValidity({ onlySelf: true });
    this.formular.controls.gekuendigt.updateValueAndValidity({ onlySelf: true });
    afterNextRender(
      // Ohne Scrollen: Wohin die Seite geht, entscheidet die Zeile, die das Formular zeigt.
      () =>
        this.formularElement()
          .nativeElement.querySelector<HTMLElement>('input')
          ?.focus({ preventScroll: true }),
      { injector: this.injector },
    );
  }

  protected id(feld: VertragFeld): string {
    return `vertrag-${this.nummer}-${feld}`;
  }

  protected fehlerText(feld: VertragFeld): string | null {
    return this.feldFehler().get(feld) ?? null;
  }

  /** Für {@code aria-describedby}: der Fehlertext, wenn es ihn gibt, und ein fester Hinweis. */
  protected beschreibung(feld: VertragFeld, hinweisId?: string): string | null {
    const fehlerId = this.fehlerText(feld) ? `${this.id(feld)}-fehler` : null;
    return [fehlerId, hinweisId].filter(Boolean).join(' ') || null;
  }

  protected absenden(): void {
    if (this.sendet()) {
      return;
    }
    const werte = this.formular.getRawValue();
    const fehler = vertragPruefen(werte);
    this.allgemeinerFehler.set(false);
    this.feldFehler.set(fehler);
    if (fehler.size) {
      this.fehlerZeigen();
      return;
    }
    this.speichern.emit(anfrageAus(werte, this.vertrag()));
  }

  private fehlerEntfernen(feld: VertragFeld): void {
    const entfernt = [feld, ...(BLENDET_AUS[feld] ?? [])];
    this.allgemeinerFehler.set(false);
    this.feldFehler.update(
      (fehler) => new Map([...fehler].filter(([name]) => !entfernt.includes(name))),
    );
  }

  /** Der Button steht am Ende des langen Formulars, die Box am Anfang: Der Fehler muss in den Blick. */
  private fehlerZeigen(): void {
    afterNextRender(
      () => {
        const formular = this.formularElement().nativeElement;
        const ziel =
          formular.querySelector<HTMLElement>('[aria-invalid="true"]') ??
          formular.querySelector<HTMLElement>('.hinweis');
        ziel?.focus();
      },
      { injector: this.injector },
    );
  }
}
