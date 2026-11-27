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
import { InfoKnopf } from '../../../shared/info-knopf/info-knopf';
import { Tabliste } from '../../../shared/tabliste/tabliste';
import { VertragEinmalkosten } from './vertrag-einmalkosten/vertrag-einmalkosten';
import { VertragPreise } from './vertrag-preise/vertrag-preise';
import { VertragUnterbrechungen } from './vertrag-unterbrechungen/vertrag-unterbrechungen';
import { WiederaufnahmeLeiste } from './wiederaufnahme-leiste/wiederaufnahme-leiste';
import { VertraegeSeite } from '../liste/vertraege-seite';
import { VertragNavigation } from '../liste/vertrag-navigation';
import {
  endeText,
  ERRECHNET_TEXT,
  fristDauerText,
  INFO_RUNDUNG_DETAILS,
  kategorieText,
  kuendigungAnzeige,
  kuendigungText,
  PREISAENDERUNG_ART_TEXT,
  prozentText,
  STATUS_TEXT,
  steigerungText,
  VERLAENGERUNG_TEXT,
  vertragName,
  ZAHLUNGSWEG_TEXT,
  ZAHLWEISE_TEXT,
} from '../vertrag-texte';

const NICHT_HINTERLEGT = 'Nicht hinterlegt';

/**
 * Kachel „Laufzeit“: „seit …“ bzw. „ab …“ (noch nicht begonnen oder unterbrochen), nach einer
 * Wiederaufnahme „wieder seit …“, jeweils ab {@code aktuellerBeginn}; darunter die Mindestlaufzeit
 * (ohne Verlängerung das Ende). Beendete zeigen „Beginn – Ende“, stornierte nur das; beide ohne
 * Zusatz, nicht kündbare auch.
 */
function laufzeitKachel(v: VertragAntwort): { wert: string; zusatz: string } {
  const { status, vertragsende, aktuellerBeginn } = v.berechnet;
  switch (status) {
    case 'BEENDET':
      return { wert: `${datumText(v.beginn)} – ${datumText(vertragsende)}`, zusatz: '' };
    case 'STORNIERT':
      return { wert: 'Storniert', zusatz: '' };
  }
  const praefix =
    status === 'NICHT_BEGONNEN' || status === 'UNTERBROCHEN'
      ? 'ab'
      : aktuellerBeginn > v.beginn
        ? 'wieder seit'
        : 'seit';
  const wert = `${praefix} ${datumText(aktuellerBeginn)}`;
  if (!v.kuendbar) {
    return { wert, zusatz: '' };
  }
  if (!v.laufzeitende) {
    return { wert, zusatz: 'Keine Mindestlaufzeit' };
  }
  const ende = datumText(v.laufzeitende);
  return {
    wert,
    zusatz: v.verlaengerung === 'KEINE' ? `Endet am ${ende}` : `Mindestlaufzeit bis ${ende}`,
  };
}

const TABS = [
  { key: 'allgemein', label: 'Allgemein' },
  { key: 'kosten', label: 'Kosten' },
  { key: 'preise', label: 'Preisverlauf' },
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
 * Bearbeiten und Wieder aufnehmen öffnen sich als Kind-Route darüber.
 */
@Component({
  selector: 'app-vertrag-details',
  imports: [
    HinweisBox,
    RouterOutlet,
    InfoKnopf,
    Tabliste,
    VertragEinmalkosten,
    VertragPreise,
    VertragUnterbrechungen,
    WiederaufnahmeLeiste,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-details.html',
  styleUrl: './vertrag-details.scss',
})
export class VertragDetails {
  private readonly locale = inject(LOCALE_ID);
  private readonly injector = inject(Injector);
  protected readonly seite = inject(VertraegeSeite);
  private readonly navigation = inject(VertragNavigation);

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

  /** „Gekündigt zum …“ bzw. „Beendet am …“, nur wenn das Backend die Wiederaufnahme anbietet. */
  protected readonly ende = computed(() => {
    const v = this.vertrag();
    return v?.berechnet.wiederaufnahme ? endeText(v.berechnet) : null;
  });

  protected readonly kacheln = computed(() => {
    const v = this.vertrag();
    if (!v) {
      return [];
    }
    const { kostenProMonat, kuendigung, naechstePreisaenderung, eigenerAnteil } = v.berechnet;
    const anzeige = kuendigungAnzeige(kuendigung);
    return [
      {
        label: 'Pro Monat',
        wert: betragText(kostenProMonat, this.locale),
        zusatz:
          eigenerAnteil && v.anteilProzent !== null
            ? `Dein Anteil ${betragText(eigenerAnteil.kostenProMonat, this.locale)} (${prozentText(v.anteilProzent, this.locale)} %)`
            : '',
        ton: '',
        // „Pro Monat“ steht in jedem Tab; der Satz gilt auch für den Tab Kosten.
        info: [INFO_RUNDUNG_DETAILS],
      },
      { label: 'Laufzeit', ...laufzeitKachel(v), ton: '', info: [] },
      {
        label: 'Kündigung',
        wert: anzeige.text,
        zusatz: anzeige.zusatz,
        ton: anzeige.ton,
        info: [],
      },
      naechstePreisaenderung
        ? {
            label: 'Nächste Preisänderung',
            wert: `ab ${datumText(naechstePreisaenderung.ab)}`,
            zusatz: `${betragText(naechstePreisaenderung.betrag, this.locale)} · ${PREISAENDERUNG_ART_TEXT[naechstePreisaenderung.art]}`,
            ton: 'warnung',
            info: [],
          }
        : { label: 'Nächste Preisänderung', wert: 'Keine bekannt', zusatz: '', ton: '', info: [] },
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
      case 'preise':
        return this.preise(v);
    }
  });

  constructor() {
    // Ein Link auf einen Vertrag, den es nicht (mehr) gibt.
    effect(() => {
      if (
        this.seite.daten() &&
        !this.seite.fehler() &&
        !this.vertrag() &&
        !this.navigation.schliesst()
      ) {
        untracked(() => this.seite.nichtGefunden());
      }
    });

    // Beim Öffnen und beim Wechsel zu einem anderen Vertrag in die Details; liegt ein Sheet darüber
    // (z. B. ein geteilter Link), behält es den Fokus.
    effect(() => {
      this.id();
      if (this.vertrag() && !untracked(this.navigation.ansicht)?.sheet) {
        untracked(() =>
          afterNextRender(() => this.panel()?.nativeElement.focus({ preventScroll: true }), {
            injector: this.injector,
          }),
        );
      }
    });
  }

  protected schliessen(): void {
    this.navigation.schliessen(['/vertraege']);
  }

  protected bearbeiten(): void {
    this.navigation.bearbeiten(this.id());
  }

  protected wiederaufnehmen(): void {
    this.navigation.wiederaufnehmen(this.id());
  }

  protected preisHinzufuegen(): void {
    this.navigation.bearbeiten(this.id(), true);
  }

  protected loeschen(): void {
    const vertrag = this.vertrag();
    if (vertrag) {
      this.seite.loeschenFragen(vertrag);
    }
  }

  protected tabWaehlen(tab: string): void {
    this.navigation.tabWaehlen(tab === 'allgemein' ? null : tab);
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
    const { kostenProMonat, kostenImJahr, kostenImJahrMitPrognose, jahr, eigenerAnteil } =
      v.berechnet;
    return [
      {
        label: 'Aktueller Betrag',
        wert:
          `${betragText(v.betrag, this.locale)} ${ZAHLWEISE_TEXT[v.zahlweise]}` +
          (v.betragErrechnet ? ` · ${ERRECHNET_TEXT}` : ''),
      },
      { label: 'Pro Monat', wert: betragText(kostenProMonat, this.locale) },
      {
        label: `Kosten ${jahr}`,
        wert:
          betragText(kostenImJahr, this.locale) +
          (kostenImJahrMitPrognose ? ' inkl. Prognose' : ''),
      },
      eigenerAnteil &&
        v.anteilProzent !== null && {
          label: 'Dein Anteil',
          wert: `${prozentText(v.anteilProzent, this.locale)} % = ${betragText(eigenerAnteil.kostenProMonat, this.locale)} pro Monat`,
        },
      {
        label: 'Zahlungsweg',
        wert: v.zahlungsweg ? ZAHLUNGSWEG_TEXT[v.zahlungsweg] : NICHT_HINTERLEGT,
      },
    ].filter((eintrag) => !!eintrag);
  }

  /**
   * Unter dem Preisverlauf. Die Erinnerung wie im Design nur bei kündbaren Verträgen mit Regel oder
   * angekündigtem Preis.
   */
  private preise(v: VertragAntwort): Eintrag[] {
    const erinnerung =
      v.kuendbar && (!!v.preissteigerung || v.preise.some(({ art }) => art === 'ANGEKUENDIGT'));
    return [
      { label: 'Preisgarantie bis', wert: datumText(v.preisgarantieBis) || 'Keine' },
      {
        label: 'Regelmäßige Erhöhung',
        wert: v.preissteigerung ? steigerungText(v.preissteigerung, this.locale) : 'Nein',
      },
      erinnerung && {
        label: 'Erinnerung Sonderkündigungsrecht',
        wert: v.erinnerungSonderkuendigung ? 'An' : 'Aus',
      },
    ].filter((eintrag) => !!eintrag);
  }

  private laufzeit(v: VertragAntwort): Eintrag[] {
    return [
      { label: 'Vertragsbeginn', wert: datumText(v.beginn) },
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
