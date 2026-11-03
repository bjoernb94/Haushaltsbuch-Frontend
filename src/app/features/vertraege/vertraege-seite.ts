import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { VertragAntwort, VertragsuebersichtAntwort } from '../../core/api/api';
import { BetraegePipe } from '../../shared/format/betrag.pipe';
import { HinweisBox } from '../../shared/hinweis-box/hinweis-box';
import { VertragZeile } from './vertrag-zeile/vertrag-zeile';
import { VertragService } from './vertrag.service';

interface Daten {
  vertraege: VertragAntwort[];
  uebersicht: VertragsuebersichtAntwort;
}

/** Kennzahlen und Liste der Verträge; lädt beim Öffnen. */
@Component({
  selector: 'app-vertraege-seite',
  imports: [RouterLink, HinweisBox, BetraegePipe, VertragZeile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertraege-seite.html',
  styleUrl: './vertraege-seite.scss',
})
export class VertraegeSeite {
  private readonly vertraege = inject(VertragService);
  private readonly destroyRef = inject(DestroyRef);

  /** Meldung der Seite davor; nur beim Hinkommen, nicht beim Zurückblättern im Browser. */
  protected readonly meldung = this.meldungDerNavigation();

  protected readonly daten = signal<Daten | null>(null);
  protected readonly fehler = signal(false);
  /** Höchstens ein Vertrag zeigt seine Details. */
  protected readonly offeneId = signal<string | null>(null);

  constructor() {
    this.laden();
  }

  protected laden(): void {
    this.fehler.set(false);
    forkJoin({ vertraege: this.vertraege.auflisten(), uebersicht: this.vertraege.uebersicht() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (daten) => this.daten.set(daten),
        error: () => this.fehler.set(true),
      });
  }

  private meldungDerNavigation(): string | null {
    const navigation = inject(Router).currentNavigation();
    return navigation?.trigger === 'imperative'
      ? (navigation.extras.state?.['meldung'] ?? null)
      : null;
  }

  protected umschalten(id: string): void {
    this.offeneId.update((offen) => (offen === id ? null : id));
  }
}
