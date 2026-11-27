import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Glocke } from '../glocke/glocke';
import { Logo } from '../logo/logo';
import { Nutzermenue } from '../nutzermenue/nutzermenue';
import { Seitenaktionen } from '../seitenaktionen/seitenaktionen';
import { ZurueckLink } from '../zurueck-link/zurueck-link';

/** Rand der Kopfzeile und Mindestrand des Inhalts (raender.neben-seitenleiste). */
const RAND = 24;
/** Halbe Breite des Inhalts: höchstens 1152 px, mittig. */
const HALBE_BREITE = 576;
/** Abstand zwischen den Teilen der Kopfzeile. */
const ABSTAND = 8;
/** Abstand, Trennstrich und Abstand zwischen Hauptaktion und Glocke. */
const MIT_TRENNER = 25;

/**
 * Wie weit der Seitenteil (Titel, Hauptaktion) vor Glocke und Nutzermenü endet, damit er bündig mit
 * dem Inhalt abschließt. Passt das nicht mit Trennstrich dazwischen, stehen beide direkt nebeneinander,
 * getrennt durch den Strich. Reine Darstellung, ab 901 px.
 * @param breite Breite der Kopfzeile
 * @param rechts Breite von Glocke und Nutzermenü, ohne Session {@code null}
 */
export function kopfAusrichten(
  breite: number,
  rechts: number | null,
): { luecke: number; getrennt: boolean } {
  const rand = Math.max(RAND, breite / 2 - HALBE_BREITE);
  if (rechts === null) {
    return { luecke: rand - RAND, getrennt: true };
  }
  const abstand = rand - RAND - rechts;
  return abstand >= MIT_TRENNER
    ? { luecke: abstand - ABSTAND, getrennt: true }
    : { luecke: 0, getrennt: false };
}

/**
 * Kopfzeile, sticky und durchscheinend. In der Shell (Variante {@code app}) ab 901 px mit Seitentitel,
 * Pfad und Hauptaktion der Seite (Seitenaktionen), bündig mit dem Inhalt; auf Impressum und Datenschutz
 * ({@code einfach}) mit dem Logo am linken Rand. Mit Session am rechten Rand Glocke und Nutzermenü. Bis
 * 900 px ohne Logo und Titel, dafür mit „Zurück“ und „+“.
 */
@Component({
  selector: 'app-kopfzeile',
  imports: [Glocke, Logo, Nutzermenue, RouterLink, ZurueckLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kopfzeile.html',
  styleUrl: './kopfzeile.scss',
  host: {
    '[class.app]': "variante() === 'app'",
    // Die Toasts stehen darunter (shared/benachrichtigungen).
    'data-kopf': '',
    '[class.menue-offen]': 'menueOffen()',
    '[class.getrennt]': 'ausrichtung().getrennt',
    '[style.--kopf-luecke.px]': 'ausrichtung().luecke',
  },
})
export class Kopfzeile {
  readonly variante = input<'app' | 'einfach'>('einfach');

  protected readonly aktionen = inject(Seitenaktionen).aktionen;
  protected readonly angemeldet = inject(AuthService).angemeldet;
  protected readonly glockeOffen = signal(false);
  protected readonly nutzerOffen = signal(false);
  /** Center oder Nutzermenü offen: bis 900 px über die Tab-Leiste heben. */
  protected readonly menueOffen = computed(() => this.glockeOffen() || this.nutzerOffen());
  protected readonly ausrichtung = signal({ luecke: 0, getrennt: false });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly rechts = viewChild<ElementRef<HTMLElement>>('rechts');

  constructor() {
    // Gemessen, weil das Nutzermenü je nach Vorname unterschiedlich breit ist.
    const beobachter =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.messen());
    inject(DestroyRef).onDestroy(() => beobachter?.disconnect());
    afterRenderEffect(() => {
      const rechts = this.rechts()?.nativeElement;
      beobachter?.disconnect();
      beobachter?.observe(this.host.nativeElement);
      if (rechts) {
        beobachter?.observe(rechts);
      }
      this.messen();
    });
  }

  private messen(): void {
    const rechts = this.rechts()?.nativeElement;
    const neu = kopfAusrichten(
      this.host.nativeElement.getBoundingClientRect().width,
      rechts ? rechts.getBoundingClientRect().width : null,
    );
    const alt = this.ausrichtung();
    if (neu.luecke !== alt.luecke || neu.getrennt !== alt.getrennt) {
      this.ausrichtung.set(neu);
    }
  }
}
