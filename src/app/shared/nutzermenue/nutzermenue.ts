import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { UngespeicherteEingaben } from '../../core/ungespeichert/ungespeicherte-eingaben';
import { HERKUNFT, herkunftAus } from '../herkunft/herkunft';

export const EINSTELLUNGEN = '/einstellungen';

export function istEinstellungen(url: string): boolean {
  return /^\/einstellungen(?=[?#]|$)/.test(url);
}

/** Nutzt Graphem-Cluster, damit Akzente in zerlegter Form und Emojis ganz bleiben. */
const ZEICHEN = new Intl.Segmenter('de', { granularity: 'grapheme' });

function erstesZeichen(text: string): string {
  const [erstes] = ZEICHEN.segment(text.trim());
  return erstes?.segment ?? '';
}

/**
 * Knopf mit den Initialen des Nutzers, öffnet Name, E-Mail, „Einstellungen“ und „Abmelden“; bis 640 px
 * als Bottom-Sheet, in der Seitenleiste nach oben. Nicht modal wie im Design, daher schließt auch das
 * Verlassen per Tab. Liegt nicht in der Shell, weil auch Seiten außerhalb sie zeigen. Eine Rückfrage
 * zum Abmelden stellt der {@code VerwerfenDialog} der Shell; außerhalb gibt es keine Formulare, die
 * fragen müssten.
 */
@Component({
  selector: 'app-nutzermenue',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nutzermenue.html',
  styleUrl: './nutzermenue.scss',
  host: { '[class.seitenleiste]': 'seitenleiste()' },
})
export class Nutzermenue {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ungespeichert = inject(UngespeicherteEingaben);
  private readonly location = inject(Location);

  /** Ab 901 px unten in der Seitenleiste statt in der Kopfzeile. */
  readonly seitenleiste = input(false);

  private readonly knopf = viewChild<ElementRef<HTMLButtonElement>>('knopf');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly hintergrund = viewChild<ElementRef<HTMLButtonElement>>('hintergrund');

  protected readonly nutzer = this.auth.nutzer;
  /** Offen oder zu; die Kopfzeile hebt sich bis 900 px, solange es offen ist. */
  readonly offen = model(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly einstellungen = EINSTELLUNGEN;

  /** Wie bei den rechtlichen Links: Auf den Einstellungen selbst bleibt die ursprüngliche Herkunft. */
  protected readonly einstellungenState = computed(() => {
    const url = this.url();
    return {
      [HERKUNFT]: istEinstellungen(url)
        ? herkunftAus(this.location.getState(), istEinstellungen)
        : url,
    };
  });

  protected readonly initialen = computed(() => {
    const nutzer = this.nutzer();
    return nutzer
      ? (erstesZeichen(nutzer.vorname) + erstesZeichen(nutzer.name)).toLocaleUpperCase('de')
      : '';
  });

  constructor() {
    effect(() => this.panel()?.nativeElement.focus());

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.offen()) {
          this.schliessen();
        }
      });
  }

  protected umschalten(): void {
    this.offen.update((offen) => !offen);
  }

  protected schliessen(): void {
    this.offen.set(false);
    this.knopf()?.nativeElement.focus();
  }

  /**
   * Ohne Ziel hat das Fenster den Fokus verloren, das Panel bleibt offen. Der Hintergrund bekommt den
   * Fokus beim Klick; schließen soll dann der Klick selbst, damit der Fokus zurück zum Knopf geht.
   */
  protected fokusVerlassen(event: FocusEvent): void {
    const ziel = event.relatedTarget;
    if (
      ziel instanceof Node &&
      !this.panel()?.nativeElement.contains(ziel) &&
      ziel !== this.hintergrund()?.nativeElement
    ) {
      this.offen.set(false);
    }
  }

  protected async abmelden(): Promise<void> {
    // Erst schließen: Die Rückfrage gibt den Fokus beim Schließen dorthin zurück, wo er vorher war.
    this.schliessen();
    // Vor dem Abmelden fragen: Danach wäre die Sitzung schon fort, wenn der Guard beim Seitenwechsel fragt.
    if (!(await this.ungespeichert.bestaetigen())) {
      return;
    }
    // Auch wenn das Backend nicht antwortet, ist der Nutzer im Frontend abgemeldet.
    this.auth.abmelden().subscribe({
      complete: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }
}
