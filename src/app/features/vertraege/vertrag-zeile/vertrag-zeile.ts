import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  LOCALE_ID,
  output,
  viewChild,
} from '@angular/core';
import { Observable } from 'rxjs';
import { VertragAntwort, VertragKategorieAntwort } from '../../../core/api/api';
import { UngespeicherteEingaben } from '../../../core/ungespeichert/ungespeicherte-eingaben';
import { HinweisBox } from '../../../shared/hinweis-box/hinweis-box';
import { inDenBlick } from '../../../shared/in-den-blick/in-den-blick';
import { BetragPipe, betragText } from '../../../shared/format/betrag.pipe';
import { datumText } from '../../../shared/format/datum.pipe';
import { VertragBearbeiten } from '../vertrag-bearbeiten/vertrag-bearbeiten';
import {
  fristDauerText,
  kategorieText,
  kuendigungAnzeige,
  STATUS_TEXT,
  VERLAENGERUNG_TEXT,
  vertragName,
  ZAHLUNGSWEG_TEXT,
  ZAHLWEISE_TEXT,
} from '../vertrag-texte';

const NICHT_HINTERLEGT = 'Nicht hinterlegt';
const KEINE_ABBUCHUNG = 'Keine weiteren Abbuchungen';

export interface ZeilenMeldung {
  text: string;
  art: 'info' | 'fehler';
  /** Betrifft nicht diese Zeile, sondern den gelöschten Vertrag daneben: mit Trenner abgesetzt. */
  abgesetzt?: boolean;
  /** Unter statt über der Zeile, wenn der gelöschte Vertrag der letzte war. */
  unten?: boolean;
}

/** Eine Zeile der Vertragsliste mit aufklappbaren Details und Formular; Werte kommen vom Backend. */
@Component({
  selector: 'app-vertrag-zeile',
  imports: [BetragPipe, HinweisBox, VertragBearbeiten],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-zeile.html',
  styleUrl: './vertrag-zeile.scss',
})
export class VertragZeile {
  private readonly locale = inject(LOCALE_ID);

  readonly vertrag = input.required<VertragAntwort>();
  readonly ansicht = input<'details' | 'bearbeiten' | null>(null);
  readonly meldung = input<ZeilenMeldung | null>(null);
  readonly kategorien = input.required<Observable<VertragKategorieAntwort[]>>();
  /** Die Anfrage zum Löschen läuft. */
  readonly loescht = input(false);

  readonly umschalten = output<'details' | 'bearbeiten'>();
  readonly loeschen = output();
  readonly abgebrochen = output();
  readonly gespeichert = output<VertragAntwort>();
  readonly konflikt = output();
  readonly nichtGefunden = output();

  private readonly ungespeichert = inject(UngespeicherteEingaben);
  private readonly injector = inject(Injector);
  private readonly bearbeitenKnopf = viewChild.required<ElementRef<HTMLElement>>('bearbeitenKnopf');
  private readonly zeile = viewChild.required<ElementRef<HTMLElement>>('zeile');

  constructor() {
    // Nach dem Rendern, denn erst dann ist z. B. eine offene Zeile weiter oben zugeklappt. Das
    // Formular meldet sich selbst, weil es erst nach den Kategorien dasteht.
    effect(() => {
      if (this.ansicht() === 'details') {
        afterNextRender(() => this.zeigen(), { injector: this.injector });
      }
    });
  }

  protected zeigen(): void {
    inDenBlick(this.zeile().nativeElement);
  }

  protected async abbrechen(): Promise<void> {
    if (await this.ungespeichert.bestaetigen()) {
      this.abgebrochen.emit();
      this.bearbeitenKnopf().nativeElement.focus();
    }
  }

  protected readonly name = computed(() => vertragName(this.vertrag()));
  protected readonly offen = computed(() => this.ansicht() === 'details');
  protected readonly bearbeitet = computed(() => this.ansicht() === 'bearbeiten');
  protected readonly beendet = computed(() => this.vertrag().berechnet.status === 'BEENDET');
  protected readonly kuendigung = computed(() =>
    kuendigungAnzeige(this.vertrag().berechnet.kuendigung),
  );

  protected readonly meta = computed(() => {
    const v = this.vertrag();
    return [
      v.bezeichnung ? v.anbieter : '',
      kategorieText(v.kategorie),
      v.vertragsnummer ? `Nr. ${v.vertragsnummer}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });

  /** „jährlich · 48,90 €/Monat“; bei monatlicher Zahlung ohne Umrechnung. */
  protected readonly zahlweise = computed(() => {
    const { zahlweise, berechnet } = this.vertrag();
    const text = ZAHLWEISE_TEXT[zahlweise];
    return zahlweise === 'MONATLICH'
      ? text
      : `${text} · ${betragText(berechnet.kostenProMonat, this.locale)}/Monat`;
  });

  protected readonly abbuchung = computed(() => {
    const { naechsteAbbuchung } = this.vertrag().berechnet;
    return naechsteAbbuchung
      ? `Nächste Abbuchung ${datumText(naechsteAbbuchung)}`
      : KEINE_ABBUCHUNG;
  });

  protected readonly details = computed(() => {
    const v = this.vertrag();
    const { kostenProMonat, kostenProJahr, naechsteAbbuchung, status } = v.berechnet;
    const { text, zusatz } = this.kuendigung();
    const betrag = (wert: typeof kostenProMonat) => betragText(wert, this.locale);
    return [
      { label: 'Anbieter', wert: v.anbieter },
      v.bezeichnung && { label: 'Bezeichnung', wert: v.bezeichnung },
      { label: 'Kategorie', wert: kategorieText(v.kategorie) },
      { label: 'Vertrags- oder Kundennummer', wert: v.vertragsnummer || NICHT_HINTERLEGT },
      { label: 'Betrag', wert: `${betrag(v.betrag)} ${ZAHLWEISE_TEXT[v.zahlweise]}` },
      { label: 'Pro Monat', wert: betrag(kostenProMonat) },
      { label: 'Pro Jahr', wert: betrag(kostenProJahr) },
      {
        label: 'Nächste Abbuchung',
        wert: naechsteAbbuchung ? datumText(naechsteAbbuchung) : KEINE_ABBUCHUNG,
      },
      {
        label: 'Zahlungsweg',
        wert: v.zahlungsweg ? ZAHLUNGSWEG_TEXT[v.zahlungsweg] : NICHT_HINTERLEGT,
      },
      { label: 'Vertragsbeginn', wert: datumText(v.beginn) || NICHT_HINTERLEGT },
      (v.kuendbar || v.laufzeitende) && {
        label: 'Laufzeitende',
        wert: datumText(v.laufzeitende) || 'Keine Mindestlaufzeit',
      },
      v.kuendbar && {
        label: 'Verlängerung',
        wert: v.verlaengerung ? VERLAENGERUNG_TEXT[v.verlaengerung] : NICHT_HINTERLEGT,
      },
      v.kuendbar && {
        label: 'Kündigungsfrist',
        wert: fristDauerText(v.kuendigungsfristMonate) ?? NICHT_HINTERLEGT,
      },
      { label: 'Kündigung', wert: zusatz ? `${text} (${zusatz})` : text },
      { label: 'Status', wert: STATUS_TEXT[status] },
    ].filter((eintrag) => !!eintrag);
  });
}
