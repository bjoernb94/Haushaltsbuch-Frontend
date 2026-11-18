import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { VertragKategorieAntwort } from '../../../../core/api/api';
import { UngespeicherteEingaben } from '../../../../core/ungespeichert/ungespeicherte-eingaben';
import { HinweisBox } from '../../../../shared/hinweis-box/hinweis-box';
import { seitenaktionenMelden } from '../../../../shared/seitenaktionen/seitenaktionen';
import { VertragFormular } from '../vertrag-formular';
import { vertragName } from '../../vertrag-texte';
import { VertragEingabe, VertragService } from '../../vertrag.service';

/**
 * Legt einen Vertrag an und kehrt mit einer Meldung zur Liste zurück, die dort neu lädt. Bis 900 px
 * mit eigener Leiste oben (Abbrechen, Sichern) statt Kopfzeile und Tab-Leiste.
 */
@Component({
  selector: 'app-neuer-vertrag-seite',
  imports: [RouterLink, HinweisBox, VertragFormular],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './neuer-vertrag-seite.html',
  styleUrl: './neuer-vertrag-seite.scss',
})
export class NeuerVertragSeite {
  private readonly vertraege = inject(VertragService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ungespeichert = inject(UngespeicherteEingaben);

  protected readonly kategorien = signal<VertragKategorieAntwort[] | null>(null);
  protected readonly ladefehler = signal(false);
  protected readonly sendet = signal(false);
  protected readonly speicherfehler = signal<unknown>(null);
  protected readonly formularId = 'neuer-vertrag';

  constructor() {
    seitenaktionenMelden(() => ({ eigeneLeiste: true }));
    this.laden();
  }

  protected laden(): void {
    this.ladefehler.set(false);
    this.vertraege
      .kategorien()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (kategorien) => this.kategorien.set(kategorien),
        error: () => this.ladefehler.set(true),
      });
  }

  protected speichern(eingabe: VertragEingabe): void {
    this.sendet.set(true);
    this.speicherfehler.set(null);
    this.vertraege
      .anlegen(eingabe)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (vertrag) => {
          this.ungespeichert.vergessen();
          void this.router.navigate(['/vertraege'], {
            state: {
              meldung: `„${vertragName(vertrag)}“ wurde gespeichert.`,
              vertragId: vertrag.id,
            },
          });
        },
        error: (error: unknown) => {
          this.sendet.set(false);
          this.speicherfehler.set(error);
        },
      });
  }

  protected zurueck(): void {
    void this.router.navigate(['/vertraege']);
  }
}
