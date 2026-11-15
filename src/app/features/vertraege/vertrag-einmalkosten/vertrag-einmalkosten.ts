import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { VertragAntwort } from '../../../core/api/api';
import { betragText } from '../../../shared/format/betrag.pipe';
import { datumText } from '../../../shared/format/datum.pipe';

/**
 * Einmalkosten im Tab Kosten der Details, sortiert vom Backend; „Gesamt“ ist der volle Betrag, ohne
 * Anteil. Ohne Einträge ein Hinweis.
 */
@Component({
  selector: 'app-vertrag-einmalkosten',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-einmalkosten.html',
  styleUrl: './vertrag-einmalkosten.scss',
})
export class VertragEinmalkosten {
  private readonly locale = inject(LOCALE_ID);

  readonly vertrag = input.required<VertragAntwort>();

  protected readonly zeilen = computed(() =>
    this.vertrag().einmalkosten.map(({ bezeichnung, betrag, faelligAm }) => ({
      text: `${bezeichnung} · fällig am ${datumText(faelligAm)}`,
      betrag: betragText(betrag, this.locale),
    })),
  );

  protected readonly gesamt = computed(
    () => `Gesamt ${betragText(this.vertrag().berechnet.einmalkosten, this.locale)}`,
  );
}
