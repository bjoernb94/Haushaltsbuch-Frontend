import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Verlaengerung, VertragAntwort } from '../../../../core/api/api';
import { waehrungZeichen } from '../../../../shared/format/betrag.pipe';
import { datumText } from '../../../../shared/format/datum.pipe';
import { HinweisBox } from '../../../../shared/hinweis-box/hinweis-box';
import { fristenMit, VERLAENGERUNGEN } from '../tab-laufzeit/tab-laufzeit';
import { betragEingabe } from '../vertrag-pruefung';
import { WiederaufnahmeFeld } from './wiederaufnahme-pruefung';

/** Die Felder des Dialogs, leer; {@code getRawValue()} ergibt {@code WiederaufnahmeWerte}. */
export function wiederaufnahmeGruppe(fb: NonNullableFormBuilder) {
  return fb.group({
    datum: [''],
    verlaengerung: fb.control<Verlaengerung | ''>(''),
    laufzeitende: [''],
    kuendigungsfristMonate: [''],
    betrag: [''],
  });
}

export type WiederaufnahmeGruppe = ReturnType<typeof wiederaufnahmeGruppe>;

/** Für Absende-Knöpfe außerhalb des Formulars ({@code form}-Attribut). */
export const WIEDERAUFNAHME_FORMULAR_ID = 'wieder-formular';

const FEHLER_SENDEN =
  'Der Vertrag konnte nicht wieder aufgenommen werden. Bitte versuche es später erneut.';

/**
 * Formular des Dialogs „Wieder aufnehmen“: Datum, „Laufzeit ab dann“ (nur bei kündbaren Verträgen)
 * und „Preis“, dazu die Knöpfe (bis 900 px in der Leiste des Dialogs). Werte und Fehler hält der
 * Dialog.
 */
@Component({
  selector: 'app-wiederaufnahme-felder',
  imports: [ReactiveFormsModule, HinweisBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wiederaufnahme-felder.html',
  styleUrl: './wiederaufnahme-felder.scss',
})
export class WiederaufnahmeFelder {
  private readonly locale = inject(LOCALE_ID);

  readonly formular = input.required<WiederaufnahmeGruppe>();
  readonly vertrag = input.required<VertragAntwort>();
  readonly fehler = input.required<ReadonlyMap<WiederaufnahmeFeld, string>>();
  /** Fehler ohne Feld, z. B. Serverfehler oder keine Verbindung. */
  readonly allgemeinerFehler = input(false);
  readonly sendet = input(false);

  readonly absenden = output();
  readonly abbrechen = output();

  protected readonly formularId = WIEDERAUFNAHME_FORMULAR_ID;
  protected readonly fehlerSenden = FEHLER_SENDEN;
  protected readonly verlaengerungen = VERLAENGERUNGEN;

  protected readonly fruehestens = computed(() =>
    datumText(this.vertrag().berechnet.wiederaufnahme?.fruehestens ?? null),
  );
  protected readonly waehrung = computed(() =>
    waehrungZeichen(this.vertrag().betrag.waehrung, this.locale),
  );
  /** Der aktuelle Betrag; wer nichts einträgt, behält ihn. */
  protected readonly platzhalter = computed(() => betragEingabe(this.vertrag().betrag));
  protected readonly fristen = computed(() => fristenMit(this.vertrag().kuendigungsfristMonate));

  protected fehlerText(feld: WiederaufnahmeFeld): string | null {
    return this.fehler().get(feld) ?? null;
  }

  /** Für {@code aria-describedby}: der Fehlertext, wenn es ihn gibt, und ein fester Hinweis. */
  protected beschreibung(feld: WiederaufnahmeFeld, hinweis = false): string | null {
    const ids = [
      this.fehlerText(feld) ? `wieder-${feld}-fehler` : null,
      hinweis ? `wieder-${feld}-hinweis` : null,
    ];
    return ids.filter(Boolean).join(' ') || null;
  }
}
