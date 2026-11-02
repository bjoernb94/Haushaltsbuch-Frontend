import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Komponente } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { istVerfuegbar, KOMPONENTE_ICON } from '../../core/komponenten/komponente';

interface NavEintrag {
  pfad: string;
  label: string;
  /** Für die Leiste auf dem Handy, falls {@code label} dort zu lang ist. */
  kurz?: string;
  /** Pfade des Icons, wie im Design. */
  icon: readonly string[];
}

const UEBERSICHT: NavEintrag = {
  pfad: '/start',
  label: 'Übersicht',
  icon: ['M4 11l8-7 8 7', 'M6 10v10h12V10'],
};

const BEREICHE: readonly (NavEintrag & { komponente: Komponente })[] = [
  {
    komponente: 'FINANZUEBERSICHT',
    pfad: '/buchungen',
    label: 'Finanzübersicht',
    kurz: 'Finanzen',
    icon: KOMPONENTE_ICON.FINANZUEBERSICHT,
  },
  {
    komponente: 'VERTRAGSUEBERSICHT',
    pfad: '/vertraege',
    label: 'Verträge',
    icon: KOMPONENTE_ICON.VERTRAGSUEBERSICHT,
  },
  {
    komponente: 'VERSORGUNGSVERTRAEGE',
    pfad: '/versorgung',
    label: 'Versorgungsverträge',
    kurz: 'Versorgung',
    icon: KOMPONENTE_ICON.VERSORGUNGSVERTRAEGE,
  },
  {
    komponente: 'PORTFOLIO',
    pfad: '/portfolio',
    label: 'Portfolio',
    icon: KOMPONENTE_ICON.PORTFOLIO,
  },
];

/** Seitennavigation der Bereiche, unter 900 px als Leiste unten. */
@Component({
  selector: 'app-hauptmenue',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hauptmenue.html',
  styleUrl: './hauptmenue.scss',
})
export class Hauptmenue {
  private readonly auth = inject(AuthService);

  protected readonly uebersicht = UEBERSICHT;

  /** Nur gebuchte Bereiche; noch nicht verfügbare erscheinen ohne Link. */
  protected readonly bereiche = computed(() =>
    BEREICHE.filter((b) => this.auth.komponenten().includes(b.komponente)).map((b) => ({
      ...b,
      demnaechst: !istVerfuegbar(b.komponente),
    })),
  );
}
