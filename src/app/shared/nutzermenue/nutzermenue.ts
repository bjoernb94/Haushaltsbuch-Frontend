import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  model,
  Signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { UngespeicherteEingaben } from '../../core/ungespeichert/ungespeicherte-eingaben';
import { HERKUNFT, herkunftAus } from '../herkunft/herkunft';
import { initialen } from './initialen';

export const EINSTELLUNGEN = '/einstellungen';

export function istEinstellungen(url: string): boolean {
  return /^\/einstellungen(?=[?#]|$)/.test(url);
}

/**
 * State für Links auf die Einstellungen (Injection-Kontext): die aktuelle Seite als Herkunft, wie bei
 * den rechtlichen Links. Auf den Einstellungen selbst bleibt die ursprüngliche Herkunft.
 */
export function einstellungenStateBeobachten(): Signal<Record<string, unknown>> {
  const router = inject(Router);
  const location = inject(Location);
  const url = toSignal(
    router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => router.url),
    ),
    { initialValue: router.url },
  );
  return computed(() => ({
    [HERKUNFT]: istEinstellungen(url())
      ? herkunftAus(location.getState(), istEinstellungen)
      : url(),
  }));
}

/**
 * Knopf mit den Initialen des Nutzers in der Kopfzeile, öffnet Name, E-Mail, „Einstellungen“ und
 * „Abmelden“; bis 640 px als Bottom-Sheet. Nicht modal wie im Design, daher schließt auch das
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
})
export class Nutzermenue {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ungespeichert = inject(UngespeicherteEingaben);

  private readonly knopf = viewChild<ElementRef<HTMLButtonElement>>('knopf');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly hintergrund = viewChild<ElementRef<HTMLButtonElement>>('hintergrund');

  protected readonly nutzer = this.auth.nutzer;
  /** Offen oder zu; die Kopfzeile hebt sich bis 900 px, solange es offen ist. */
  readonly offen = model(false);

  protected readonly einstellungen = EINSTELLUNGEN;
  protected readonly einstellungenState = einstellungenStateBeobachten();

  protected readonly initialen = computed(() => {
    const nutzer = this.nutzer();
    return nutzer ? initialen(nutzer.vorname, nutzer.name) : '';
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
