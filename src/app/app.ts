import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VersionService } from './core/version/version.service';
import { Toasts } from './shared/benachrichtigungen/toasts';

/**
 * Außerhalb von PROD steht über jeder Seite ein Streifen mit der Umgebung. Seine Höhe steht in
 * {@code --app-streifen-hoehe}, damit Seiten mit voller Höhe nicht scrollen; er bleibt beim Scrollen
 * oben stehen, die sticky Teile darunter ziehen ihn ab. Die Toasts stehen hier einmal für alle Seiten, so ist
 * ihre Live-Region vor der ersten Meldung da.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (streifen(); as stage) {
      <p class="streifen">{{ stage }}-Umgebung · keine echten Daten eingeben</p>
    }
    <router-outlet />
    <app-toasts />`,
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
