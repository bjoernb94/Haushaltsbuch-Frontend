import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { VertragsuebersichtAntwort } from '../../../core/api/api';
import { problemCode } from '../../../core/fehler/problem';
import { Chip } from '../../../shared/chip/chip';
import { BetraegePipe, BetragPipe } from '../../../shared/format/betrag.pipe';
import { DatumPipe } from '../../../shared/format/datum.pipe';
import { HinweisBox } from '../../../shared/hinweis-box/hinweis-box';
import { InfoKnopf } from '../../../shared/info-knopf/info-knopf';
import {
  INFO_NUR_ANTEIL,
  INFO_OHNE_NICHT_BEGONNENE,
  INFO_RUNDUNG,
  vertragName,
  ZAHLWEISE_EINHEIT,
} from '../../vertraege/vertrag-texte';
import { VertragService } from '../../vertraege/vertrag.service';
import { Kachel } from '../kachel/kachel';

/** Kachel „Vertragsübersicht“ mit Kennzahlen und nächsten Fristen; lädt beim Öffnen der Seite. */
@Component({
  selector: 'app-vertrag-kachel',
  imports: [RouterLink, Kachel, Chip, HinweisBox, BetragPipe, BetraegePipe, DatumPipe, InfoKnopf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-kachel.html',
  styleUrl: './vertrag-kachel.scss',
})
export class VertragKachel {
  private readonly vertraege = inject(VertragService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly uebersicht = signal<VertragsuebersichtAntwort | null>(null);
  protected readonly fehler = signal(false);
  /** Komponente inzwischen abbestellt: keine Fehlermeldung, die Kachel verschwindet. */
  protected readonly keinZugriff = signal(false);

  /** Hinweise zu „Kosten pro Monat“, nur die zutreffenden; gerundet ist der Wert immer. */
  protected readonly infoKosten = computed(() => {
    const daten = this.uebersicht();
    return [
      ...(daten?.hatAnteile ? [INFO_NUR_ANTEIL] : []),
      ...(daten?.hatNichtBegonnene ? [INFO_OHNE_NICHT_BEGONNENE] : []),
      INFO_RUNDUNG,
    ];
  });

  protected readonly fristen = computed(() =>
    (this.uebersicht()?.naechsteKuendigungsfristen ?? []).map((frist) => ({
      ...frist,
      name: vertragName(frist),
      einheit: ZAHLWEISE_EINHEIT[frist.zahlweise],
    })),
  );

  constructor() {
    this.laden();
  }

  protected laden(): void {
    this.fehler.set(false);
    this.vertraege
      .uebersicht()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (uebersicht) => this.uebersicht.set(uebersicht),
        error: (error: unknown) =>
          problemCode(error) === 'KEIN_ZUGRIFF'
            ? this.keinZugriff.set(true)
            : this.fehler.set(true),
      });
  }
}
