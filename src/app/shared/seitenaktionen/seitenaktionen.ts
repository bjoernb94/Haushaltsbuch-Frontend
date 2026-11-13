import { computed, DestroyRef, inject, Injectable, signal, Signal } from '@angular/core';
import { UrlTree } from '@angular/router';

export interface Seitenaktion {
  ziel: string | UrlTree;
  /** Beschriftung für Screenreader; ohne bleibt es beim sichtbaren Text. */
  label: string | null;
}

/** Was eine Seite bis 900 px im Kopf anbietet. */
export interface Aktionen {
  /** Links im Kopf, statt „Zurück“ im Inhalt. */
  zurueck?: Seitenaktion;
  /** „+“ rechts im Kopf, z. B. „Neuer Vertrag“. */
  neu?: Seitenaktion;
  /** Die Seite bringt bis 900 px eine eigene Leiste mit; Kopf und Tab-Leiste entfallen dann. */
  eigeneLeiste?: boolean;
}

/**
 * Aktionen der aktuellen Seite für die Kopfzeile. Die Seiten melden sie über
 * {@link seitenaktionenMelden}; so bleibt die Kopfzeile in Shell und rechtlichem Rahmen dieselbe.
 */
@Injectable({ providedIn: 'root' })
export class Seitenaktionen {
  private readonly quelle = signal<Signal<Aktionen> | null>(null);

  readonly aktionen = computed<Aktionen>(() => this.quelle()?.() ?? {});

  melden(aktionen: Signal<Aktionen>): () => void {
    this.quelle.set(aktionen);
    // Nur die eigenen entfernen, falls die nächste Seite ihre schon gemeldet hat.
    return () => {
      if (this.quelle() === aktionen) {
        this.quelle.set(null);
      }
    };
  }
}

/** Meldet die Aktionen der Seite (Injection-Kontext), bis sie zerstört wird. */
export function seitenaktionenMelden(aktionen: () => Aktionen): void {
  const entfernen = inject(Seitenaktionen).melden(computed(aktionen));
  inject(DestroyRef).onDestroy(entfernen);
}
