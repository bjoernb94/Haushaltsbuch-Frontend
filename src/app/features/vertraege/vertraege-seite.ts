import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { defer, forkJoin, shareReplay, Subscription } from 'rxjs';
import { VertragAntwort, VertragsuebersichtAntwort } from '../../core/api/api';
import { UngespeicherteEingaben } from '../../core/ungespeichert/ungespeicherte-eingaben';
import { BetraegePipe } from '../../shared/format/betrag.pipe';
import { HinweisBox } from '../../shared/hinweis-box/hinweis-box';
import { vertragName } from './vertrag-texte';
import { VertragZeile, ZeilenMeldung } from './vertrag-zeile/vertrag-zeile';
import { VertragService } from './vertrag.service';

interface Daten {
  vertraege: VertragAntwort[];
  uebersicht: VertragsuebersichtAntwort;
}

type Ansicht = 'details' | 'bearbeiten';

interface Offen {
  id: string;
  ansicht: Ansicht;
}

/** Meldung an der Zeile dieses Vertrags; ohne {@code id} oben auf der Seite. */
interface Meldung extends ZeilenMeldung {
  id: string | null;
}

/** Kennzahlen und Liste der Verträge; lädt beim Öffnen und nach Änderungen. */
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
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly ungespeichert = inject(UngespeicherteEingaben);

  protected readonly daten = signal<Daten | null>(null);
  protected readonly fehler = signal(false);
  /** Höchstens ein Vertrag zeigt seine Details oder sein Formular. */
  protected readonly offen = signal<Offen | null>(null);

  protected readonly meldung = signal<Meldung | null>(this.meldungDerNavigation());

  /** Oben steht auch, was keine Zeile mehr hat, z. B. weil der Vertrag fort ist. */
  protected readonly meldungOben = computed(() => {
    const meldung = this.meldung();
    const anZeile = !this.fehler() && this.daten()?.vertraege.some(({ id }) => id === meldung?.id);
    return anZeile ? null : meldung;
  });

  /** Erst beim ersten Bearbeiten laden; nach einem Fehler lädt der nächste Versuch neu. */
  protected readonly kategorien$ = defer(() => this.vertraege.kategorien()).pipe(shareReplay(1));

  private ladevorgang?: Subscription;

  constructor() {
    this.laden();
  }

  protected laden(meldungZeigen = false): void {
    this.fehler.set(false);
    // Ein älterer Stand darf einen neueren nicht überschreiben.
    this.ladevorgang?.unsubscribe();
    this.ladevorgang = forkJoin({
      vertraege: this.vertraege.auflisten(),
      uebersicht: this.vertraege.uebersicht(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (daten) => {
          this.daten.set(daten);
          if (meldungZeigen) {
            this.meldungFokussieren();
          }
        },
        error: () => {
          this.fehler.set(true);
          if (meldungZeigen) {
            this.meldungFokussieren();
          }
        },
      });
  }

  /** Nach dem Neuladen, denn die Zeile kann durch die Änderung in der Liste gewandert sein. */
  private meldungFokussieren(): void {
    afterNextRender(
      () => this.element.nativeElement.querySelector<HTMLElement>('.meldung')?.focus(),
      { injector: this.injector },
    );
  }

  private meldungDerNavigation(): Meldung | null {
    const navigation = inject(Router).currentNavigation();
    const text: unknown =
      navigation?.trigger === 'imperative' ? navigation.extras.state?.['meldung'] : null;
    return typeof text === 'string' ? { id: null, text, art: 'info' } : null;
  }

  protected zeilenMeldung(id: string): ZeilenMeldung | null {
    const meldung = this.meldung();
    return meldung?.id === id ? meldung : null;
  }

  protected ansicht(id: string): Ansicht | null {
    const offen = this.offen();
    return offen?.id === id ? offen.ansicht : null;
  }

  /** Geänderte Eingaben gehen nur nach der Rückfrage verloren, nicht durch einen Fehlklick. */
  protected async umschalten(id: string, ansicht: Ansicht): Promise<void> {
    const ziel = this.ansicht(id) === ansicht ? null : { id, ansicht };
    if (await this.ungespeichert.bestaetigen()) {
      this.oeffnen(ziel);
    }
  }

  protected oeffnen(ziel: Offen | null): void {
    this.offen.set(ziel);
    this.meldung.set(null);
  }

  protected gespeichert(vertrag: VertragAntwort): void {
    this.nachAenderung({
      id: vertrag.id,
      text: `„${vertragName(vertrag)}“ wurde gespeichert.`,
      art: 'info',
    });
  }

  protected konflikt(id: string): void {
    this.nachAenderung({
      id,
      text: 'Der Vertrag wurde inzwischen geändert. Bitte prüfen und erneut bearbeiten.',
      art: 'fehler',
    });
  }

  protected nichtGefunden(): void {
    this.nachAenderung({ id: null, text: 'Diesen Vertrag gibt es nicht mehr.', art: 'fehler' });
  }

  private nachAenderung(meldung: Meldung): void {
    this.oeffnen(null);
    this.meldung.set(meldung);
    this.laden(true);
  }
}
