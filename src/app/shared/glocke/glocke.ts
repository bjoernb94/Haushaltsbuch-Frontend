import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  model,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { Benachrichtigungen } from '../../core/benachrichtigungen/benachrichtigungen';
import { Meldungscenter } from './meldungscenter';

/**
 * Glocke in der Kopfzeile mit dem Zähler der ungelesenen Meldungen (ab 10 „9+“); öffnet das
 * Meldungscenter. Nicht modal wie das Nutzermenü: Esc, ein Klick daneben, das Verlassen per Tab und
 * ein Seitenwechsel schließen es.
 */
@Component({
  selector: 'app-glocke',
  imports: [Meldungscenter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './glocke.html',
  styleUrl: './glocke.scss',
})
export class Glocke {
  private readonly benachrichtigungen = inject(Benachrichtigungen);

  /** Offen oder zu; die Kopfzeile hebt sich bis 900 px, solange es offen ist. */
  readonly offen = model(false);

  private readonly knopf = viewChild.required<ElementRef<HTMLButtonElement>>('knopf');

  protected readonly ungelesen = this.benachrichtigungen.ungelesen;
  protected readonly zaehler = computed(() =>
    this.ungelesen() > 9 ? '9+' : String(this.ungelesen()),
  );
  protected readonly label = computed(() =>
    this.ungelesen() ? `Benachrichtigungen, ${this.ungelesen()} ungelesen` : 'Benachrichtigungen',
  );

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.offen.set(false));
  }

  protected umschalten(): void {
    this.offen.update((offen) => !offen);
  }

  protected schliessen(): void {
    this.offen.set(false);
    this.knopf().nativeElement.focus();
  }
}
