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
  untracked,
  viewChild,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VertragAntwort } from '../../../core/api/api';
import { betragText } from '../../../shared/format/betrag.pipe';
import { datumText } from '../../../shared/format/datum.pipe';
import { HinweisBox } from '../../../shared/hinweis-box/hinweis-box';
import { Tabliste } from '../../../shared/tabliste/tabliste';
import { VertraegeSeite } from '../vertraege-seite';
import {
  fristDauerText,
  kategorieText,
  kuendigungAnzeige,
  kuendigungText,
  STATUS_TEXT,
  VERLAENGERUNG_TEXT,
  vertragName,
  ZAHLUNGSWEG_TEXT,
  ZAHLWEISE_TEXT,
} from '../vertrag-texte';
import { KEINE_ABBUCHUNG } from '../vertrag-zeile/vertrag-zeile';

const NICHT_HINTERLEGT = 'Nicht hinterlegt';

/** „Preise“ kommt mit den Preisänderungen dazu. */
const TABS = [
  { key: 'allgemein', label: 'Allgemein' },
  { key: 'kosten', label: 'Kosten' },
  { key: 'laufzeit', label: 'Laufzeit' },
] as const;

type Tab = (typeof TABS)[number]['key'];

interface Eintrag {
  label: string;
  wert: string;
  /** Längerer Freitext: volle Breite, Zeilenumbrüche bleiben. */
  breit?: boolean;
}

/**
 * Details eines Vertrags (Route {@code :id}, Tab in {@code ?tab=}): am Desktop ein Panel neben der
 * Liste, bis 900 px Vollbild über der Liste. Die Daten kommen aus der Liste der {@link VertraegeSeite};
 * Bearbeiten öffnet sich als Kind-Route darüber.
 */
@Component({
  selector: 'app-vertrag-details',
  imports: [HinweisBox, RouterOutlet, Tabliste],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-details.html',
  styleUrl: './vertrag-details.scss',
})
export class VertragDetails {
  private readonly locale = inject(LOCALE_ID);
  private readonly injector = inject(Injector);
  protected readonly seite = inject(VertraegeSeite);

  /** Aus der Route. */
  readonly id = input.required<string>();
  /** Aus {@code ?tab=}; Unbekanntes zeigt „Allgemein“. */
  readonly tab = input<string | undefined>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  readonly vertrag = computed(
    () => this.seite.daten()?.vertraege.find(({ id }) => id === this.id()) ?? null,
  );

  protected readonly tabs = TABS;
  protected readonly aktiverTab = computed<Tab>(
    () => TABS.find(({ key }) => key === this.tab())?.key ?? 'allgemein',
  );

  protected readonly name = computed(() => {
    const vertrag = this.vertrag();
    return vertrag ? vertragName(vertrag) : '';
  });
  protected readonly meldung = computed(() => this.seite.meldungZu(this.id()));

  protected readonly kacheln = computed(() => {
    const v = this.vertrag();
    if (!v) {
      return [];
    }
    const { kostenProMonat, naechsteAbbuchung, kuendigung } = v.berechnet;
    const anzeige = kuendigungAnzeige(kuendigung);
    return [
      { label: 'Pro Monat', wert: betragText(kostenProMonat, this.locale), zusatz: '', ton: '' },
      {
        label: 'Nächste Abbuchung',
        wert: naechsteAbbuchung ? datumText(naechsteAbbuchung) : KEINE_ABBUCHUNG,
        zusatz: '',
        ton: '',
      },
      { label: 'Kündigung', wert: anzeige.text, zusatz: anzeige.zusatz, ton: anzeige.ton },
    ];
  });

  protected readonly eintraege = computed<Eintrag[]>(() => {
    const v = this.vertrag();
    if (!v) {
      return [];
    }
    switch (this.aktiverTab()) {
      case 'allgemein':
        return this.allgemein(v);
      case 'kosten':
        return this.kosten(v);
      case 'laufzeit':
        return this.laufzeit(v);
    }
  });

  constructor() {
    // Ein Link auf einen Vertrag, den es nicht (mehr) gibt.
    effect(() => {
      if (
        this.seite.daten() &&
        !this.seite.fehler() &&
        !this.vertrag() &&
        !this.seite.schliesst()
      ) {
        untracked(() => this.seite.nichtGefunden());
      }
    });

    // Beim Öffnen und beim Wechsel zu einem anderen Vertrag in die Details.
    effect(() => {
      this.id();
      if (this.vertrag()) {
        untracked(() =>
          afterNextRender(() => this.panel()?.nativeElement.focus({ preventScroll: true }), {
            injector: this.injector,
          }),
        );
      }
    });
  }

  protected schliessen(): void {
    this.seite.schliessen(['/vertraege']);
  }

  protected bearbeiten(): void {
    this.seite.bearbeiten(this.id());
  }

  protected loeschen(): void {
    const vertrag = this.vertrag();
    if (vertrag) {
      this.seite.loeschenFragen(vertrag);
    }
  }

  protected tabWaehlen(tab: string): void {
    this.seite.tabWaehlen(tab === 'allgemein' ? null : tab);
  }

  private allgemein(v: VertragAntwort): Eintrag[] {
    return [
      { label: 'Anbieter', wert: v.anbieter },
      v.bezeichnung && { label: 'Bezeichnung', wert: v.bezeichnung },
      { label: 'Kategorie', wert: kategorieText(v.kategorie) },
      { label: 'Vertrags- oder Kundennummer', wert: v.vertragsnummer || NICHT_HINTERLEGT },
      v.notiz && { label: 'Notiz', wert: v.notiz, breit: true },
    ].filter((eintrag) => !!eintrag);
  }

  private kosten(v: VertragAntwort): Eintrag[] {
    const { kostenProMonat, kostenProJahr, naechsteAbbuchung } = v.berechnet;
    return [
      {
        label: 'Betrag',
        wert: `${betragText(v.betrag, this.locale)} ${ZAHLWEISE_TEXT[v.zahlweise]}`,
      },
      { label: 'Pro Monat', wert: betragText(kostenProMonat, this.locale) },
      { label: 'Pro Jahr', wert: betragText(kostenProJahr, this.locale) },
      {
        label: 'Zahlungsweg',
        wert: v.zahlungsweg ? ZAHLUNGSWEG_TEXT[v.zahlungsweg] : NICHT_HINTERLEGT,
      },
      {
        label: 'Nächste Abbuchung',
        wert: naechsteAbbuchung ? datumText(naechsteAbbuchung) : KEINE_ABBUCHUNG,
      },
    ];
  }

  private laufzeit(v: VertragAntwort): Eintrag[] {
    return [
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
      { label: 'Kündigung', wert: kuendigungText(v.berechnet.kuendigung) },
      { label: 'Status', wert: STATUS_TEXT[v.berechnet.status] },
    ].filter((eintrag) => !!eintrag);
  }
}
