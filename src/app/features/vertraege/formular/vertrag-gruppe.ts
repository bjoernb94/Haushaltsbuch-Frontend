import { NonNullableFormBuilder } from '@angular/forms';
import {
  Erhoehungsrhythmus,
  Steigerungsart,
  Verlaengerung,
  Zahlungsweg,
  Zahlweise,
} from '../../../core/api/api';
import { EinmalkostenZeile } from './vertrag-einmalkosten-zeilen/vertrag-einmalkosten-zeilen';
import { PreisZeile } from './vertrag-preisliste/vertrag-preisliste';
import { VertragFeld } from './vertrag-pruefung';

/** Die Felder des Vertragsformulars, leer; {@code getRawValue()} ergibt {@code VertragWerte}. */
export function vertragGruppe(fb: NonNullableFormBuilder) {
  return fb.group({
    anbieter: [''],
    bezeichnung: [''],
    kategorieId: [''],
    vertragsnummer: [''],
    betrag: [''],
    gueltigSeit: [''],
    preise: fb.array<PreisZeile>([]),
    anteilProzent: [''],
    zahlweise: fb.control<Zahlweise | ''>(''),
    beginn: [''],
    zahlungsweg: fb.control<Zahlungsweg | ''>(''),
    nichtKuendbar: [false],
    laufzeitende: [''],
    verlaengerung: fb.control<Verlaengerung | ''>(''),
    kuendigungsfristMonate: [''],
    gekuendigt: [false],
    gekuendigtZum: [''],
    notiz: [''],
    einmalkosten: fb.array<EinmalkostenZeile>([]),
    preisgarantieBis: [''],
    steigt: [false],
    steigerungsart: fb.control<Steigerungsart>('PROZENT'),
    steigerungswert: [''],
    rhythmus: fb.control<Erhoehungsrhythmus>('JAEHRLICH'),
    naechsteErhoehungAm: [''],
    erinnerungSonderkuendigung: [true],
  });
}

export function preisZeile(fb: NonNullableFormBuilder): PreisZeile {
  return fb.group({ gueltigAb: [''], betrag: [''] });
}

export function einmalkostenZeile(fb: NonNullableFormBuilder): EinmalkostenZeile {
  return fb.group({ bezeichnung: [''], betrag: [''], faelligAm: [''] });
}

type Liste = 'preise' | 'einmalkosten';

/**
 * Fehler der Zeilen ab {@code index} rücken nach dem Entfernen dieser Zeile eine Zeile nach oben;
 * die der anderen Liste bleiben.
 */
export function ohneZeile(fehler: ReadonlyMap<VertragFeld, string>, liste: Liste, index: number) {
  const neu = new Map<VertragFeld, string>();
  for (const [feld, text] of fehler) {
    const zeile = /^(\w+)\.(\d+)\.(\w+)$/.exec(feld);
    if (!zeile || zeile[1] !== liste) {
      neu.set(feld, text);
    } else if (Number(zeile[2]) !== index) {
      const i = Number(zeile[2]);
      neu.set(`${liste}.${i > index ? i - 1 : i}.${zeile[3]}` as VertragFeld, text);
    }
  }
  return neu;
}
