import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { Betrag } from '../../core/api/api';

/** Nur für eine leere Liste; sonst steht die Währung immer am Betrag. */
const KEIN_BETRAG: Betrag = { wert: 0, waehrung: 'EUR' };

export function betragText({ wert, waehrung }: Betrag, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: waehrung }).format(wert);
}

/** Betrag mit seiner Währung, z. B. „586,80 €“. */
@Pipe({ name: 'betrag' })
export class BetragPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(betrag: Betrag): string {
    return betragText(betrag, this.locale);
  }
}

/** Liste je Währung, jeder Eintrag sichtbar; leer „0,00 €“. */
@Pipe({ name: 'betraege' })
export class BetraegePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(betraege: readonly Betrag[]): string {
    const anzeige = betraege.length ? betraege : [KEIN_BETRAG];
    return anzeige.map((betrag) => betragText(betrag, this.locale)).join(' · ');
  }
}
