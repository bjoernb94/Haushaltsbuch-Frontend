import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';

/** Schlüssel im Navigations-State: Seite, zu der „Zurück“ auf Impressum und Datenschutz führt. */
export const HERKUNFT = 'herkunft';

export function istRechtlich(url: string): boolean {
  return /^\/(impressum|datenschutz)(?=[?#]|$)/.test(url);
}

/** Nur eigene Pfade außerhalb von Impressum und Datenschutz, nichts von außen. */
export function herkunftAus(state: unknown): string | undefined {
  const herkunft = (state as Record<string, unknown> | null | undefined)?.[HERKUNFT];
  return typeof herkunft === 'string' &&
    herkunft.startsWith('/') &&
    !herkunft.startsWith('//') &&
    !istRechtlich(herkunft)
    ? herkunft
    : undefined;
}

/**
 * Links zu Impressum und Datenschutz. Sie geben die aktuelle Seite als Herkunft mit; zwischen
 * Impressum und Datenschutz bleibt die ursprüngliche Herkunft erhalten.
 */
@Component({
  selector: 'app-rechtliche-links',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav aria-label="Rechtliches">
    <a
      routerLink="/impressum"
      [state]="state()"
      routerLinkActive="aktiv"
      ariaCurrentWhenActive="page"
      >Impressum</a
    >
    <a
      routerLink="/datenschutz"
      [state]="state()"
      routerLinkActive="aktiv"
      ariaCurrentWhenActive="page"
      >Datenschutz</a
    >
  </nav>`,
  styleUrl: './rechtliche-links.scss',
})
export class RechtlicheLinks {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly state = computed(() => {
    const url = this.url();
    return { [HERKUNFT]: istRechtlich(url) ? herkunftAus(this.location.getState()) : url };
  });
}
