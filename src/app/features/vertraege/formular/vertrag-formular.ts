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
  VertragAntwort,
  VertragKategorieAntwort,
  VertragVorschauAntwort,
} from '../../../core/api/api';
import { problemFelder } from '../../../core/fehler/problem';
import { UngespeicherteEingaben } from '../../../core/ungespeichert/ungespeicherte-eingaben';
import { waehrungName, waehrungZeichen } from '../../../shared/format/betrag.pipe';
import { HinweisBox } from '../../../shared/hinweis-box/hinweis-box';
import { Tabliste } from '../../../shared/tabliste/tabliste';
import { vertragName } from '../vertrag-texte';
import { VertragEingabe, VertragService } from '../vertrag.service';
import { VertragTabAllgemein } from './tab-allgemein/tab-allgemein';
import { VertragTabKosten } from './tab-kosten/tab-kosten';
import { VertragTabLaufzeit } from './tab-laufzeit/tab-laufzeit';
import { VertragTabPreise } from './tab-preise/tab-preise';
import { einmalkostenZeile, ohneZeile, preisZeile, vertragGruppe } from './vertrag-gruppe';
import {
  anfrageAus,
  EinmalkostenWerte,
  einmalkostenFeld,
  EinzelFeld,
  feldfehlerTexte,
  PreisWerte,
  preisFeld,
  VertragFeld,
  vertragPruefen,
  vorschauAus,
  werteAus,
} from './vertrag-pruefung';
import { TabKey, TABS, tabVon } from './vertrag-tabs';
import {
  uebersichtAus,
  VertragZusammenfassung,
} from './vertrag-zusammenfassung/vertrag-zusammenfassung';

const FEHLER_FELDER = 'Bitte prüfe die markierten Felder.';

const FEHLER_SPEICHERN =
  'Der Vertrag konnte nicht gespeichert werden. Bitte versuche es später erneut.';

/** Ausgeblendete Felder dürfen keinen Fehler behalten, den niemand mehr sieht. */
const BLENDET_AUS: Partial<Record<EinzelFeld, VertragFeld[]>> = {
  nichtKuendbar: ['verlaengerung', 'kuendigungsfristMonate'],
  gekuendigt: ['gekuendigtZum'],
  steigt: ['steigerungsart', 'steigerungswert', 'rhythmus', 'naechsteErhoehungAm'],
};

const VORSCHAU_VERZOEGERUNG_MS = 400;

let letztesFormular = 0;

/**
 * Felder eines Vertrags in den Tabs Allgemein, Kosten, Laufzeit und Preisverlauf (je eine Komponente);
 * das Formular hält Werte, Fehler und Vorschau. Jeder Tab zählt seine Fehler, und Fehler beim Speichern
 * führen zum ersten Tab mit Fehler. Prüft nur Pflichtfelder und meldet dann
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
    VertragTabAllgemein,
    VertragTabKosten,
    VertragTabLaufzeit,
    VertragTabPreise,
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
  /** Beim Öffnen im Tab Preisverlauf mit einer leeren Zeile („Preis hinzufügen“ in den Details). */
  readonly neuerPreis = input(false);

  readonly speichern = output<Required<VertragEingabe>>();
  readonly abbrechen = output<void>();

  /** Eindeutige Feld-IDs, auch bei zwei Formularen auf einer Seite. */
  protected readonly idPrefix = `vertrag-${++letztesFormular}`;

  private readonly formularElement =
    viewChild.required<ElementRef<HTMLFormElement>>('formularElement');

  protected readonly waehrung = computed(() =>
    waehrungZeichen(this.vertrag()?.betrag.waehrung ?? 'EUR', this.locale),
  );
  protected readonly waehrungName = computed(() =>
    waehrungName(this.vertrag()?.betrag.waehrung ?? 'EUR', this.locale),
  );
  protected readonly name = computed(() => {
    const vertrag = this.vertrag();
    return vertrag && vertragName(vertrag);
  });

  protected readonly formular = vertragGruppe(this.fb);

  private ausgangswerte = JSON.stringify(this.formular.getRawValue());

  /** Für die Zusammenfassung; folgt den Eingaben und der Vorbelegung. */
  protected readonly werte = signal(this.formular.getRawValue());

  protected readonly tab = signal<TabKey>('allgemein');

  protected readonly nichtKuendbar = toSignal(this.formular.controls.nichtKuendbar.valueChanges, {
    initialValue: false,
  });
  protected readonly gekuendigt = toSignal(this.formular.controls.gekuendigt.valueChanges, {
    initialValue: false,
  });

  protected readonly vorschau = signal<VertragVorschauAntwort | null>(null);
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

  protected readonly uebersicht = computed(() =>
    uebersichtAus(this.werte(), this.vorschau(), this.kategorien(), this.locale),
  );

  protected readonly hinweis = computed(() => {
    if (this.feldFehler().size) {
      return FEHLER_FELDER;
    }
    return this.allgemeinerFehler() ? FEHLER_SPEICHERN : null;
  });

  constructor() {
    // Nur der Fehler des geänderten Feldes verschwindet, die übrigen bleiben als Orientierung.
    // Die Zeilen der Preisliste und der Einmalkosten melden sich selbst ({@link preisGeaendert},
    // {@link einmalkostenGeaendert}); bei {@code einmalkosten} geht nur der Fehler an der Liste.
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
    werte.preise.forEach(() => preise.push(preisZeile(this.fb), { emitEvent: false }));
    const einmalkosten = this.formular.controls.einmalkosten;
    werte.einmalkosten.forEach(() =>
      einmalkosten.push(einmalkostenZeile(this.fb), { emitEvent: false }),
    );
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

  protected preisHinzufuegen(): void {
    const preise = this.formular.controls.preise;
    preise.push(preisZeile(this.fb));
    const id = this.id(preisFeld(preise.length - 1, 'gueltigAb'));
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }

  protected preisEntfernen(index: number): void {
    this.formular.controls.preise.removeAt(index);
    this.allgemeinerFehler.set(false);
    this.feldFehler.update((fehler) => ohneZeile(fehler, 'preise', index));
    // Der Fokus ginge mit dem Knopf verloren: zur nächsten Zeile, sonst zu „Preis hinzufügen“.
    const preise = this.formular.controls.preise;
    const ziel =
      index < preise.length ? this.id(preisFeld(index, 'gueltigAb')) : this.id('preis-hinzufuegen');
    afterNextRender(() => document.getElementById(ziel)?.focus(), { injector: this.injector });
  }

  protected preisGeaendert(index: number, feld: keyof PreisWerte): void {
    this.fehlerEntfernen(preisFeld(index, feld));
  }

  protected einmalkostenHinzufuegen(): void {
    const einmalkosten = this.formular.controls.einmalkosten;
    einmalkosten.push(einmalkostenZeile(this.fb));
    const id = this.id(einmalkostenFeld(einmalkosten.length - 1, 'bezeichnung'));
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }

  protected einmalkostenEntfernen(index: number): void {
    this.formular.controls.einmalkosten.removeAt(index);
    this.allgemeinerFehler.set(false);
    this.feldFehler.update((fehler) => ohneZeile(fehler, 'einmalkosten', index));
    // Der Fokus ginge mit dem Knopf verloren: zur nächsten Zeile, sonst zu „Einmalkosten hinzufügen“.
    const einmalkosten = this.formular.controls.einmalkosten;
    const ziel =
      index < einmalkosten.length
        ? this.id(einmalkostenFeld(index, 'bezeichnung'))
        : this.id('einmalkosten-hinzufuegen');
    afterNextRender(() => document.getElementById(ziel)?.focus(), { injector: this.injector });
  }

  protected einmalkostenGeaendert(index: number, feld: keyof EinmalkostenWerte): void {
    this.fehlerEntfernen(einmalkostenFeld(index, feld));
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

  protected id(
    feld: VertragFeld | 'tab' | 'tabpanel' | 'preis-hinzufuegen' | 'einmalkosten-hinzufuegen',
  ): string {
    return `${this.idPrefix}-${feld.replaceAll('.', '-')}`;
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
