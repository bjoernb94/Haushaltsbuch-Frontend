import { computed, DestroyRef, inject, Injectable, signal, Signal } from '@angular/core';
import { UrlTree } from '@angular/router';

export interface Seitenaktion {
  ziel: string | UrlTree;
  /** Beschriftung für Screenreader; ohne bleibt es beim sichtbaren Text. */
  label: string | null;
  /** Sichtbarer Text bei „Zurück“, z. B. „Einstellungen“; ohne „Zurück“. */
  text?: string;
  /** „Zurück“ geht im Verlauf zurück statt vorwärts zu {@code ziel} (siehe {@code ZurueckLink}). */
  verlauf?: boolean;
}

/** Hauptaktion der Seite, z. B. „Neuer Vertrag“. */
export interface Hauptaktion {
  ziel: string | UrlTree;
  /** Ab 901 px Text des Knopfs, bis 900 px Beschriftung des „+“. */
  text: string;
  /** Tastenkürzel, das die Seite selbst behandelt; nur für Tooltip und {@code aria-keyshortcuts}. */
  taste?: string;
}

/** Was eine Seite in der Kopfzeile anbietet. */
export interface Aktionen {
  /** Ab 901 px der Seitentitel (die {@code h1}); bis 900 px trägt ihn die Seite selbst. */
  titel?: string;
  /** Ab 901 px die übergeordnete Seite vor dem Titel, z. B. „Einstellungen ›“. */
  pfad?: Seitenaktion & { text: string };
  /** Bis 900 px links im Kopf, statt „Zurück“ im Inhalt. */
  zurueck?: Seitenaktion;
  /** Ab 901 px kleiner Primärknopf rechts, bis 900 px „+“. */
  neu?: Hauptaktion;
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
