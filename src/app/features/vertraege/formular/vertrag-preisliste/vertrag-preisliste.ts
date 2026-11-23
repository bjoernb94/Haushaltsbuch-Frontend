import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
  signal,
} from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Preiszeilenart, VertragVorschauPreisAntwort } from '../../../../core/api/api';
import { betragText } from '../../../../shared/format/betrag.pipe';
import { datumText } from '../../../../shared/format/datum.pipe';
import {
  Abschnitt,
  gruppenText,
  gruppieren,
  MitIndex,
  neuHinweisText,
} from '../../automatische-preise';
import { AUTOMATISCH_TEXT, PREISZEILE_ETIKETT } from '../../vertrag-texte';
import {
  betragEingabe,
  preisFeld,
  PreisEingabeFeld,
  PreisWerte,
  VertragFeld,
} from '../vertrag-pruefung';

export type PreisZeile = FormGroup<{
  gueltigAb: FormControl<string>;
  betrag: FormControl<string>;
  automatisch: FormControl<boolean>;
}>;

const ETIKETT_KLASSE: Record<Preiszeilenart, string> = {
  FRUEHER: '',
  AKTUELL: 'aktuell',
  ANGEKUENDIGT: 'angekuendigt',
  NACH_ENDE: 'nach-ende',
};

/** Schlüssel eines geladenen Preises, um Änderungen an automatischen Preisen zu erkennen. */
export function preisSchluessel({ gueltigAb, betrag }: Pick<PreisWerte, 'gueltigAb' | 'betrag'>) {
  return `${gueltigAb}|${betrag}`;
}

/**
 * Liste „Preise“ im Tab Preisverlauf des Vertragsformulars. Die erste Zeile ist der Betrag aus dem Tab Kosten (derselbe Wert), ihr Datum der Vertragsbeginn;
 * sie lässt sich nicht entfernen. Zeilen und Fehler gehören dem Formular, das auch hinzufügt und
 * entfernt; IDs: {@code <idPrefix>-preise-erster-<feld>}, sonst {@code <idPrefix>-preise-<i>-<feld>}.
 * <p>
 * Automatische Preise (ADR 0022) tragen ein Kennzeichen, solange sie dem geladenen Stand entsprechen;
 * ob das Kennzeichen nach einer Änderung bleibt, entscheidet erst das Backend beim Speichern. Viele
 * hintereinander sind zusammengeklappt, außer eine von ihnen hat einen Fehler.
 * <p>
 * Aus der Vorschau kommen die Etiketten „aktuell“, „angekündigt“ und „nach Vertragsende“ (an der Zeile
 * mit demselben Datum, bei eingeklappter Gruppe an der Gruppe) und die Stufen, die erst das Speichern
 * anlegt ({@code neu}): ein Hinweis an der Stelle, an der danach ihre Gruppe steht, die aktuelle von
 * ihnen darunter als Zeile, die sich nicht ändern lässt. Sie gehören nicht zu den Zeilen des Formulars.
 */
@Component({
  selector: 'app-vertrag-preisliste',
  imports: [NgTemplateOutlet, ReactiveFormsModule],
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
  /** Die Werte der Zeilen, damit Kennzeichen und Gruppen den Eingaben folgen. */
  readonly werte = input.required<PreisWerte[]>();
  /** Die automatischen Preise des gespeicherten Stands, siehe {@link preisSchluessel}. */
  readonly geladen = input<ReadonlySet<string>>(new Set());
  readonly waehrung = input.required<string>();
  /** Die Preise der Vorschau, samt der Stufen, die erst das Speichern anlegt. */
  readonly vorschau = input<VertragVorschauPreisAntwort[]>([]);
  readonly fehler = input.required<ReadonlyMap<VertragFeld, string>>();
  readonly idPrefix = input.required<string>();

  readonly betragGeaendert = output<string>();
  readonly hinzufuegen = output();
  readonly entfernen = output<number>();
  readonly geaendert = output<{ index: number; feld: PreisEingabeFeld }>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly automatischText = AUTOMATISCH_TEXT;

  protected readonly beginnText = computed(() => datumText(this.beginn()));

  protected readonly abschnitte = computed<Abschnitt<PreisWerte>[]>(() =>
    gruppieren(this.werte(), (zeile) => zeile.automatisch),
  );

  /**
   * Die gespeicherten bzw. eingetragenen Preise der Vorschau nach Datum, für ihre Etiketten. Wie zuvor
   * der Preisverlauf erst ab zwei Preisen: Ein einzelner ist immer der aktuelle.
   */
  private readonly vorschauNachDatum = computed(() => {
    const preise = this.vorschau();
    const nachDatum = new Map<string, VertragVorschauPreisAntwort>();
    if (preise.length > 1) {
      preise
        .filter((preis) => !preis.neu && !nachDatum.has(preis.gueltigAb))
        .forEach((preis) => nachDatum.set(preis.gueltigAb, preis));
    }
    return nachDatum;
  });

  /** Die Stufen, die erst das Speichern anlegt. */
  protected readonly neueStufen = computed(() => this.vorschau().filter(({ neu }) => neu));

  protected readonly neuHinweis = computed(() => {
    const stufen = this.neueStufen();
    return stufen.length
      ? neuHinweisText(stufen.length, stufen[0].gueltigAb, stufen.at(-1)!.gueltigAb)
      : null;
  });

  /** Die aktuelle unter den neuen Stufen, als Zeile unter dem Hinweis. */
  protected readonly neuAktuell = computed(() => {
    const preis = this.neueStufen().find(({ art }) => art === 'AKTUELL');
    return preis
      ? { gueltigAb: datumText(preis.gueltigAb), betrag: betragEingabe(preis.betrag) }
      : null;
  });

  /**
   * Vor welchem Abschnitt der Hinweis steht: vor dem ersten, der nach der ersten neuen Stufe beginnt
   * (oder noch kein Datum hat), sonst am Ende. -1 ohne neue Stufen.
   */
  protected readonly neuStelle = computed(() => {
    const erste = this.neueStufen()[0]?.gueltigAb;
    if (!erste) {
      return -1;
    }
    const abschnitte = this.abschnitte();
    const stelle = abschnitte.findIndex((abschnitt) => {
      const ab =
        abschnitt.art === 'einzeln'
          ? abschnitt.eintrag.gueltigAb
          : abschnitt.eintraege[0].eintrag.gueltigAb;
      return !ab || ab > erste;
    });
    return stelle === -1 ? abschnitte.length : stelle;
  });

  /** Etikett aus der Vorschau für den Preis ab diesem Datum, z. B. „aktuell“, mit Klasse für die Farbe. */
  protected etikett(gueltigAb: string | undefined): { text: string; klasse: string } | null {
    const preis = gueltigAb ? this.vorschauNachDatum().get(gueltigAb) : undefined;
    const text = preis && PREISZEILE_ETIKETT[preis.art];
    return text ? { text, klasse: ETIKETT_KLASSE[preis.art] } : null;
  }

  /** Schlüssel (erster Index) der aufgeklappten Gruppen. */
  private readonly aufgeklappt = signal<ReadonlySet<number>>(new Set());

  protected erstId(feld: PreisEingabeFeld | 'fehler' | 'hinweis'): string {
    return `${this.idPrefix()}-preise-erster-${feld}`;
  }

  /** Fehler am Betrag zeigt auch die erste Zeile; gezählt wird er im Tab Kosten. */
  protected readonly ersterFehler = computed(() => this.fehler().get('betrag') ?? null);

  protected betragEingabe(event: Event): void {
    this.betragGeaendert.emit((event.target as HTMLInputElement).value);
  }

  protected id(index: number, feld: PreisEingabeFeld | 'hinweis'): string {
    return `${this.idPrefix()}-preise-${index}-${feld}`;
  }

  protected fehlerText(index: number, feld: PreisEingabeFeld): string | null {
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

  /** Automatisch und so wie geladen: nur dann steht das Kennzeichen. */
  protected unveraendertAutomatisch(index: number): boolean {
    const zeile = this.werte()[index];
    return !!zeile?.automatisch && this.geladen().has(preisSchluessel(zeile));
  }

  /** Eine geänderte automatische Stufe, nach der weitere automatische kommen. */
  protected spaetereBleiben(index: number): boolean {
    const werte = this.werte();
    return (
      !!werte[index]?.automatisch &&
      !this.unveraendertAutomatisch(index) &&
      werte.slice(index + 1).some((zeile) => zeile.automatisch)
    );
  }

  /** Für {@code aria-describedby}: Fehler und Hinweis der Zeile. */
  protected beschreibung(index: number): string | null {
    const ids = [
      this.zeilenFehler(index) ? `${this.id(index, 'gueltigAb')}-fehler` : null,
      this.spaetereBleiben(index) ? this.id(index, 'hinweis') : null,
    ].filter(Boolean);
    return ids.join(' ') || null;
  }

  /** Eine Zeile behält ihr Element, solange es ihr FormGroup gibt (Fokus beim Entfernen anderer). */
  protected spur(abschnitt: Abschnitt<PreisWerte>): unknown {
    return abschnitt.art === 'einzeln'
      ? this.zeilen().at(abschnitt.index)
      : `gruppe-${abschnitt.schluessel}`;
  }

  protected offen(abschnitt: { schluessel: number; eintraege: MitIndex<PreisWerte>[] }): boolean {
    return (
      this.aufgeklappt().has(abschnitt.schluessel) ||
      abschnitt.eintraege.some(({ index }) => !!this.zeilenFehler(index))
    );
  }

  protected umschalten(schluessel: number): void {
    this.aufgeklappt.update((offen) => {
      const neu = new Set(offen);
      if (!neu.delete(schluessel)) {
        neu.add(schluessel);
      }
      return neu;
    });
  }

  /** Eingeklappt mit dem Etikett eines ihrer Preise: „5 automatische Preise, 2022–2026 · aktuell 165,61 €“. */
  protected gruppenText(abschnitt: {
    schluessel: number;
    eintraege: MitIndex<PreisWerte>[];
  }): string {
    const { eintraege } = abschnitt;
    const text = gruppenText(
      eintraege.length,
      eintraege[0].eintrag.gueltigAb,
      eintraege.at(-1)!.eintrag.gueltigAb,
    );
    if (this.offen(abschnitt)) {
      return text;
    }
    const zusaetze = eintraege.flatMap(({ eintrag }) => {
      const preis = this.vorschauNachDatum().get(eintrag.gueltigAb);
      const etikett = preis && PREISZEILE_ETIKETT[preis.art];
      return etikett ? [`${etikett} ${betragText(preis.betrag, this.locale)}`] : [];
    });
    return [text, ...zusaetze].join(' · ');
  }
}
