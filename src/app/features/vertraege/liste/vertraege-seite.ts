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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { defer, forkJoin, shareReplay, Subscription } from 'rxjs';
import { VertragAntwort, VertragsuebersichtAntwort } from '../../../core/api/api';
import { Benachrichtigungen, Meldung } from '../../../core/benachrichtigungen/benachrichtigungen';
import { problemCode } from '../../../core/fehler/problem';
import { UngespeicherteEingaben } from '../../../core/ungespeichert/ungespeicherte-eingaben';
import { BestaetigenDialog } from '../../../shared/bestaetigen-dialog/bestaetigen-dialog';
import { BetraegePipe } from '../../../shared/format/betrag.pipe';
import { HinweisBox } from '../../../shared/hinweis-box/hinweis-box';
import { InfoKnopf } from '../../../shared/info-knopf/info-knopf';
import { inDenBlick } from '../../../shared/in-den-blick/in-den-blick';
import { seitenaktionenMelden } from '../../../shared/seitenaktionen/seitenaktionen';
import {
  INFO_KALENDERJAHR,
  INFO_KALENDERJAHR_MIT_PROGNOSE,
  INFO_NUR_ANTEIL,
  INFO_OHNE_NICHT_BEGONNENE,
  INFO_RUNDUNG,
  vertragName,
} from '../vertrag-texte';
import { VertragNavigation } from './vertrag-navigation';
import { VertragZeile } from './vertrag-zeile/vertrag-zeile';
import { VertragService } from '../vertrag.service';

interface Daten {
  vertraege: VertragAntwort[];
  uebersicht: VertragsuebersichtAntwort;
}

const NEU = '/vertraege/neu';

/**
 * Kennzahlen und Liste der Verträge; lädt beim Öffnen und nach Änderungen. Details ({@code :id}) und
 * Bearbeiten ({@code :id/bearbeiten}) sind Kind-Routen: am Desktop ein Panel neben der Liste bzw. ein
 * Sheet in der Fenstermitte, bis 900 px Vollbild. Die Kinder holen ihre Daten von hier, Öffnen und
 * Schließen von {@link VertragNavigation}. Rückmeldungen nach Änderungen gehen als Toast an
 * {@link Benachrichtigungen}; die Seite springt dafür nicht.
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
    InfoKnopf,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertraege-seite.html',
  styleUrl: './vertraege-seite.scss',
  providers: [VertragNavigation],
  host: { '(document:keydown)': 'taste($event)' },
})
export class VertraegeSeite {
  private readonly vertraege = inject(VertragService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly ungespeichert = inject(UngespeicherteEingaben);
  private readonly benachrichtigungen = inject(Benachrichtigungen);

  readonly daten = signal<Daten | null>(null);
  readonly fehler = signal(false);

  /** Erst beim ersten Bearbeiten laden; nach einem Fehler lädt der nächste Versuch neu. */
  readonly kategorien$ = defer(() => this.vertraege.kategorien()).pipe(shareReplay(1));

  protected readonly navigation = inject(VertragNavigation);
  private readonly ansicht = this.navigation.ansicht;

  /** Der Vertrag, nach dessen Löschen gefragt wird. */
  protected readonly loeschFrage = signal<VertragAntwort | null>(null);
  protected readonly loeschTitel = computed(() => {
    const vertrag = this.loeschFrage();
    return vertrag ? `„${vertragName(vertrag)}“ löschen?` : '';
  });
  /** Dessen Anfrage gerade läuft. */
  readonly loeschendId = signal<string | null>(null);

  protected readonly neu = NEU;

  // Hinweise zu den Kennzahlen, nur die zutreffenden; gerundet sind die Summen immer.
  private readonly uebersicht = computed(() => this.daten()?.uebersicht);
  private readonly anteil = computed(() =>
    this.uebersicht()?.hatAnteile ? [INFO_NUR_ANTEIL] : [],
  );
  protected readonly infoMonat = computed(() => [
    ...this.anteil(),
    ...(this.uebersicht()?.hatNichtBegonnene ? [INFO_OHNE_NICHT_BEGONNENE] : []),
    INFO_RUNDUNG,
  ]);
  protected readonly infoJahr = computed(() => [
    this.uebersicht()?.kostenImJahrMitPrognose ? INFO_KALENDERJAHR_MIT_PROGNOSE : INFO_KALENDERJAHR,
    ...this.anteil(),
    INFO_RUNDUNG,
  ]);
  /** Einmalkosten werden nicht umgerechnet, nur der Anteil rundet. */
  protected readonly infoEinmal = computed(() =>
    this.anteil().length ? [...this.anteil(), INFO_RUNDUNG] : [],
  );

  private ladevorgang?: Subscription;

  constructor() {
    seitenaktionenMelden(() => ({
      titel: 'Verträge',
      neu: { ziel: NEU, text: 'Neuer Vertrag', taste: 'n' },
    }));
    this.laden();

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

  /** Lädt Liste und Kennzahlen; danach z. B. den Fokus setzen ({@code danach}). */
  laden(danach?: () => void): void {
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
          if (danach) {
            afterNextRender(danach, { injector: this.injector });
          }
        },
        error: () => this.fehler.set(true),
      });
  }

  loeschenFragen(vertrag: VertragAntwort): void {
    this.loeschFrage.set(vertrag);
  }

  gespeichert(vertrag: VertragAntwort): void {
    this.nachAenderung({ art: 'erfolg', titel: `„${vertragName(vertrag)}“ wurde gespeichert.` });
  }

  konflikt(): void {
    this.nachAenderung({
      art: 'info',
      titel: 'Der Vertrag wurde inzwischen geändert. Bitte prüfen und erneut bearbeiten.',
    });
  }

  /** Auch für einen Link auf einen Vertrag, den es nicht (mehr) gibt. */
  nichtGefunden(): void {
    this.navigation.schliessen(['/vertraege']);
    this.nachAenderung({ art: 'info', titel: 'Diesen Vertrag gibt es nicht mehr.' });
  }

  /** Melden und neu laden, z. B. nach dem Wiederaufnehmen. */
  nachAenderung(meldung: Meldung): void {
    this.benachrichtigungen.melden(meldung);
    this.laden();
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
      this.ansicht()?.sheet ||
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
      this.navigation.schliessen(['/vertraege']);
    }
  }

  private zeile(id: string): HTMLElement | null {
    return this.element.nativeElement.querySelector<HTMLElement>(
      `[data-vertrag="${CSS.escape(id)}"] .zeile`,
    );
  }

  private loeschen(vertrag: VertragAntwort): void {
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
    const nachbar = this.nachbarZeile(vertrag.id);
    this.benachrichtigungen.melden({
      art: 'erfolg',
      titel: `„${vertragName(vertrag)}“ wurde gelöscht.`,
    });
    // Die Zeile ist fort: Der Fokus geht zur nächsten, sonst zur vorherigen, ohne Verträge zu
    // „Ersten Vertrag anlegen“. Die Ansage übernimmt der Toast.
    this.laden(() => this.fokusNachLoeschen(nachbar));
  }

  private loeschFehler(vertrag: VertragAntwort, error: unknown): void {
    this.loeschendId.set(null);
    switch (problemCode(error)) {
      case 'NICHT_GEFUNDEN':
        this.geloescht(vertrag);
        break;
      case 'KONFLIKT':
        this.nachAenderung({
          art: 'info',
          titel: 'Der Vertrag wurde inzwischen geändert. Bitte prüfen und erneut löschen.',
        });
        break;
      default:
        this.benachrichtigungen.melden({
          art: 'fehler',
          titel: 'Der Vertrag konnte nicht gelöscht werden. Bitte versuche es später erneut.',
        });
    }
  }

  /** Details eines anderen Vertrags bleiben offen. */
  private ansichtSchliessen(id: string): void {
    if (this.ansicht()?.id === id) {
      this.navigation.schliessen(['/vertraege']);
    }
  }

  /** Die Zeile nach der gelöschten, bei der letzten die davor. */
  private nachbarZeile(id: string): string | null {
    const vertraege = this.daten()?.vertraege ?? [];
    const index = vertraege.findIndex((vertrag) => vertrag.id === id);
    return (vertraege[index + 1] ?? vertraege[index - 1])?.id ?? null;
  }

  /** Auf „…“ der Zeile; bis 900 px gibt es das nicht, dann die Zeile selbst. */
  private fokusNachLoeschen(id: string | null): void {
    const zeile = id ? this.zeile(id) : null;
    const mehr = zeile?.querySelector<HTMLElement>('button.mehr');
    const ziel = zeile
      ? mehr && (mehr.checkVisibility?.() ?? true)
        ? mehr
        : zeile.querySelector<HTMLElement>('button.tippen')
      : this.element.nativeElement.querySelector<HTMLElement>('.leer a');
    ziel?.focus();
  }
}
