import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Komponente, KomponentenAntwort } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { problemCode } from '../../../core/fehler/problem';
import { KOMPONENTEN } from '../../../core/komponenten/komponente';
import { UngespeicherteEingaben } from '../../../core/ungespeichert/ungespeicherte-eingaben';
import { HinweisBox } from '../../../shared/hinweis-box/hinweis-box';
import { ZurueckLink } from '../../../shared/zurueck-link/zurueck-link';
import { zurueckZuEinstellungen } from '../unterseite';
import { KomponentenService } from './komponenten.service';

/** Was über der Liste steht; Fehler und Hinweise verschwinden bei der nächsten Änderung. */
type Meldung = 'leer' | 'fehler' | 'konflikt';

const MELDUNGEN: Record<Meldung, string> = {
  leer: 'Bitte wähle mindestens eine Komponente aus.',
  fehler: 'Deine Komponenten konnten nicht gespeichert werden. Bitte versuche es später erneut.',
  konflikt:
    'Deine Komponenten wurden inzwischen an anderer Stelle geändert. Wir haben den aktuellen Stand geladen.',
};

/**
 * Komponenten ein- und ausschalten. Lädt die Auswahl beim Öffnen selbst (ADR 0018) und speichert sie
 * mit ihrer {@code version}; danach lädt {@code AuthService} die Komponenten neu, damit Hauptmenü und
 * Startseite sofort passen. Ob mindestens eine aktiv sein muss, entscheidet das Backend (VALIDIERUNG);
 * die Prüfung hier dient nur der Bedienung.
 */
@Component({
  selector: 'app-komponenten-seite',
  imports: [HinweisBox, ZurueckLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './komponenten-seite.html',
  styleUrl: './komponenten-seite.scss',
})
export class KomponentenSeite {
  private readonly service = inject(KomponentenService);
  private readonly auth = inject(AuthService);
  private readonly ungespeichert = inject(UngespeicherteEingaben);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly zurueck = zurueckZuEinstellungen();
  protected readonly komponenten = KOMPONENTEN;

  protected readonly zustand = signal<'laedt' | 'fehler' | 'da'>('laedt');
  /** Der gespeicherte Stand, gegen den Änderungen zählen. */
  private readonly gespeichert = signal<KomponentenAntwort | null>(null);
  protected readonly auswahl = signal<ReadonlySet<Komponente>>(new Set());
  protected readonly sendet = signal(false);
  protected readonly meldung = signal<Meldung | null>(null);
  protected readonly erfolg = signal(false);

  protected readonly anzahl = computed(() => this.auswahl().size);
  protected readonly geaendert = computed(() => {
    const gespeichert = new Set(this.gespeichert()?.komponenten ?? []);
    const auswahl = this.auswahl();
    return auswahl.size !== gespeichert.size || [...auswahl].some((k) => !gespeichert.has(k));
  });
  protected readonly meldungText = computed(() => {
    const meldung = this.meldung();
    return meldung && MELDUNGEN[meldung];
  });

  constructor() {
    effect(() => this.ungespeichert.melden(this.geaendert()));
    this.destroyRef.onDestroy(() => this.ungespeichert.melden(false));
    this.laden();
  }

  protected laden(): void {
    this.zustand.set('laedt');
    this.service
      .laden()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (antwort) => {
          this.uebernehmen(antwort);
          this.zustand.set('da');
        },
        error: () => this.zustand.set('fehler'),
      });
  }

  protected umschalten(komponente: Komponente): void {
    const auswahl = new Set(this.auswahl());
    if (!auswahl.delete(komponente)) {
      auswahl.add(komponente);
    }
    this.auswahl.set(auswahl);
    this.meldung.set(null);
    this.erfolg.set(false);
  }

  protected verwerfen(): void {
    this.auswahl.set(new Set(this.gespeichert()?.komponenten));
    this.meldung.set(null);
    this.erfolg.set(false);
  }

  protected speichern(event: Event): void {
    event.preventDefault();
    const gespeichert = this.gespeichert();
    if (!gespeichert || this.sendet() || !this.geaendert()) {
      return;
    }
    this.erfolg.set(false);
    if (this.anzahl() === 0) {
      this.meldung.set('leer');
      return;
    }
    this.meldung.set(null);
    this.sendet.set(true);
    // In der Reihenfolge der Liste, damit die Anfrage nicht von der Klickfolge abhängt.
    const komponenten = KOMPONENTEN.map((k) => k.wert).filter((k) => this.auswahl().has(k));
    this.service
      .aendern({ komponenten, version: gespeichert.version })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (antwort) => {
          this.sendet.set(false);
          this.uebernehmen(antwort);
          this.erfolg.set(true);
          this.auth.komponentenLaden().subscribe();
        },
        error: (error: unknown) => this.fehlerBehandeln(error),
      });
  }

  private fehlerBehandeln(error: unknown): void {
    this.sendet.set(false);
    switch (problemCode(error)) {
      case 'KONFLIKT':
        // Der neue Stand ersetzt die eigene Auswahl; Hauptmenü und Startseite ziehen nach.
        this.meldung.set('konflikt');
        this.service
          .laden()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({ next: (antwort) => this.uebernehmen(antwort), error: () => undefined });
        this.auth.komponentenLaden().subscribe();
        break;
      case 'VALIDIERUNG':
        this.meldung.set('leer');
        break;
      default:
        this.meldung.set('fehler');
    }
  }

  private uebernehmen(antwort: KomponentenAntwort): void {
    this.gespeichert.set(antwort);
    this.auswahl.set(new Set(antwort.komponenten));
  }
}
