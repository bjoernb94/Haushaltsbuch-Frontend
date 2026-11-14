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
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { catchError, distinctUntilChanged, map, of, startWith, switchMap, timer } from 'rxjs';
import {
  Verlaengerung,
  VertragAntwort,
  VertragKategorieAntwort,
  VertragVorschauAntwort,
  Zahlungsweg,
  Zahlweise,
} from '../../../core/api/api';
import { problemFelder } from '../../../core/fehler/problem';
import { UngespeicherteEingaben } from '../../../core/ungespeichert/ungespeicherte-eingaben';
import { betragText, waehrungZeichen } from '../../../shared/format/betrag.pipe';
import { HinweisBox } from '../../../shared/hinweis-box/hinweis-box';
import { PreisZeile, VertragPreisliste } from '../vertrag-preisliste/vertrag-preisliste';
import { Tabliste } from '../../../shared/tabliste/tabliste';
import {
  Uebersicht,
  VertragZusammenfassung,
} from '../vertrag-zusammenfassung/vertrag-zusammenfassung';
import {
  kategorieText,
  kuendigungText,
  preisText,
  VERLAENGERUNG_TEXT,
  vertragName,
  ZAHLUNGSWEG_TEXT,
  ZAHLWEISE_TEXT,
} from '../vertrag-texte';
import { VertragEingabe, VertragService } from '../vertrag.service';
import {
  anfrageAus,
  betragLesen,
  EinzelFeld,
  feldfehlerTexte,
  PreisWerte,
  preisFeld,
  VertragFeld,
  vertragPruefen,
  vorschauAus,
  werteAus,
} from './vertrag-pruefung';

const FEHLER_FELDER = 'Bitte prüfe die markierten Felder.';

const FEHLER_SPEICHERN =
  'Der Vertrag konnte nicht gespeichert werden. Bitte versuche es später erneut.';

/** Ausgeblendete Felder dürfen keinen Fehler behalten, den niemand mehr sieht. */
const BLENDET_AUS: Partial<Record<EinzelFeld, VertragFeld[]>> = {
  nichtKuendbar: ['verlaengerung', 'kuendigungsfristMonate'],
  gekuendigt: ['gekuendigtZum'],
};

const VORSCHAU_VERZOEGERUNG_MS = 400;

const TABS = [
  { key: 'allgemein', label: 'Allgemein' },
  { key: 'kosten', label: 'Kosten' },
  { key: 'laufzeit', label: 'Laufzeit' },
  { key: 'preise', label: 'Preise' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const TAB_VON: Record<EinzelFeld, TabKey> = {
  anbieter: 'allgemein',
  bezeichnung: 'allgemein',
  kategorieId: 'allgemein',
  vertragsnummer: 'allgemein',
  notiz: 'allgemein',
  betrag: 'kosten',
  gueltigSeit: 'kosten',
  zahlweise: 'kosten',
  abbuchungAb: 'kosten',
  zahlungsweg: 'kosten',
  nichtKuendbar: 'laufzeit',
  beginn: 'laufzeit',
  laufzeitende: 'laufzeit',
  verlaengerung: 'laufzeit',
  kuendigungsfristMonate: 'laufzeit',
  gekuendigt: 'laufzeit',
  gekuendigtZum: 'laufzeit',
};

function tabVon(feld: VertragFeld): TabKey {
  return feld.startsWith('preise.') ? 'preise' : TAB_VON[feld as EinzelFeld];
}

/** Fehler der Zeilen ab {@code index} rücken nach dem Entfernen dieser Zeile eine Zeile nach oben. */
function ohneZeile(fehler: ReadonlyMap<VertragFeld, string>, index: number) {
  const neu = new Map<VertragFeld, string>();
  for (const [feld, text] of fehler) {
    const zeile = /^preise\.(\d+)\.(\w+)$/.exec(feld);
    if (!zeile) {
      neu.set(feld, text);
    } else if (Number(zeile[1]) !== index) {
      const i = Number(zeile[1]);
      neu.set(preisFeld(i > index ? i - 1 : i, zeile[2] as keyof PreisWerte), text);
    }
  }
  return neu;
}

const NOCH_OFFEN = 'Noch offen';

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
 * Felder eines Vertrags in den Tabs Allgemein, Kosten, Laufzeit und Preise; jeder Tab zählt seine Fehler, und
 * Fehler beim Speichern führen zum ersten Tab mit Fehler. Prüft nur Pflichtfelder und meldet dann
 * {@link speichern}; das Speichern und die Antwort darauf liegen bei der Seite, die Fehler zurückgibt
 * über {@link fehlerAntwort}. Mit {@link vertrag} bearbeitet es diesen Vertrag, sonst legt es einen
 * neuen an.
 */
@Component({
  selector: 'app-vertrag-formular',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    HinweisBox,
    Tabliste,
    VertragPreisliste,
    VertragZusammenfassung,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-formular.html',
  styleUrl: './vertrag-formular.scss',
})
export class VertragFormular implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly vertraege = inject(VertragService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly locale = inject(LOCALE_ID);
  private readonly ungespeichert = inject(UngespeicherteEingaben);

  readonly kategorien = input.required<VertragKategorieAntwort[]>();
  /** Der gespeicherte Stand; die Felder belegt er nur beim Öffnen vor. */
  readonly vertrag = input<VertragAntwort | null>(null);
  readonly sendet = input(false);
  /** Fehler der letzten Anfrage, {@code null} wenn es keinen gibt. */
  readonly fehlerAntwort = input<unknown>(null);
  /** Für einen Absende-Knopf außerhalb des Formulars ({@code form}-Attribut). */
  readonly formularId = input<string | null>(null);
  /**
   * Abbrechen und Speichern im Formular: {@code ab-901} bis 900 px in der Leiste der Seite,
   * {@code nie} immer in der Leiste des Sheets.
   */
  readonly knoepfe = input<'immer' | 'ab-901' | 'nie'>('immer');
  /** Rechts daneben eine Zusammenfassung der Eingaben (ab 901 px), für „Neuer Vertrag“. */
  readonly zusammenfassung = input(false);
  /** Beim Öffnen im Tab Preise mit einer leeren Zeile („Preis hinzufügen“ in den Details). */
  readonly neuerPreis = input(false);

  readonly speichern = output<Required<VertragEingabe>>();
  readonly abbrechen = output<void>();

  /** Eindeutige Feld-IDs, auch bei zwei Formularen auf einer Seite. */
  protected readonly idPrefix = `vertrag-${++letztesFormular}`;

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
    gueltigSeit: [''],
    preise: this.fb.array<PreisZeile>([]),
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

  /** Für die Zusammenfassung; folgt den Eingaben und der Vorbelegung. */
  private readonly werte = signal(this.formular.getRawValue());

  protected readonly tab = signal<TabKey>('allgemein');

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

  private readonly vorschau = signal<VertragVorschauAntwort | null>(null);
  /** „–“ ohne Termin, z. B. bei Werten, die das Backend ablehnt. */
  protected readonly vorschauText = computed(() => {
    const vorschau = this.vorschau();
    return vorschau ? kuendigungText(vorschau.kuendigung) : '–';
  });

  /** Alle Preise mit „aktuell“ und „angekündigt“ aus der Vorschau, sobald es weitere Preise gibt. */
  protected readonly verlauf = computed(() =>
    this.werte().preise.length
      ? (this.vorschau()?.preise ?? []).map((preis) => ({
          text: preisText(preis, this.locale),
          aktuell: preis.art === 'AKTUELL',
        }))
      : [],
  );

  protected readonly feldFehler = linkedSignal<ReadonlyMap<VertragFeld, string>>(() =>
    feldfehlerTexte(problemFelder(this.fehlerAntwort())),
  );

  /** Fehler, der sich keinem Feld zuordnen lässt, z. B. Serverfehler oder keine Verbindung. */
  private readonly allgemeinerFehler = linkedSignal(
    () => !!this.fehlerAntwort() && !feldfehlerTexte(problemFelder(this.fehlerAntwort())).size,
  );

  protected readonly tabs = computed(() => {
    const anzahl = new Map<TabKey, number>();
    for (const feld of this.feldFehler().keys()) {
      anzahl.set(tabVon(feld), (anzahl.get(tabVon(feld)) ?? 0) + 1);
    }
    return TABS.map((tab) => ({ ...tab, fehler: anzahl.get(tab.key) ?? 0 }));
  });

  /** Nur Formatierung der Eingaben; Termine kommen aus der Vorschau des Backends (ADR 0010). */
  protected readonly uebersicht = computed<Uebersicht>(() => {
    const w = this.werte();
    const anbieter = w.anbieter.trim();
    const bezeichnung = w.bezeichnung.trim();
    const kategorie = this.kategorien().find(({ id }) => id === w.kategorieId);
    const wert = betragLesen(w.betrag);
    const betrag =
      wert !== null && wert > 0
        ? betragText({ wert, waehrung: this.vertrag()?.betrag.waehrung ?? 'EUR' }, this.locale) +
          (w.zahlweise ? ` ${ZAHLWEISE_TEXT[w.zahlweise]}` : '')
        : NOCH_OFFEN;
    const vorschau = this.vorschau();
    const kuendigung = w.nichtKuendbar
      ? 'Nicht kündbar'
      : vorschau
        ? kuendigungText(vorschau.kuendigung)
        : NOCH_OFFEN;
    return {
      name: bezeichnung || anbieter || 'Neuer Vertrag',
      unter:
        [bezeichnung ? anbieter : '', kategorie ? kategorieText(kategorie) : '']
          .filter(Boolean)
          .join(' · ') || 'Noch keine Angaben',
      zeilen: [
        { label: 'Betrag', wert: betrag },
        { label: 'Kündigung', wert: kuendigung },
      ],
    };
  });

  protected readonly hinweis = computed(() => {
    if (this.feldFehler().size) {
      return FEHLER_FELDER;
    }
    return this.allgemeinerFehler() ? FEHLER_SPEICHERN : null;
  });

  constructor() {
    // Nur der Fehler des geänderten Feldes verschwindet, die übrigen bleiben als Orientierung.
    // Die Zeilen der Preisliste melden sich selbst ({@link preisGeaendert}).
    const felder = Object.keys(this.formular.controls).filter((feld) => feld !== 'preise');
    for (const feld of felder as EinzelFeld[]) {
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
    this.formular.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.werte.set(this.formular.getRawValue()));
    this.destroyRef.onDestroy(() => this.ungespeichert.melden(false));
    effect(() => {
      if (this.fehlerAntwort()) {
        // Nur bei einer neuen Antwort, nicht jedes Mal, wenn danach ein Fehler verschwindet.
        untracked(() => this.fehlerZeigen());
      }
    });
  }

  ngOnInit(): void {
    this.vorbelegen();
    this.vorschauBeobachten();
  }

  private vorbelegen(): void {
    const vertrag = this.vertrag();
    if (!vertrag) {
      return;
    }
    const werte = werteAus(vertrag);
    if (this.neuerPreis()) {
      werte.preise.push({ gueltigAb: '', betrag: '' });
      this.tab.set('preise');
    }
    const preise = this.formular.controls.preise;
    werte.preise.forEach(() => preise.push(this.preisZeile(), { emitEvent: false }));
    this.formular.setValue(werte, { emitEvent: false });
    // Die leere Zeile zählt nicht als Änderung: Wer gleich wieder schließt, wird nicht gefragt.
    this.ausgangswerte = JSON.stringify(this.formular.getRawValue());
    this.werte.set(this.formular.getRawValue());
    // Die Signale folgen valueChanges, das setValue oben bewusst nicht auslöst.
    this.formular.controls.nichtKuendbar.updateValueAndValidity({ onlySelf: true });
    this.formular.controls.gekuendigt.updateValueAndValidity({ onlySelf: true });
    const ziel = this.neuerPreis()
      ? `#${this.id(preisFeld(werte.preise.length - 1, 'gueltigAb'))}`
      : 'input';
    afterNextRender(
      // Ohne Scrollen: Das Formular beginnt oben im Sheet.
      () =>
        this.formularElement()
          .nativeElement.querySelector<HTMLElement>(ziel)
          ?.focus({ preventScroll: true }),
      { injector: this.injector },
    );
  }

  private preisZeile(): PreisZeile {
    return this.fb.group({ gueltigAb: [''], betrag: [''] });
  }

  protected preisHinzufuegen(): void {
    const preise = this.formular.controls.preise;
    preise.push(this.preisZeile());
    this.fehlerEntfernen('gueltigSeit');
    const id = this.id(preisFeld(preise.length - 1, 'gueltigAb'));
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }

  protected preisEntfernen(index: number): void {
    this.formular.controls.preise.removeAt(index);
    this.allgemeinerFehler.set(false);
    this.feldFehler.update((fehler) => {
      const neu = ohneZeile(fehler, index);
      neu.delete('gueltigSeit');
      return neu;
    });
    // Der Fokus ginge mit dem Knopf verloren: zur nächsten Zeile, sonst zu „Preis hinzufügen“.
    const preise = this.formular.controls.preise;
    const ziel =
      index < preise.length ? this.id(preisFeld(index, 'gueltigAb')) : this.id('preis-hinzufuegen');
    afterNextRender(() => document.getElementById(ziel)?.focus(), { injector: this.injector });
  }

  protected preisGeaendert(index: number, feld: keyof PreisWerte): void {
    this.fehlerEntfernen(preisFeld(index, feld));
  }

  /**
   * Beim Öffnen sofort, danach verzögert. Die Verzögerung liegt im {@code switchMap}, damit eine neue
   * Eingabe auch eine laufende Anfrage abbricht. Fehler zeigen nur keine Werte, Speichern bleibt möglich.
   */
  private vorschauBeobachten(): void {
    this.formular.valueChanges
      .pipe(
        startWith(null),
        map(() => vorschauAus(this.formular.getRawValue(), this.vertrag())),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap((anfrage, index) =>
          timer(index ? VORSCHAU_VERZOEGERUNG_MS : 0).pipe(
            switchMap(() => this.vertraege.vorschau(anfrage)),
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((vorschau) => this.vorschau.set(vorschau));
  }

  protected tabWaehlen(tab: string): void {
    this.tab.set(tab as TabKey);
  }

  protected id(feld: VertragFeld | 'tab' | 'tabpanel' | 'preis-hinzufuegen'): string {
    return `${this.idPrefix}-${feld.replaceAll('.', '-')}`;
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
    const entfernt = [feld, ...(BLENDET_AUS[feld as EinzelFeld] ?? [])];
    this.allgemeinerFehler.set(false);
    this.feldFehler.update(
      (fehler) => new Map([...fehler].filter(([name]) => !entfernt.includes(name))),
    );
  }

  /**
   * Zum ersten Tab mit Fehler, dort zum ersten markierten Feld. Ohne Feldfehler (z. B. Serverfehler)
   * bleibt der Tab, die Box oben kommt in den Blick.
   */
  private fehlerZeigen(): void {
    const tab = TABS.find(({ key }) =>
      [...this.feldFehler().keys()].some((f) => tabVon(f) === key),
    );
    if (tab) {
      this.tab.set(tab.key);
    }
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
