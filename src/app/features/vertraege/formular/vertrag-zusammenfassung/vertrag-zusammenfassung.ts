import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Betrag, VertragKategorieAntwort, VertragVorschauAntwort } from '../../../../core/api/api';
import { betragText } from '../../../../shared/format/betrag.pipe';
import { datumText } from '../../../../shared/format/datum.pipe';
import { Rundungshinweis } from '../../../../shared/rundungshinweis/rundungshinweis';
import {
  kategorieText,
  kuendigungText,
  PREISAENDERUNG_ART_TEXT,
  ZAHLWEISE_TEXT,
} from '../../vertrag-texte';
import { VertragWerte } from '../vertrag-pruefung';

export interface Uebersicht {
  name: string;
  /** „Anbieter · Kategorie“ */
  unter: string;
  zeilen: { label: string; wert: string }[];
}

const NOCH_OFFEN = 'Noch offen';

/**
 * Berechnete Werte aus der Vorschau des Backends, die SPA formatiert nur (ADR 0010). Scheitert die
 * Vorschau, sind sie „Noch offen“; der Vertragsbeginn ist eine Eingabe und bleibt stehen.
 * {@code null} trotz ausgefüllter Einmalkosten heißt: noch keine vollständige Zeile.
 */
export function uebersichtAus(
  w: VertragWerte,
  v: VertragVorschauAntwort | null,
  kategorien: VertragKategorieAntwort[],
  locale: string,
): Uebersicht {
  const anbieter = w.anbieter.trim();
  const bezeichnung = w.bezeichnung.trim();
  const kategorie = kategorien.find(({ id }) => id === w.kategorieId);
  const text = (betrag: Betrag) => betragText(betrag, locale);
  const zahlweise = w.zahlweise ? ` ${ZAHLWEISE_TEXT[w.zahlweise]}` : '';

  const proMonat = v?.kostenProMonat
    ? text(v.kostenProMonat) +
      (v.eigenerAnteil?.kostenProMonat
        ? `, dein Anteil ${text(v.eigenerAnteil.kostenProMonat)}`
        : '')
    : NOCH_OFFEN;
  const kuendigung = w.nichtKuendbar
    ? 'Nicht kündbar'
    : v
      ? kuendigungText(v.kuendigung)
      : NOCH_OFFEN;
  const aenderung = v?.naechstePreisaenderung;
  const preis = !v
    ? NOCH_OFFEN
    : aenderung
      ? `ab ${datumText(aenderung.ab)}: ${text(aenderung.betrag)} (${PREISAENDERUNG_ART_TEXT[aenderung.art]})`
      : 'Keine bekannt';
  const einmalkosten = v?.einmalkosten
    ? text(v.einmalkosten)
    : w.einmalkosten.length
      ? NOCH_OFFEN
      : 'Keine';
  return {
    name: bezeichnung || anbieter || 'Neuer Vertrag',
    unter:
      [bezeichnung ? anbieter : '', kategorie ? kategorieText(kategorie) : '']
        .filter(Boolean)
        .join(' · ') || 'Noch keine Angaben',
    zeilen: [
      { label: 'Betrag', wert: v?.betrag ? text(v.betrag) + zahlweise : NOCH_OFFEN },
      { label: 'Pro Monat', wert: proMonat },
      { label: 'Vertragsbeginn', wert: datumText(w.beginn) || NOCH_OFFEN },
      { label: 'Kündigung', wert: kuendigung },
      { label: 'Nächste Preisänderung', wert: preis },
      { label: 'Einmalkosten', wert: einmalkosten },
    ],
  };
}

let letzte = 0;

/**
 * Zusammenfassung neben dem Formular „Neuer Vertrag“; die Werte bereitet
 * {@link uebersichtAus} aus Eingaben und Vorschau des Formulars auf. Pro Monat,
 * Anteil und Summen sind gerundet, daher der Hinweis darunter.
 */
@Component({
  selector: 'app-vertrag-zusammenfassung',
  imports: [Rundungshinweis],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 [id]="titelId">Zusammenfassung</h2>
    <div class="titel">
      <span class="name">{{ uebersicht().name }}</span>
      <span class="unter">{{ uebersicht().unter }}</span>
    </div>
    <dl>
      @for (zeile of uebersicht().zeilen; track zeile.label) {
        <div>
          <dt>{{ zeile.label }}</dt>
          <dd>{{ zeile.wert }}</dd>
        </div>
      }
    </dl>
    <app-rundungshinweis />`,
  styleUrl: './vertrag-zusammenfassung.scss',
  host: { role: 'complementary', '[attr.aria-labelledby]': 'titelId' },
})
export class VertragZusammenfassung {
  readonly uebersicht = input.required<Uebersicht>();

  protected readonly titelId = `zusammenfassung-${++letzte}`;
}
