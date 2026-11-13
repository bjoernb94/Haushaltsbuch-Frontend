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
import { problemCode } from '../../core/fehler/problem';
import { UngespeicherteEingaben } from '../../core/ungespeichert/ungespeicherte-eingaben';
import { BestaetigenDialog } from '../../shared/bestaetigen-dialog/bestaetigen-dialog';
import { BetraegePipe } from '../../shared/format/betrag.pipe';
import { HinweisBox } from '../../shared/hinweis-box/hinweis-box';
import { inDenBlick } from '../../shared/in-den-blick/in-den-blick';
import { seitenaktionenMelden } from '../../shared/seitenaktionen/seitenaktionen';
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
  /** Die ganze Zeile ins Bild holen, z. B. weil die Seite nach dem Anlegen oben beginnt. */
  zeileZeigen?: boolean;
}

/** Kennzahlen und Liste der Verträge; lädt beim Öffnen und nach Änderungen. */
@Component({
  selector: 'app-vertraege-seite',
  imports: [RouterLink, HinweisBox, BetraegePipe, VertragZeile, BestaetigenDialog],
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

  /** Der Vertrag, nach dessen Löschen gefragt wird. */
  protected readonly loeschFrage = signal<VertragAntwort | null>(null);
  protected readonly loeschTitel = computed(() => {
    const vertrag = this.loeschFrage();
    return vertrag ? `„${vertragName(vertrag)}“ löschen?` : '';
  });
  /** Dessen Anfrage gerade läuft. */
  protected readonly loeschendId = signal<string | null>(null);

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
    seitenaktionenMelden(() => ({ neu: { ziel: '/vertraege/neu', label: 'Neuer Vertrag' } }));
    this.laden(!!this.meldung());
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
      () => {
        const meldung = this.element.nativeElement.querySelector<HTMLElement>('.meldung');
        const zeile = this.meldung()?.zeileZeigen && meldung?.closest<HTMLElement>('.zeile');
        meldung?.focus({ preventScroll: !!zeile });
        if (zeile) {
          inDenBlick(zeile);
        }
      },
      { injector: this.injector },
    );
  }

  private meldungDerNavigation(): Meldung | null {
    const navigation = inject(Router).currentNavigation();
    const state = navigation?.trigger === 'imperative' ? navigation.extras.state : null;
    const text: unknown = state?.['meldung'];
    const id: unknown = state?.['vertragId'];
    return typeof text === 'string'
      ? { id: typeof id === 'string' ? id : null, text, art: 'info', zeileZeigen: true }
      : null;
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

  protected loeschAntwort(ja: boolean): void {
    const vertrag = this.loeschFrage();
    if (!vertrag) {
      return;
    }
    this.loeschFrage.set(null);
    if (ja) {
      this.loeschen(vertrag);
    }
  }

  private loeschen(vertrag: VertragAntwort): void {
    this.meldung.set(null);
    this.loeschendId.set(vertrag.id);
    this.vertraege
      .loeschen(vertrag.id, vertrag.version)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.geloescht(vertrag),
        error: (error: unknown) => this.loeschFehler(vertrag, error),
      });
  }

  /** Auch nach 404: Der Vertrag ist weg, das ist es, was der Nutzer wollte. */
  private geloescht(vertrag: VertragAntwort): void {
    this.loeschendId.set(null);
    this.formularSchliessen(vertrag.id);
    this.meldung.set({
      ...this.stelleDerZeile(vertrag.id),
      text: `„${vertragName(vertrag)}“ wurde gelöscht.`,
      art: 'info',
    });
    this.laden(true);
  }

  private loeschFehler(vertrag: VertragAntwort, error: unknown): void {
    this.loeschendId.set(null);
    switch (problemCode(error)) {
      case 'NICHT_GEFUNDEN':
        this.geloescht(vertrag);
        break;
      case 'KONFLIKT':
        this.formularSchliessen(vertrag.id);
        this.meldung.set({
          id: vertrag.id,
          text: 'Der Vertrag wurde inzwischen geändert. Bitte prüfen und erneut löschen.',
          art: 'fehler',
        });
        this.laden(true);
        break;
      default:
        this.meldung.set({
          id: vertrag.id,
          text: 'Der Vertrag konnte nicht gelöscht werden. Bitte versuche es später erneut.',
          art: 'fehler',
        });
        this.meldungFokussieren();
    }
  }

  /** Das Formular eines anderen Vertrags bleibt offen, seine Eingaben sind nicht betroffen. */
  private formularSchliessen(id: string): void {
    if (this.offen()?.id === id) {
      this.offen.set(null);
    }
  }

  /** Die Zeile verschwindet: Die Meldung steht über der nächsten, bei der letzten unter der davor. */
  private stelleDerZeile(id: string): Pick<Meldung, 'id' | 'abgesetzt' | 'unten'> {
    const vertraege = this.daten()?.vertraege ?? [];
    const index = vertraege.findIndex((vertrag) => vertrag.id === id);
    const naechster = vertraege[index + 1];
    return naechster
      ? { id: naechster.id, abgesetzt: true }
      : { id: vertraege[index - 1]?.id ?? null, abgesetzt: true, unten: true };
  }

  private nachAenderung(meldung: Meldung): void {
    this.oeffnen(null);
    this.meldung.set(meldung);
    this.laden(true);
  }
}
