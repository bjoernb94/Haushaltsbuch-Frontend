import { Location } from '@angular/common';
import { computed, Directive, inject, input } from '@angular/core';
import { Router, UrlTree } from '@angular/router';

/**
 * Link für „Zurück“: zeigt auf {@code ziel} (auch für Mittelklick und neuen Tab), geht beim Klick mit
 * {@code verlauf} aber im Verlauf zurück. So landet man auf genau dem Eintrag, von dem man kam, samt
 * seinem State (z. B. der Herkunft der Einstellungen); ein {@code RouterLink} legte einen neuen an.
 */
@Directive({
  selector: 'a[appZurueckLink]',
  host: { '[attr.href]': 'href()', '(click)': 'klicken($event)' },
})
export class ZurueckLink {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly ziel = input.required<string | UrlTree>({ alias: 'appZurueckLink' });
  readonly verlauf = input(false);

  protected readonly href = computed(() =>
    this.location.prepareExternalUrl(this.router.serializeUrl(this.urlTree())),
  );

  protected klicken(event: MouseEvent): void {
    // Wie beim RouterLink: Mit Zusatztaste oder anderer Maustaste macht der Browser es selbst.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (this.verlauf()) {
      this.location.back();
    } else {
      void this.router.navigateByUrl(this.urlTree());
    }
  }

  private urlTree(): UrlTree {
    const ziel = this.ziel();
    return typeof ziel === 'string' ? this.router.parseUrl(ziel) : ziel;
  }
}
