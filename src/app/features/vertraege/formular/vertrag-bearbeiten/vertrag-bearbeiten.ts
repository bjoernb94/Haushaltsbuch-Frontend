import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VertragKategorieAntwort } from '../../../../core/api/api';
import { problemCode } from '../../../../core/fehler/problem';
import { UngespeicherteEingaben } from '../../../../core/ungespeichert/ungespeicherte-eingaben';
import { HinweisBox } from '../../../../shared/hinweis-box/hinweis-box';
import { VertragDetails } from '../../details/vertrag-details';
import { VertragFormular } from '../vertrag-formular';
import { vertragName } from '../../vertrag-texte';
import { VertraegeSeite } from '../../liste/vertraege-seite';
import { VertragNavigation } from '../../liste/vertrag-navigation';
import { VertragService } from '../../vertrag.service';
import { VertragSpeichern } from '../vertrag-pruefung';

/**
 * Bearbeiten als Sheet (Route {@code :id/bearbeiten} unter den Details): am Desktop in der
 * Fenstermitte, bis 900 px Vollbild von unten, Abbrechen und Sichern in der Leiste oben. Natives
 * {@code dialog}: Fokus bleibt darin, Esc kommt vom Browser. Schließen geht über die Route, damit der
 * Guard nach ungespeicherten Eingaben fragt, auch bei Esc, Klick daneben und der Zurück-Taste.
 */
@Component({
  selector: 'app-vertrag-bearbeiten',
  imports: [HinweisBox, VertragFormular],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-bearbeiten.html',
  styleUrl: './vertrag-bearbeiten.scss',
  // Per Tastatur schließt Esc; der Klick daneben ist nur die Entsprechung für Maus und Finger.
  host: { '(click)': 'klick($event)' },
})
export class VertragBearbeiten {
  private readonly vertraege = inject(VertragService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ungespeichert = inject(UngespeicherteEingaben);
  private readonly seite = inject(VertraegeSeite);
  private readonly navigation = inject(VertragNavigation);
  private readonly details = inject(VertragDetails);

  protected readonly formularId = 'vertrag-bearbeiten';
  protected readonly neuerPreis = this.navigation.neuerPreis();
  protected readonly vertrag = this.details.vertrag;
  protected readonly name = computed(() => {
    const vertrag = this.vertrag();
    return vertrag ? vertragName(vertrag) : '';
  });

  protected readonly kategorien = signal<VertragKategorieAntwort[] | null>(null);
  protected readonly ladefehler = signal(false);
  protected readonly sendet = signal(false);
  protected readonly speicherfehler = signal<unknown>(null);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private zerstoert = false;

  constructor() {
    this.laden();
    // Der Dialog verschwindet mit der Route, ohne close(): Den Fokus gibt es dann von hier zurück.
    const vorher = document.activeElement;
    afterNextRender(() => this.dialog().nativeElement.showModal());
    this.destroyRef.onDestroy(() => {
      this.zerstoert = true;
      if (vorher instanceof HTMLElement && vorher.isConnected) {
        vorher.focus();
      }
    });
  }

  protected laden(): void {
    this.ladefehler.set(false);
    this.seite.kategorien$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (kategorien) => this.kategorien.set(kategorien),
      error: () => this.ladefehler.set(true),
    });
  }

  protected abbrechen(): void {
    this.navigation.schliessen(['/vertraege', this.details.id()]);
  }

  /** Esc: nicht selbst schließen, sondern über die Route (Rückfrage). */
  protected esc(event: Event): void {
    event.preventDefault();
    this.abbrechen();
  }

  /**
   * Der Browser schließt den Dialog bei wiederholtem Esc auch ohne uns. Solange die Route steht, bleibt
   * er offen.
   */
  protected geschlossen(): void {
    if (this.zerstoert) {
      return;
    }
    this.dialog().nativeElement.showModal();
    this.abbrechen();
  }

  /** Klick auf die abgedunkelte Fläche um das Sheet. */
  protected klick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.abbrechen();
    }
  }

  protected speichern(eingabe: VertragSpeichern): void {
    const vertrag = this.vertrag();
    if (!vertrag) {
      return;
    }
    const aenderung = {
      ...eingabe,
      version: vertrag.version,
      unterbrechungIds: eingabe.unterbrechungIds ?? [],
    };
    this.sendet.set(true);
    this.speicherfehler.set(null);
    this.vertraege
      .aendern(vertrag.id, aenderung)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (gespeichert) => {
          this.ungespeichert.vergessen();
          this.seite.gespeichert(gespeichert);
          this.abbrechen();
        },
        error: (error: unknown) => this.fehlerBehandeln(vertrag.id, error),
      });
  }

  private fehlerBehandeln(id: string, error: unknown): void {
    this.sendet.set(false);
    switch (problemCode(error)) {
      case 'KONFLIKT':
        this.ungespeichert.vergessen();
        this.seite.konflikt();
        this.abbrechen();
        break;
      case 'NICHT_GEFUNDEN':
        this.ungespeichert.vergessen();
        this.seite.nichtGefunden();
        break;
      default:
        this.speicherfehler.set(error);
    }
  }
}
