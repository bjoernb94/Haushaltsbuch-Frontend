import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  LOCALE_ID,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Benachrichtigungen, Eintrag } from '../../core/benachrichtigungen/benachrichtigungen';
import { ART_TEXT, MeldungSymbol } from '../benachrichtigungen/meldung-symbol';
import { vergangenText } from '../format/vergangen';

/** Die Zeitangaben laufen mit, solange das Center offen ist. */
const TAKT = 60_000;

/**
 * Meldungscenter hinter der Glocke, solange es offen ist: neueste zuerst, ungelesene hervorgehoben,
 * je Eintrag „als gelesen markieren“ und „entfernen“, dazu „Alle als gelesen“ und „Alle entfernen“.
 * Bis 640 px ein Blatt von unten. Bekommt beim Öffnen den Fokus und behält ihn nach jeder Aktion.
 */
@Component({
  selector: 'app-meldungscenter',
  imports: [MeldungSymbol, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './meldungscenter.html',
  styleUrl: './meldungscenter.scss',
})
export class Meldungscenter {
  private readonly locale = inject(LOCALE_ID);
  protected readonly benachrichtigungen = inject(Benachrichtigungen);
  protected readonly artText = ART_TEXT;

  /** Esc, ×, Klick daneben: schließen, der Fokus geht zurück zur Glocke. */
  readonly schliessen = output();
  /** Der Fokus hat das Center verlassen (Tab): schließen, ohne ihn zurückzuholen. */
  readonly verlassen = output();

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly hintergrund = viewChild.required<ElementRef<HTMLButtonElement>>('hintergrund');

  private readonly jetzt = signal(Date.now());

  protected readonly ungelesen = this.benachrichtigungen.ungelesen;
  protected readonly zusammenfassung = computed(() => {
    if (!this.benachrichtigungen.eintraege().length) {
      return 'Keine Meldungen';
    }
    return this.ungelesen() ? `${this.ungelesen()} ungelesen` : 'Alles gelesen';
  });

  constructor() {
    afterNextRender(() => this.zumPanel());
    const takt = setInterval(() => this.jetzt.set(Date.now()), TAKT);
    inject(DestroyRef).onDestroy(() => clearInterval(takt));
  }

  protected wann(eintrag: Eintrag): string {
    return vergangenText(eintrag.zeit, this.jetzt(), this.locale);
  }

  // Nach jeder Aktion bleibt der Fokus im Center, auch wenn ihr Knopf verschwindet.

  protected gelesen(eintrag: Eintrag): void {
    this.benachrichtigungen.gelesen(eintrag.id);
    this.zumPanel();
  }

  protected entfernen(eintrag: Eintrag): void {
    this.benachrichtigungen.entfernen(eintrag.id);
    this.zumPanel();
  }

  protected alleGelesen(): void {
    this.benachrichtigungen.alleGelesen();
    this.zumPanel();
  }

  protected alleEntfernen(): void {
    this.benachrichtigungen.alleEntfernen();
    this.zumPanel();
  }

  /** Dem Link folgen: gelesen; das Center schließt mit der Navigation. */
  protected oeffnen(eintrag: Eintrag): void {
    this.benachrichtigungen.gelesen(eintrag.id);
  }

  /** Wie beim Nutzermenü: Ohne Ziel hat das Fenster den Fokus verloren, das Center bleibt offen. */
  protected fokusVerlassen(event: FocusEvent): void {
    const ziel = event.relatedTarget;
    if (
      ziel instanceof Node &&
      !this.panel().nativeElement.contains(ziel) &&
      ziel !== this.hintergrund().nativeElement
    ) {
      this.verlassen.emit();
    }
  }

  private zumPanel(): void {
    this.panel().nativeElement.focus();
  }
}
