import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { Preispunkt } from '../../../../core/api/api';

type Preispunktart = Preispunkt['art'];
import { betragText } from '../../../../shared/format/betrag.pipe';
import { datumText } from '../../../../shared/format/datum.pipe';

/** Höhe der Zeichenfläche in px; die Breite folgt dem Platz (viewBox 0–100). */
const HOEHE = 150;
/** Oben und unten bleibt Platz für die Punkte. */
const OBEN = 20;
const UNTEN = 135;
/** Abstand der Zeichenfläche vom oberen Rand des Kastens, für die Beträge an der Achse. */
const RAND = 20;

const HOECHSTENS_JAHRE = 6;

/** Heute im Browser als ISO-Datum; nur für die Lage der Linie „heute“ (Darstellung). */
function heuteIso(): string {
  const jetzt = new Date();
  return new Date(Date.UTC(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()))
    .toISOString()
    .slice(0, 10);
}

function tag(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function plusMonate(zeit: number, monate: number): number {
  const d = new Date(zeit);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + monate, d.getUTCDate());
}

const runden = (n: number) => Math.round(n * 100) / 100;

/** Bis heute: gezahlt oder errechnet; die Linie ist dort durchgezogen. */
const bisHeute = (art: Preispunktart) => art === 'GEZAHLT' || art === 'ERRECHNET';

const ZUSATZ: Record<Preispunktart, string> = {
  GEZAHLT: '',
  ERRECHNET: ' (errechnet)',
  ANGEKUENDIGT: ' (angekündigt)',
  PROGNOSE: ' (Prognose)',
};

interface Zeichnung {
  gitter: string;
  heute: string;
  heuteX: number;
  gezahlt: string;
  zukunft: string;
  punkte: { x: number; y: number; gezahlt: boolean; errechnet: boolean }[];
  /** Ob es Punkte {@code ERRECHNET} gibt; dann erklärt die Legende sie. */
  mitErrechneten: boolean;
  jahre: { x: number; text: string }[];
  achse: { y: number; text: string }[];
}

/**
 * Preisverlauf als Treppe (Details, Tab Preisverlauf): bis heute durchgezogen, danach angekündigt und
 * Prognose gestrichelt. Errechnete Stufen (seit dem letzten Speichern fällig) liegen auf der
 * durchgezogenen Linie, ihr Punkt ist offen. Die Punkte und ihre Art kommen vom Backend (ADR 0010), hier wird nur
 * gezeichnet. Die Linie „heute“ steht nach dem Datum des Browsers, liegt aber nie vor dem letzten
 * gezahlten oder hinter dem ersten künftigen Punkt.
 */
@Component({
  selector: 'app-vertrag-preisverlauf',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-preisverlauf.html',
  styleUrl: './vertrag-preisverlauf.scss',
})
export class VertragPreisverlauf {
  private readonly locale = inject(LOCALE_ID);

  /** Mindestens zwei, sortiert nach {@code ab}. */
  readonly punkte = input.required<Preispunkt[]>();
  readonly heute = input<string>(heuteIso());

  protected readonly hoehe = HOEHE;

  /** Textalternative: alle Punkte mit Datum, Betrag und Art. */
  protected readonly beschreibung = computed(
    () =>
      'Preisverlauf: ' +
      this.punkte()
        .map(
          ({ ab, betrag, art }) =>
            `ab ${datumText(ab)} ${betragText(betrag, this.locale)}` + ZUSATZ[art],
        )
        .join(', '),
  );

  protected readonly zeichnung = computed<Zeichnung>(() => {
    const punkte = this.punkte().map((p) => ({ ...p, zeit: tag(p.ab) }));
    const heute = tag(this.heute());
    const t0 = punkte[0].zeit;
    const t1 = plusMonate(Math.max(punkte[punkte.length - 1].zeit, heute), 6);
    const spanne = t1 - t0 || 1;

    const werte = punkte.map(({ betrag }) => betrag.wert);
    let min = Math.min(...werte);
    let max = Math.max(...werte);
    if (max - min < 0.01) {
      min *= 0.9;
      max *= 1.1;
    }
    const x = (zeit: number) => runden(Math.max(0, Math.min(100, ((zeit - t0) / spanne) * 100)));
    const y = (wert: number) => runden(UNTEN - ((wert - min) / (max - min || 1)) * (UNTEN - OBEN));

    // Grenze zwischen durchgezogen und gestrichelt: heute, aber passend zur Art der Punkte.
    const letzterGezahlt = punkte.filter(({ art }) => bisHeute(art)).at(-1)?.zeit ?? t0;
    const ersterKuenftig = punkte.find(({ art }) => !bisHeute(art))?.zeit ?? t1;
    const grenze = Math.min(Math.max(heute, letzterGezahlt), ersterKuenftig);

    const preisAm = (zeit: number) =>
      punkte.reduce((wert, p) => (p.zeit <= zeit ? p.betrag.wert : wert), punkte[0].betrag.wert);
    const treppe = (von: number, bis: number) => {
      if (bis <= von) {
        return '';
      }
      let wert = preisAm(von);
      let pfad = `M${x(von)} ${y(wert)}`;
      for (const p of punkte) {
        if (p.zeit > von && p.zeit <= bis) {
          pfad += ` L${x(p.zeit)} ${y(wert)} L${x(p.zeit)} ${y(p.betrag.wert)}`;
          wert = p.betrag.wert;
        }
      }
      return `${pfad} L${x(bis)} ${y(wert)}`;
    };

    const ersteJahr = new Date(t0).getUTCFullYear() + 1;
    const letzteJahr = new Date(t1).getUTCFullYear();
    const schritt = Math.max(1, Math.ceil((letzteJahr - ersteJahr + 1) / HOECHSTENS_JAHRE));
    const jahre = [];
    for (let jahr = ersteJahr; jahr <= letzteJahr; jahr += schritt) {
      const lage = x(Date.UTC(jahr, 0, 1));
      if (lage > 3 && lage < 97) {
        jahre.push({ x: lage, text: String(jahr) });
      }
    }

    const heuteX = x(grenze);
    return {
      gitter: `M0 ${y(min)} H100 M0 ${y(max)} H100`,
      heute: `M${heuteX} 6 V${HOEHE - 5}`,
      heuteX,
      gezahlt: treppe(t0, grenze),
      zukunft: treppe(grenze, t1),
      punkte: punkte.map((p) => ({
        x: x(p.zeit),
        y: y(p.betrag.wert),
        gezahlt: p.art === 'GEZAHLT',
        errechnet: p.art === 'ERRECHNET',
      })),
      mitErrechneten: punkte.some(({ art }) => art === 'ERRECHNET'),
      jahre,
      achse: [max, min].map((wert) => ({
        y: runden(RAND + y(wert)),
        text: betragText({ wert, waehrung: punkte[0].betrag.waehrung }, this.locale),
      })),
    };
  });
}
