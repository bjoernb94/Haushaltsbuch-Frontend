import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  Injector,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { VertragAenderung, VertragAntwort, VertragKategorieAntwort } from '../../../core/api/api';
import { problemCode } from '../../../core/fehler/problem';
import { HinweisBox } from '../../../shared/hinweis-box/hinweis-box';
import { VertragFormular } from '../vertrag-formular/vertrag-formular';
import { Eingabe, VertragEingabe, VertragService } from '../vertrag.service';

/** Formular in der Vertragszeile: lädt die Kategorien, speichert und meldet das Ergebnis. */
@Component({
  selector: 'app-vertrag-bearbeiten',
  imports: [HinweisBox, VertragFormular],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-bearbeiten.html',
  styleUrl: './vertrag-bearbeiten.scss',
})
export class VertragBearbeiten implements OnInit {
  private readonly vertraege = inject(VertragService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly vertrag = input.required<VertragAntwort>();
  readonly kategorien = input.required<Observable<VertragKategorieAntwort[]>>();

  /** Das Formular oder der Fehlerhinweis steht da, die endgültige Höhe ist also bekannt. */
  readonly angezeigt = output();
  readonly abgebrochen = output();
  readonly gespeichert = output<VertragAntwort>();
  readonly konflikt = output();
  readonly nichtGefunden = output();

  protected readonly geladen = signal<VertragKategorieAntwort[] | null>(null);
  protected readonly ladefehler = signal(false);
  protected readonly sendet = signal(false);
  protected readonly speicherfehler = signal<unknown>(null);

  constructor() {
    effect(() => {
      if (this.geladen() || this.ladefehler()) {
        afterNextRender(() => this.angezeigt.emit(), { injector: this.injector });
      }
    });
  }

  ngOnInit(): void {
    this.laden();
  }

  protected laden(): void {
    this.ladefehler.set(false);
    this.kategorien()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (kategorien) => this.geladen.set(kategorien),
        error: () => this.ladefehler.set(true),
      });
  }

  protected speichern(eingabe: Required<VertragEingabe>): void {
    const { id, version } = this.vertrag();
    const aenderung: Required<Eingabe<VertragAenderung>> = { ...eingabe, version };
    this.sendet.set(true);
    this.speicherfehler.set(null);
    this.vertraege
      .aendern(id, aenderung)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (vertrag) => this.gespeichert.emit(vertrag),
        error: (error: unknown) => this.fehlerBehandeln(error),
      });
  }

  private fehlerBehandeln(error: unknown): void {
    this.sendet.set(false);
    switch (problemCode(error)) {
      case 'KONFLIKT':
        this.konflikt.emit();
        break;
      case 'NICHT_GEFUNDEN':
        this.nichtGefunden.emit();
        break;
      default:
        this.speicherfehler.set(error);
    }
  }
}
