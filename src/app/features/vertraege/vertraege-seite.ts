import { Location } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { defer, filter, forkJoin, map, shareReplay, Subscription } from 'rxjs';
import { VertragAntwort, VertragsuebersichtAntwort } from '../../core/api/api';
import { problemCode } from '../../core/fehler/problem';
import { UngespeicherteEingaben } from '../../core/ungespeichert/ungespeicherte-eingaben';
import { BestaetigenDialog } from '../../shared/bestaetigen-dialog/bestaetigen-dialog';
import { BetraegePipe } from '../../shared/format/betrag.pipe';
import { HinweisBox } from '../../shared/hinweis-box/hinweis-box';
import { inDenBlick } from '../../shared/in-den-blick/in-den-blick';
import { seitenaktionenMelden } from '../../shared/seitenaktionen/seitenaktionen';
import { Rundungshinweis } from '../../shared/rundungshinweis/rundungshinweis';
import { NUR_ANTEIL, OHNE_NICHT_BEGONNENE, vertragName } from './vertrag-texte';
import { VertragZeile, ZeilenMeldung } from './vertrag-zeile/vertrag-zeile';
import { VertragService } from './vertrag.service';

interface Daten {
  vertraege: VertragAntwort[];
  uebersicht: VertragsuebersichtAntwort;
}

/** Meldung an der Zeile bzw. in den Details dieses Vertrags; ohne {@code id} oben auf der Seite. */
export interface Meldung extends ZeilenMeldung {
  id: string | null;
  /** Die ganze Zeile ins Bild holen, z. B. weil die Seite nach dem Anlegen oben beginnt. */
  zeileZeigen?: boolean;
}

/** Was die Kind-Routen gerade zeigen. */
interface Ansicht {
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

const NEU = '/vertraege/neu';

/**
 * Kennzahlen und Liste der Verträge; lädt beim Öffnen und nach Änderungen. Details ({@code :id}) und
 * Bearbeiten ({@code :id/bearbeiten}) sind Kind-Routen: am Desktop ein Panel neben der Liste bzw. ein
 * Sheet in der Fenstermitte, bis 900 px Vollbild. Die Kinder holen ihre Daten von hier.
 */
@Component({
  selector: 'app-vertraege-seite',
  imports: [
    RouterLink,
    RouterOutlet,
    HinweisBox,
    BetraegePipe,
    VertragZeile,
    BestaetigenDialog,
    Rundungshinweis,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertraege-seite.html',
  styleUrl: './vertraege-seite.scss',
  host: { '(document:keydown)': 'taste($event)' },
})
export class VertraegeSeite {
  private readonly vertraege = inject(VertragService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly ungespeichert = inject(UngespeicherteEingaben);

  readonly daten = signal<Daten | null>(null);
  readonly fehler = signal(false);

  readonly meldung = signal<Meldung | null>(this.meldungDerNavigation());

  /** Erst beim ersten Bearbeiten laden; nach einem Fehler lädt der nächste Versuch neu. */
  readonly kategorien$ = defer(() => this.vertraege.kategorien()).pipe(shareReplay(1));

  readonly ansicht = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.ansichtDerRoute()),
    ),
    { initialValue: this.ansichtDerRoute() },
  );

  /** Details oder Bearbeiten schließen sich gerade; sie sollen bis dahin nichts mehr melden. */
  readonly schliesst = signal(false);

  /** Der Vertrag, nach dessen Löschen gefragt wird. */
  protected readonly loeschFrage = signal<VertragAntwort | null>(null);
  protected readonly loeschTitel = computed(() => {
    const vertrag = this.loeschFrage();
    return vertrag ? `„${vertragName(vertrag)}“ löschen?` : '';
  });
  /** Dessen Anfrage gerade läuft. */
  readonly loeschendId = signal<string | null>(null);

  /** Oben steht auch, was keine Zeile mehr hat, z. B. weil der Vertrag fort ist. */
  protected readonly meldungOben = computed(() => {
    const meldung = this.meldung();
    const anZeile = !this.fehler() && this.daten()?.vertraege.some(({ id }) => id === meldung?.id);
    return anZeile ? null : meldung;
  });

  protected readonly neu = NEU;
  protected readonly nurAnteil = NUR_ANTEIL;
  protected readonly ohneNichtBegonnene = OHNE_NICHT_BEGONNENE;

  private ladevorgang?: Subscription;

  constructor() {
    seitenaktionenMelden(() => ({ neu: { ziel: NEU, label: 'Neuer Vertrag' } }));
    this.laden(!!this.meldung());

    // Auch abgebrochen (Rückfrage verneint) ist das Schließen vorbei.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd || e instanceof NavigationCancel),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.schliesst.set(false));

    // Zur offenen Zeile scrollen (z. B. nach einem geteilten Link). Nach dem Schließen geht der Fokus,
    // falls er mit den Details verschwunden ist, an die Zeile, von der aus geöffnet wurde.
    let vorher: string | null = null;
    effect(() => {
      const id = this.ansicht()?.id ?? null;
      const geladen = !!this.daten();
      untracked(() => {
        if (id && geladen) {
          afterNextRender(() => this.zeile(id) && inDenBlick(this.zeile(id)!), {
            injector: this.injector,
          });
        } else if (!id && vorher) {
          const zuletzt = vorher;
          afterNextRender(
            () => {
              const fokus = document.activeElement;
              if (!fokus || fokus === document.body) {
                this.zeile(zuletzt)?.querySelector('button')?.focus();
              }
            },
            { injector: this.injector },
          );
        }
        vorher = id;
      });
    });
  }

  laden(meldungZeigen = false): void {
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

  /** Details öffnen; ein zweiter Klick auf dieselbe Zeile schließt sie wieder. */
  protected detailsUmschalten(id: string): void {
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

  loeschenFragen(vertrag: VertragAntwort): void {
    this.loeschFrage.set(vertrag);
  }

  gespeichert(vertrag: VertragAntwort): void {
    this.nachAenderung({
      id: vertrag.id,
      text: `„${vertragName(vertrag)}“ wurde gespeichert.`,
      art: 'info',
    });
  }

  konflikt(id: string): void {
    this.nachAenderung({
      id,
      text: 'Der Vertrag wurde inzwischen geändert. Bitte prüfen und erneut bearbeiten.',
      art: 'fehler',
    });
  }

  /** Auch für einen Link auf einen Vertrag, den es nicht (mehr) gibt. */
  nichtGefunden(): void {
    this.meldung.set({ id: null, text: 'Diesen Vertrag gibt es nicht mehr.', art: 'fehler' });
    this.schliessen(['/vertraege']);
    this.laden(true);
  }

  /** In den Details steht die Meldung des offenen Vertrags dort, nicht an seiner Zeile. */
  meldungZu(id: string): Meldung | null {
    const meldung = this.meldung();
    return meldung?.id === id ? meldung : null;
  }

  protected zeilenMeldung(id: string): ZeilenMeldung | null {
    return this.ansicht()?.id === id ? null : this.meldungZu(id);
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

  /**
   * „N“ für „Neuer Vertrag“, nur ohne Modifikator (Strg+N und ⌘N gehören dem Browser), nicht beim
   * Tippen und nicht, solange ein Dialog, Sheet oder Menü offen ist. Esc schließt die Details.
   */
  protected taste(event: KeyboardEvent): void {
    const taste = event.key.toLowerCase();
    if (
      (taste !== 'n' && taste !== 'escape') ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.repeat ||
      event.defaultPrevented ||
      this.ansicht()?.bearbeiten ||
      this.loeschFrage() ||
      this.ungespeichert.frageOffen()
    ) {
      return;
    }
    const ziel = event.target instanceof Element ? event.target : null;
    if (
      this.element.nativeElement.querySelector('[role="menu"]') ||
      ziel?.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), dialog, [role="dialog"], [role="menu"]',
      )
    ) {
      return;
    }
    event.preventDefault();
    if (taste === 'n') {
      void this.router.navigateByUrl(NEU);
    } else if (this.ansicht()) {
      this.schliessen(['/vertraege']);
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

  private zeile(id: string): HTMLElement | null {
    return this.element.nativeElement.querySelector<HTMLElement>(
      `[data-vertrag="${CSS.escape(id)}"] .zeile`,
    );
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
    this.ansichtSchliessen(vertrag.id);
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

  /** Details eines anderen Vertrags bleiben offen. */
  private ansichtSchliessen(id: string): void {
    if (this.ansicht()?.id === id) {
      this.schliessen(['/vertraege']);
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
    this.meldung.set(meldung);
    this.laden(true);
  }
}
