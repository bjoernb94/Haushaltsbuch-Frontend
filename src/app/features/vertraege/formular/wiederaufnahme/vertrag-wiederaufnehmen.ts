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
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder } from '@angular/forms';
import { distinctUntilChanged, map } from 'rxjs';
import { VertragAntwort } from '../../../../core/api/api';
import { problemCode, problemFelder } from '../../../../core/fehler/problem';
import { UngespeicherteEingaben } from '../../../../core/ungespeichert/ungespeicherte-eingaben';
import { datumText } from '../../../../shared/format/datum.pipe';
import { HinweisBox } from '../../../../shared/hinweis-box/hinweis-box';
import { VertragDetails } from '../../details/vertrag-details';
import { VertraegeSeite } from '../../liste/vertraege-seite';
import { VertragNavigation } from '../../liste/vertrag-navigation';
import { endeText, vertragName } from '../../vertrag-texte';
import { VertragService } from '../../vertrag.service';
import {
  WIEDERAUFNAHME_FORMULAR_ID,
  WiederaufnahmeFelder,
  wiederaufnahmeGruppe,
} from './wiederaufnahme-felder';
import {
  WiederaufnahmeFeld,
  wiederaufnahmeAnfrage,
  wiederaufnahmeFehlerTexte,
  wiederaufnahmePruefen,
  WiederaufnahmeWerte,
  wiederaufnahmeWerte,
} from './wiederaufnahme-pruefung';

const NICHT_MOEGLICH = 'Der Vertrag kann nicht mehr wieder aufgenommen werden.';

/**
 * Dialog „Wieder aufnehmen“ (Route {@code :id/wiederaufnehmen} unter den Details) für einen
 * gekündigten oder beendeten Vertrag: am Desktop in der Fenstermitte, bis 900 px Vollbild wie
 * „Vertrag bearbeiten“ mit Abbrechen und Sichern oben. Natives {@code dialog}; Schließen geht über die
 * Route, damit der Guard bei Eingaben fragt, auch bei Esc, Klick daneben und der Zurück-Taste. Ob und
 * ab wann es geht, sagt das Backend ({@code berechnet.wiederaufnahme}).
 */
@Component({
  selector: 'app-vertrag-wiederaufnehmen',
  imports: [HinweisBox, WiederaufnahmeFelder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertrag-wiederaufnehmen.html',
  styleUrl: './vertrag-wiederaufnehmen.scss',
  host: { '(click)': 'klick($event)' },
})
export class VertragWiederaufnehmen {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly vertraege = inject(VertragService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly ungespeichert = inject(UngespeicherteEingaben);
  protected readonly seite = inject(VertraegeSeite);
  private readonly navigation = inject(VertragNavigation);
  private readonly details = inject(VertragDetails);

  protected readonly vertrag = this.details.vertrag;
  protected readonly name = computed(() => {
    const vertrag = this.vertrag();
    return vertrag ? vertragName(vertrag) : '';
  });
  protected readonly text = computed(() => {
    const vertrag = this.vertrag();
    return vertrag
      ? `${endeText(vertrag.berechnet)} Bis zur Wiederaufnahme gilt er als unterbrochen, ohne Abbuchungen.`
      : '';
  });
  protected readonly formularId = WIEDERAUFNAHME_FORMULAR_ID;
  protected readonly formular = wiederaufnahmeGruppe(this.fb);

  protected readonly sendet = signal(false);
  protected readonly fehler = signal<ReadonlyMap<WiederaufnahmeFeld, string>>(new Map());
  /** Fehler ohne Feld, z. B. Serverfehler oder keine Verbindung. */
  protected readonly allgemeinerFehler = signal(false);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private ausgangswerte = '';
  private zerstoert = false;

  constructor() {
    const vorher = document.activeElement;
    afterNextRender(() => this.dialog().nativeElement.showModal());
    this.destroyRef.onDestroy(() => {
      this.zerstoert = true;
      this.ungespeichert.melden(false);
      if (vorher instanceof HTMLElement && vorher.isConnected) {
        vorher.focus();
      }
    });

    // Einmal vorbelegen, sobald der Vertrag da ist; spätere Stände (nach dem Speichern) nicht.
    const vorbelegen = effect(() => {
      const vertrag = this.vertrag();
      if (vertrag) {
        untracked(() => this.vorbelegen(vertrag));
        vorbelegen.destroy();
      }
    });

    const controls: Record<WiederaufnahmeFeld, AbstractControl> = this.formular.controls;
    for (const [feld, control] of Object.entries(controls)) {
      control.valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe(() => this.fehlerEntfernen(feld as WiederaufnahmeFeld));
    }
    this.formular.valueChanges
      .pipe(
        map(() => JSON.stringify(this.formular.getRawValue()) !== this.ausgangswerte),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((geaendert) => this.ungespeichert.melden(geaendert));
  }

  protected abbrechen(): void {
    this.navigation.schliessen(['/vertraege', this.details.id()]);
  }

  /** Esc: nicht selbst schließen, sondern über die Route (Rückfrage). */
  protected esc(event: Event): void {
    event.preventDefault();
    this.abbrechen();
  }

  /** Der Browser schließt den Dialog bei wiederholtem Esc auch ohne uns; solange die Route steht, bleibt er offen. */
  protected geschlossen(): void {
    if (this.zerstoert) {
      return;
    }
    this.dialog().nativeElement.showModal();
    this.abbrechen();
  }

  /** Klick auf die abgedunkelte Fläche um den Dialog. */
  protected klick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.abbrechen();
    }
  }

  protected absenden(): void {
    const vertrag = this.vertrag();
    if (!vertrag || this.sendet()) {
      return;
    }
    const werte: WiederaufnahmeWerte = this.formular.getRawValue();
    this.allgemeinerFehler.set(false);
    this.fehler.set(wiederaufnahmePruefen(werte, vertrag.kuendbar));
    if (this.fehler().size) {
      this.fehlerZeigen();
      return;
    }
    this.sendet.set(true);
    this.vertraege
      .wiederaufnehmen(vertrag.id, wiederaufnahmeAnfrage(werte, vertrag))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (gespeichert) => this.gespeichert(gespeichert, werte.datum),
        error: (error: unknown) => this.fehlerBehandeln(vertrag.id, error),
      });
  }

  private vorbelegen(vertrag: VertragAntwort): void {
    // Z. B. ein Link auf einen Vertrag, der wieder läuft.
    if (!vertrag.berechnet.wiederaufnahme) {
      this.nichtMoeglich();
      return;
    }
    this.formular.setValue(wiederaufnahmeWerte(vertrag), { emitEvent: false });
    this.ausgangswerte = JSON.stringify(this.formular.getRawValue());
    afterNextRender(() => document.getElementById('wieder-datum')?.focus(), {
      injector: this.injector,
    });
  }

  private gespeichert(vertrag: VertragAntwort, datum: string): void {
    this.ungespeichert.vergessen();
    this.seite.nachAenderung({
      art: 'erfolg',
      titel: `„${vertragName(vertrag)}“ wird ab ${datumText(datum)} wieder aufgenommen.`,
    });
    this.abbrechen();
  }

  private fehlerBehandeln(id: string, error: unknown): void {
    this.sendet.set(false);
    switch (problemCode(error)) {
      case 'KONFLIKT':
        this.ungespeichert.vergessen();
        this.seite.konflikt();
        this.abbrechen();
        break;
      case 'WIEDERAUFNAHME_NICHT_MOEGLICH':
        this.nichtMoeglich();
        break;
      case 'NICHT_GEFUNDEN':
        this.ungespeichert.vergessen();
        this.seite.nichtGefunden();
        break;
      default: {
        const fehler = wiederaufnahmeFehlerTexte(problemFelder(error));
        this.fehler.set(fehler);
        this.allgemeinerFehler.set(!fehler.size);
        this.fehlerZeigen();
      }
    }
  }

  private nichtMoeglich(): void {
    this.ungespeichert.vergessen();
    this.seite.nachAenderung({ art: 'fehler', titel: NICHT_MOEGLICH });
    this.abbrechen();
  }

  private fehlerEntfernen(feld: WiederaufnahmeFeld): void {
    this.allgemeinerFehler.set(false);
    if (this.fehler().has(feld)) {
      this.fehler.update((fehler) => new Map([...fehler].filter(([name]) => name !== feld)));
    }
  }

  /** Zum ersten markierten Feld, ohne Feldfehler zur Box oben. */
  private fehlerZeigen(): void {
    afterNextRender(
      () => {
        const dialog = this.dialog().nativeElement;
        const ziel =
          dialog.querySelector<HTMLElement>('[aria-invalid="true"]') ??
          dialog.querySelector<HTMLElement>('.hinweis');
        ziel?.focus();
      },
      { injector: this.injector },
    );
  }
}
