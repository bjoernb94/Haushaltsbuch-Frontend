import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  LOCALE_ID,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { VertragAntwort } from '../../../core/api/api';
import { BetragPipe, betragText } from '../../../shared/format/betrag.pipe';
import { datumText } from '../../../shared/format/datum.pipe';
import { HinweisBox } from '../../../shared/hinweis-box/hinweis-box';
import { kategorieText, kuendigungAnzeige, vertragName, ZAHLWEISE_TEXT } from '../vertrag-texte';

export const KEINE_ABBUCHUNG = 'Keine weiteren Abbuchungen';

export interface ZeilenMeldung {
  text: string;
  art: 'info' | 'fehler';
  /** Betrifft nicht diese Zeile, sondern den gelöschten Vertrag daneben: mit Trenner abgesetzt. */
  abgesetzt?: boolean;
  /** Unter statt über der Zeile, wenn der gelöschte Vertrag der letzte war. */
  unten?: boolean;
}

/** Ab hier gibt es „…“ und Rechtsklick; darunter öffnet ein Tippen die Details mit allen Aktionen. */
const DESKTOP = '(min-width: 901px)';

let letzteZeile = 0;

/**
 * Eine Zeile der Vertragsliste; Werte kommen vom Backend. Ein Klick auf die Zeile öffnet die Details.
 * Am Desktop gibt es dazu ein Kontextmenü über „…“ oder Rechtsklick.
 */
@Component({
  selector: 'app-vertrag-zeile',
  imports: [BetragPipe, HinweisBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-zeile.html',
  styleUrl: './vertrag-zeile.scss',
})
export class VertragZeile {
  private readonly locale = inject(LOCALE_ID);
  private readonly injector = inject(Injector);

  readonly vertrag = input.required<VertragAntwort>();
  /** Die Details dieses Vertrags sind offen. */
  readonly offen = input(false);
  readonly meldung = input<ZeilenMeldung | null>(null);
  /** Die Anfrage zum Löschen läuft. */
  readonly loescht = input(false);

  readonly details = output();
  readonly bearbeiten = output();
  readonly loeschen = output();

  protected readonly menueId = `zeilenmenue-${++letzteZeile}`;
  protected readonly menueOffen = signal(false);

  private readonly menue = viewChild<ElementRef<HTMLElement>>('menue');
  private readonly mehrKnopf = viewChild.required<ElementRef<HTMLButtonElement>>('mehrKnopf');

  protected readonly name = computed(() => vertragName(this.vertrag()));
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

  protected menueUmschalten(): void {
    if (this.menueOffen()) {
      this.menueSchliessen();
    } else {
      this.menueOeffnen();
    }
  }

  /** Rechtsklick wie „…“; bis 900 px bleibt das Menü des Browsers. */
  protected kontextmenue(event: MouseEvent): void {
    if (!matchMedia(DESKTOP).matches) {
      return;
    }
    event.preventDefault();
    this.menueOeffnen();
  }

  protected menueSchliessen(fokus = true): void {
    this.menueOffen.set(false);
    if (fokus) {
      this.mehrKnopf().nativeElement.focus();
    }
  }

  protected waehlen(aktion: 'details' | 'bearbeiten' | 'loeschen'): void {
    this.menueSchliessen();
    this[aktion].emit();
  }

  /** Pfeiltasten, Pos1 und Ende wandern durch die Einträge, Esc schließt, Tab verlässt das Menü. */
  protected menueTaste(event: KeyboardEvent): void {
    const eintraege = [
      ...(this.menue()?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
    ];
    const aktuell = eintraege.indexOf(document.activeElement as HTMLElement);
    const ziel: Record<string, number> = {
      ArrowDown: (aktuell + 1) % eintraege.length,
      ArrowUp: (aktuell - 1 + eintraege.length) % eintraege.length,
      Home: 0,
      End: eintraege.length - 1,
    };
    if (event.key in ziel) {
      event.preventDefault();
      eintraege[ziel[event.key]]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.menueSchliessen();
    } else if (event.key === 'Tab') {
      this.menueSchliessen(false);
    }
  }

  private menueOeffnen(): void {
    this.menueOffen.set(true);
    afterNextRender(
      () => this.menue()?.nativeElement.querySelector<HTMLElement>('[role="menuitem"]')?.focus(),
      { injector: this.injector },
    );
  }
}
