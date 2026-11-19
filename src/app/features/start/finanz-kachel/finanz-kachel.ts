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
import { Kachel } from '../kachel/kachel';

/** Feste Höhe einer Buchungszeile, wie im Design. */
export const ZEILENHOEHE = 45;
/** Neben einer anderen Karte mindestens so viele Buchungen. */
export const MINDESTENS = 3;
/** Allein in der Zeile (Handy, schmales Fenster) fest so viele. */
export const ALLEIN = 5;

/** Beispielwerte, bis das Backend die letzten Buchungen liefert. */
const BUCHUNGEN = [
  { text: 'Gehalt', datum: '28.10.', betrag: '+3.450,00 €', plus: true },
  { text: 'Supermarkt', datum: '27.10.', betrag: '−86,40 €', plus: false },
  { text: 'Tanken', datum: '24.10.', betrag: '−62,10 €', plus: false },
  { text: 'Drogerie', datum: '22.10.', betrag: '−23,85 €', plus: false },
  { text: 'Strom', datum: '20.10.', betrag: '−92,00 €', plus: false },
  { text: 'Restaurant', datum: '18.10.', betrag: '−54,30 €', plus: false },
  { text: 'Nebenjob', datum: '15.10.', betrag: '+400,00 €', plus: true },
  { text: 'Supermarkt', datum: '11.10.', betrag: '−71,25 €', plus: false },
  { text: 'Fitnessstudio', datum: '01.10.', betrag: '−34,90 €', plus: false },
  { text: 'Miete', datum: '01.10.', betrag: '−980,00 €', plus: false },
];

/**
 * Kachel „Finanzübersicht“ (noch Platzhalter). Die Buchungen füllen den Platz, den die Nachbarkarte
 * in der Zeile vorgibt, zählen selbst aber nicht zur Höhe: so viele, wie vollständig passen, mindestens
 * {@link MINDESTENS}; allein in der Zeile fest {@link ALLEIN}. Wie viele passen, ist reine Darstellung
 * (ADR 0010).
 */
@Component({
  selector: 'app-finanz-kachel',
  imports: [Kachel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finanz-kachel.html',
  styleUrl: './finanz-kachel.scss',
})
export class FinanzKachel {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly platz = viewChild.required<ElementRef<HTMLElement>>('platz');

  protected readonly allein = signal(true);
  private readonly anzahl = signal(ALLEIN);

  protected readonly buchungen = computed(() => BUCHUNGEN.slice(0, this.anzahl()));
  protected readonly mindesthoehe = computed(
    () => (this.allein() ? ALLEIN : MINDESTENS) * ZEILENHOEHE,
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const beobachter = new ResizeObserver(() => this.messen());
      beobachter.observe(this.platz().nativeElement);
      const raster = this.element.nativeElement.parentElement;
      if (raster) {
        beobachter.observe(raster);
      }
      destroyRef.onDestroy(() => beobachter.disconnect());
    });
  }

  private messen(): void {
    const karte = this.element.nativeElement;
    const raster = karte.parentElement;
    // Mehr als drei Viertel des Rasters: keine Karte daneben.
    const allein = !raster || karte.offsetWidth > raster.clientWidth * 0.75;
    // Ungerundet: clientHeight rundet auf und ließe die letzte Zeile um Bruchteile eines Pixels anschneiden.
    const hoehe = this.platz().nativeElement.getBoundingClientRect().height;
    const passen = Math.floor(hoehe / ZEILENHOEHE);
    this.allein.set(allein);
    this.anzahl.set(allein ? ALLEIN : Math.min(BUCHUNGEN.length, Math.max(MINDESTENS, passen)));
  }
}
