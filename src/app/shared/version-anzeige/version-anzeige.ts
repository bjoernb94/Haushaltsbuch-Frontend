import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { VersionService } from '../../core/version/version.service';

/**
 * Version des Frontends und Umgebung der Instanz, als erster Hinweis z. B. auf Screenshots von Fehlern.
 * Commit und Build-Zeit stehen im Impressum. Ohne Antwort des Backends fehlt nur das Badge.
 */
@Component({
  selector: 'app-version-anzeige',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="version">v{{ version.frontend.version }}</span>
    @if (version.stage(); as stage) {
      <span class="stage" [class.prod]="stage === 'PROD'"
        ><span class="sr-only">Umgebung </span>{{ stage }}</span
      >
    }`,
  styleUrl: './version-anzeige.scss',
})
export class VersionAnzeige {
  protected readonly version = inject(VersionService);
}
