import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VersionService } from './core/version/version.service';

/**
 * Außerhalb von PROD steht über jeder Seite ein Streifen mit der Umgebung. Seine Höhe steht in
 * {@code --app-streifen-hoehe}, damit Seiten mit voller Höhe nicht scrollen.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (streifen(); as stage) {
      <p class="streifen">{{ stage }}-Umgebung · keine echten Daten eingeben</p>
    }
    <router-outlet />`,
  styleUrl: './app.scss',
  host: { '[style.--app-streifen-hoehe]': "streifen() ? '24px' : null" },
})
export class App {
  private readonly version = inject(VersionService);

  protected readonly streifen = computed(() => {
    const stage = this.version.stage();
    return stage && stage !== 'PROD' ? stage : undefined;
  });
}
