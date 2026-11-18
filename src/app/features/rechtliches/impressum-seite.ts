import { ChangeDetectionStrategy, Component, computed, inject, LOCALE_ID } from '@angular/core';
import { InstanzService } from '../../core/instanz/instanz.service';
import { Stand, VersionService } from '../../core/version/version.service';
import { DatumPipe } from '../../shared/format/datum.pipe';
import { zeitpunktText } from '../../shared/format/zeitpunkt';
import { HinweisBox } from '../../shared/hinweis-box/hinweis-box';
import { RechtlicherRahmen } from './rechtlicher-rahmen/rechtlicher-rahmen';

/** Repos dieser Anwendung; ein Fork ersetzt sie über `quellcode` in der instanz.json. */
export const QUELLCODE = {
  frontend: 'https://github.com/bjoernb94/Haushaltsbuch-Frontend',
  backend: 'https://github.com/bjoernb94/Haushaltsbuch-Backend',
};

export const LIZENZ_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';

/**
 * Link zum Quellcode: ein eigener des Betreibers unverändert, sonst das Repo, mit bekanntem Commit genau
 * dieser Stand. Der Text nennt immer nur die Adresse ohne Schema.
 */
function quellcodeLink(standard: string, commit: string | undefined, eigener: string | undefined) {
  const href =
    eigener ??
    (commit && /^[0-9a-f]{7,40}$/.test(commit) ? `${standard}/tree/${commit}` : standard);
  return { href, text: (eigener ?? standard).replace(/^https?:\/\//, '') };
}

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

  protected readonly lizenzUrl = LIZENZ_URL;

  /** Fehlt nur beim Laden, damit ein Fork nicht kurz auf dieses Repo verweist. */
  protected readonly quellcode = computed(() => {
    const stand = this.instanz.stand();
    if (stand.zustand === 'laedt') {
      return undefined;
    }
    const eigener = stand.zustand === 'fehler' ? {} : stand.quellcode;
    return {
      frontend: quellcodeLink(QUELLCODE.frontend, this.version.frontend.commit, eigener.frontend),
      backend: quellcodeLink(QUELLCODE.backend, this.version.backend()?.commit, eigener.backend),
    };
  });
}
