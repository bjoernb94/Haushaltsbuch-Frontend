import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { VertragAntwort } from '../../../core/api/api';
import { BetragPipe, betragText } from '../../../shared/format/betrag.pipe';
import { datumText } from '../../../shared/format/datum.pipe';
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

/** Eine Zeile der Vertragsliste mit aufklappbaren Details; alle Werte kommen vom Backend. */
@Component({
  selector: 'app-vertrag-zeile',
  imports: [BetragPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-zeile.html',
  styleUrl: './vertrag-zeile.scss',
})
export class VertragZeile {
  private readonly locale = inject(LOCALE_ID);

  readonly vertrag = input.required<VertragAntwort>();
  readonly offen = input(false);
  readonly umschalten = output();

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
