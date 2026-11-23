import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
  signal,
} from '@angular/core';
import { VertragAntwort } from '../../../../core/api/api';
import { InfoKnopf } from '../../../../shared/info-knopf/info-knopf';
import { VertragPreisverlauf } from '../vertrag-preisverlauf/vertrag-preisverlauf';
import { Abschnitt, gruppenText, gruppieren } from '../../automatische-preise';
import { errechnetText, INFO_RUNDUNG_PROGNOSE, preisText, prognoseText } from '../../vertrag-texte';

interface Zeile {
  ab: string;
  text: string;
  art: 'aktuell' | 'frueher' | 'prognose' | '';
  automatisch: boolean;
}

/**
 * Tab Preisverlauf der Details: Diagramm des Preisverlaufs (ab zwei Punkten), alle Preise und die
 * Prognose, sobald es mehr als den einen Preis gibt; sonst ein Hinweis mit „Preis hinzufügen“. Was
 * aktuell, angekündigt, automatisch, errechnet oder nach dem Vertragsende ist, sagt das Backend.
 * Seit dem letzten Speichern fällige Stufen stehen nur im Verlauf ({@code ERRECHNET}); ist der
 * Betrag daraus errechnet, ist die letzte von ihnen aktuell. Viele automatische Preise hintereinander
 * sind zusammengeklappt.
 */
@Component({
  selector: 'app-vertrag-preise',
  imports: [InfoKnopf, VertragPreisverlauf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-preise.html',
  styleUrl: './vertrag-preise.scss',
})
export class VertragPreise {
  private readonly locale = inject(LOCALE_ID);

  readonly vertrag = input.required<VertragAntwort>();

  readonly hinzufuegen = output();

  protected readonly info = computed(() =>
    this.vertrag().berechnet.prognose.length ? [INFO_RUNDUNG_PROGNOSE] : [],
  );

  /** Schlüssel der aufgeklappten Gruppen automatischer Preise. */
  private readonly aufgeklappt = signal<ReadonlySet<number>>(new Set());

  private readonly zeilen = computed<Zeile[]>(() => {
    const { preise, berechnet, betragErrechnet } = this.vertrag();
    const errechnet = berechnet.preisverlauf.filter(({ art }) => art === 'ERRECHNET');
    if (preise.length + errechnet.length < 2 && !berechnet.prognose.length) {
      return [];
    }
    const gespeichert = preise.map<Zeile>((preis) => ({
      ab: preis.gueltigAb,
      text: preisText(
        betragErrechnet && preis.art === 'AKTUELL' ? { ...preis, art: 'FRUEHER' } : preis,
        this.locale,
      ),
      art:
        preis.art === 'AKTUELL'
          ? betragErrechnet
            ? 'frueher'
            : 'aktuell'
          : preis.art === 'FRUEHER'
            ? 'frueher'
            : '',
      automatisch: preis.automatisch,
    }));
    const stufen = errechnet.map<Zeile>((punkt, i) => {
      const aktuell = betragErrechnet && i === errechnet.length - 1;
      return {
        ab: punkt.ab,
        text: errechnetText(punkt, aktuell, this.locale),
        art: aktuell ? 'aktuell' : 'frueher',
        automatisch: false,
      };
    });
    return [
      ...[...gespeichert, ...stufen].sort((a, b) => a.ab.localeCompare(b.ab)),
      ...berechnet.prognose.map<Zeile>((preis) => ({
        ab: preis.ab,
        text: prognoseText(preis, this.locale),
        art: 'prognose',
        automatisch: false,
      })),
    ];
  });

  protected readonly abschnitte = computed<Abschnitt<Zeile>[]>(() =>
    gruppieren(this.zeilen(), (zeile) => zeile.automatisch),
  );

  protected istAufgeklappt(schluessel: number): boolean {
    return this.aufgeklappt().has(schluessel);
  }

  protected umschalten(schluessel: number): void {
    this.aufgeklappt.update((offen) => {
      const neu = new Set(offen);
      if (!neu.delete(schluessel)) {
        neu.add(schluessel);
      }
      return neu;
    });
  }

  protected gruppenText(eintraege: { eintrag: Zeile }[]): string {
    return gruppenText(eintraege.length, eintraege[0].eintrag.ab, eintraege.at(-1)!.eintrag.ab);
  }
}
