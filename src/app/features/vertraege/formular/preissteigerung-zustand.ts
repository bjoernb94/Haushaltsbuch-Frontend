import { computed, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { VertragVorschauAntwort } from '../../../core/api/api';
import { preisSchluessel } from './vertrag-preisliste/vertrag-preisliste';
import { VertragWerte } from './vertrag-pruefung';

/** Die Felder der Regel; weichen sie vom gespeicherten Stand ab, ist die Regel geändert. */
const REGEL_FELDER = [
  'steigt',
  'steigerungsart',
  'steigerungswert',
  'rhythmus',
  'naechsteErhoehungAm',
] as const;

interface Felder {
  beginn: FormControl<string>;
  steigt: FormControl<boolean>;
  naechsteErhoehungAm: FormControl<string>;
}

/**
 * Was das Vertragsformular zur Preissteigerung über die Felder hinaus weiß. Im Injektionskontext
 * anlegen (beobachtet den Termin bis zum Ende des Formulars).
 * <p>
 * „Erste Erhöhung am“ übernimmt den Vorschlag der Vorschau (Beginn plus Rhythmus, vom Backend), bis der
 * Nutzer selbst ein Datum einträgt; ein geleertes Feld folgt wieder. Ein gespeichertes Datum folgt
 * nicht. Ändert sich danach der Beginn, steht ein Hinweis mit dem Vorschlag am Feld, der Wert bleibt.
 */
export class PreissteigerungZustand {
  private readonly folgt = signal(true);
  /** Der zuletzt selbst gesetzte Vorschlag, damit seine Änderung nicht als Eingabe zählt. */
  private gesetzt: string | null = null;
  /** Der Beginn, zu dem der Termin gehört (geladen, eingegeben oder übernommen). */
  private readonly terminBeginn = signal('');

  /** Die automatischen Preise des gespeicherten Stands, für ihr Kennzeichen in der Liste. */
  readonly geladen = computed<ReadonlySet<string>>(
    () =>
      new Set(
        (this.gespeichert()?.preise ?? [])
          .filter((preis) => preis.automatisch)
          .map(preisSchluessel),
      ),
  );

  /** Mit automatischen Preisen: Eine geänderte Regel wirkt nur auf künftige Erhöhungen (ADR 0022). */
  readonly regelGeaendert = computed(() => {
    const gespeichert = this.gespeichert();
    const w = this.werte();
    return (
      !!gespeichert?.preise.some((preis) => preis.automatisch) &&
      REGEL_FELDER.some((feld) => w[feld] !== gespeichert[feld])
    );
  });

  /** Der Vorschlag für den Hinweis am Termin, {@code null} ohne Hinweis. */
  readonly terminVorschlag = computed(() => {
    const w = this.werte();
    const vorschlag = this.vorschau()?.vorschlagNaechsteAm ?? null;
    return w.steigt &&
      !this.folgt() &&
      vorschlag &&
      w.naechsteErhoehungAm &&
      w.naechsteErhoehungAm !== vorschlag &&
      w.beginn !== this.terminBeginn()
      ? vorschlag
      : null;
  });

  /**
   * @param werte die aktuellen Formularwerte
   * @param gespeichert die Werte des gespeicherten Stands, {@code null} bei einem neuen Vertrag
   */
  constructor(
    private readonly felder: Felder,
    private readonly werte: Signal<VertragWerte>,
    private readonly gespeichert: Signal<VertragWerte | null>,
    private readonly vorschau: Signal<VertragVorschauAntwort | null>,
  ) {
    felder.naechsteErhoehungAm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((wert) => this.eingegeben(wert));
  }

  /** Nach dem Vorbelegen beim Bearbeiten: Ein gespeichertes Datum folgt nicht. */
  geladenAus(werte: VertragWerte): void {
    this.folgt.set(!werte.naechsteErhoehungAm);
    this.terminBeginn.set(werte.beginn);
  }

  /** Belegt den Termin mit dem Vorschlag einer neuen Vorschau vor, solange das Feld ihm folgt. */
  anwenden(vorschau: VertragVorschauAntwort | null): void {
    const vorschlag = vorschau?.vorschlagNaechsteAm;
    if (
      vorschlag &&
      this.folgt() &&
      this.felder.steigt.value &&
      this.felder.naechsteErhoehungAm.value !== vorschlag
    ) {
      this.setzen(vorschlag);
    }
  }

  /** „Vorschlag übernehmen“: Danach folgt das Feld wieder. */
  uebernehmen(vorschlag: string): void {
    this.setzen(vorschlag);
    this.folgt.set(true);
  }

  private eingegeben(wert: string): void {
    if (wert && wert === this.gesetzt) {
      return;
    }
    this.gesetzt = null;
    this.folgt.set(!wert);
    this.terminBeginn.set(this.felder.beginn.value);
  }

  private setzen(vorschlag: string): void {
    this.gesetzt = vorschlag;
    this.terminBeginn.set(this.felder.beginn.value);
    this.felder.naechsteErhoehungAm.setValue(vorschlag);
  }
}
