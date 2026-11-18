import { Location } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

/** Was die Kind-Routen gerade zeigen. */
export interface Ansicht {
  id: string;
  bearbeiten: boolean;
}

/**
 * Im Navigations-State: Diese Seite hat den Eintrag selbst geöffnet, der vorige im Verlauf ist also
 * ihr Ziel beim Schließen. Ohne (Link geteilt, neu geladen) ersetzt das Schließen den Eintrag.
 */
const INTERN = 'intern';

/** Bearbeiten öffnet im Tab Preisverlauf mit einer leeren Zeile („Preis hinzufügen“ in den Details). */
const NEUER_PREIS = 'neuerPreis';

/**
 * Öffnen und Schließen der Kind-Routen der Vertragsliste, Details ({@code :id}) und Bearbeiten
 * ({@code :id/bearbeiten}), sodass die Zurück-Taste schließt und geteilte Links funktionieren. Die
 * Liste stellt sie bereit, ihre Kinder nutzen dieselbe.
 */
@Injectable()
export class VertragNavigation {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly ansicht = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.ansichtDerRoute()),
    ),
    { initialValue: this.ansichtDerRoute() },
  );

  /** Details oder Bearbeiten schließen sich gerade; sie sollen bis dahin nichts mehr melden. */
  readonly schliesst = signal(false);

  constructor() {
    // Auch abgebrochen (Rückfrage verneint) ist das Schließen vorbei.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd || e instanceof NavigationCancel),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.schliesst.set(false));
  }

  /** Details öffnen; ein zweiter Klick auf dieselbe Zeile schließt sie wieder. */
  detailsUmschalten(id: string): void {
    if (this.ansicht()?.id === id) {
      this.schliessen(['/vertraege']);
    } else {
      this.oeffnen(['/vertraege', id]);
    }
  }

  bearbeiten(id: string, neuerPreis = false): void {
    this.oeffnen(
      ['/vertraege', id, 'bearbeiten'],
      false,
      neuerPreis ? { [NEUER_PREIS]: true } : {},
    );
  }

  /** Für Bearbeiten: Kam es über „Preis hinzufügen“? */
  neuerPreis(): boolean {
    return !!(this.location.getState() as Record<string, unknown> | null)?.[NEUER_PREIS];
  }

  /** Tab der Details in der URL, ohne neuen Eintrag im Verlauf. */
  tabWaehlen(tab: string | null): void {
    void this.router.navigate([], {
      queryParams: { tab },
      replaceUrl: true,
      scroll: 'manual',
      state: { [INTERN]: this.intern() },
    });
  }

  /**
   * Schließt Details oder Bearbeiten: zurück im Verlauf, wenn diese Seite sie geöffnet hat (so führt
   * die Zurück-Taste nicht wieder hinein), sonst nach {@code ziel}. Ungespeicherte Eingaben fragt der
   * Guard der Route.
   */
  schliessen(ziel: string[]): void {
    this.schliesst.set(true);
    if (this.intern()) {
      this.location.back();
    } else {
      void this.router.navigate(ziel, { replaceUrl: true, scroll: 'manual' });
    }
  }

  private oeffnen(ziel: string[], ersetzen = !!this.ansicht(), state = {}): void {
    // Wechsel zwischen Verträgen ersetzen den Eintrag, damit die Zurück-Taste zur Liste führt.
    void this.router.navigate(ziel, {
      replaceUrl: ersetzen,
      scroll: 'manual',
      state: { ...state, [INTERN]: ersetzen ? this.intern() : true },
    });
  }

  private intern(): boolean {
    return !!(this.location.getState() as Record<string, unknown> | null)?.[INTERN];
  }

  private ansichtDerRoute(): Ansicht | null {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
      const id = route.paramMap.get('id');
      if (id) {
        return { id, bearbeiten: route.firstChild?.routeConfig?.path === 'bearbeiten' };
      }
    }
    return null;
  }
}
