import { ChangeDetectionStrategy, Component, computed, inject, LOCALE_ID } from '@angular/core';
import { InstanzService } from '../../core/instanz/instanz.service';
import { Stand, VersionService } from '../../core/version/version.service';
import { DatumPipe } from '../../shared/format/datum.pipe';
import { zeitpunktText } from '../../shared/format/zeitpunkt';
import { HinweisBox } from '../../shared/hinweis-box/hinweis-box';
import { RechtlicherRahmen } from './rechtlicher-rahmen/rechtlicher-rahmen';

/** Version, Commit und Build-Zeit, soweit bekannt, z. B. „v0.1.0 · Commit 48eaea5 · Build …“. */
function standText({ version, commit, buildZeit }: Stand, locale: string): string {
  return [
    version ? `v${version}` : 'Version nicht bekannt',
    commit && `Commit ${commit}`,
    buildZeit && `Build ${zeitpunktText(buildZeit, locale)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

@Component({
  selector: 'app-impressum-seite',
  imports: [DatumPipe, HinweisBox, RechtlicherRahmen],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './impressum-seite.html',
  styleUrl: './impressum-seite.scss',
})
export class ImpressumSeite {
  private readonly locale = inject(LOCALE_ID);
  private readonly version = inject(VersionService);

  protected readonly instanz = inject(InstanzService);

  protected readonly frontend = standText(this.version.frontend, this.locale);
  protected readonly backend = computed(() => {
    const backend = this.version.backend();
    return backend ? standText(backend, this.locale) : 'nicht bekannt';
  });
}
