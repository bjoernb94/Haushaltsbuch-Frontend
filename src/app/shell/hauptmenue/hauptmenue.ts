import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Komponente } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { istVerfuegbar } from '../../core/komponenten/komponente';

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
    icon: [
      'M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
      'M3 10h18',
      'M7 15h3',
    ],
  },
  {
    komponente: 'VERTRAGSUEBERSICHT',
    pfad: '/vertraege',
    label: 'Verträge',
    icon: [
      'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z',
      'M14 3v5h5',
      'M9 13h6',
      'M9 17h4',
    ],
  },
  {
    komponente: 'VERSORGUNGSVERTRAEGE',
    pfad: '/versorgung',
    label: 'Versorgungsverträge',
    kurz: 'Versorgung',
    icon: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  },
  {
    komponente: 'PORTFOLIO',
    pfad: '/portfolio',
    label: 'Portfolio',
    icon: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
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
