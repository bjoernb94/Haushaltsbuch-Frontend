import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Komponente } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { istVerfuegbar, KOMPONENTE_ICON } from '../../core/komponenten/komponente';
import { Logo } from '../../shared/logo/logo';
import { EINSTELLUNGEN, einstellungenStateBeobachten } from '../../shared/nutzermenue/nutzermenue';

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

/** Zahnrad wie im Nutzermenü. */
const EINSTELLUNGEN_ICON = [
  'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
] as const;

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

/** Warum ein Bereich ohne Link dasteht. */
type Inaktiv = 'Ausgeschaltet' | 'Demnächst verfügbar';

/**
 * Seitenleiste mit Logo und allen Bereichen, unten „Einstellungen“ und Copyright; bis 900 px als
 * Tab-Leiste unten, die Einstellungen dann über das Nutzermenü. Ausgeschaltete (nicht gebuchte) und
 * noch nicht verfügbare Bereiche stehen gedimmt ohne Link da.
 */
@Component({
  selector: 'app-hauptmenue',
  imports: [Logo, NgTemplateOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hauptmenue.html',
  styleUrl: './hauptmenue.scss',
})
export class Hauptmenue {
  private readonly auth = inject(AuthService);

  protected readonly uebersicht = UEBERSICHT;
  protected readonly einstellungen = EINSTELLUNGEN;
  protected readonly einstellungenState = einstellungenStateBeobachten();
  protected readonly einstellungenIcon = EINSTELLUNGEN_ICON;

  /** Ohne geladene Komponenten keine Bereiche: Die Shell zeigt dann einen Hinweis. */
  protected readonly bereiche = computed(() =>
    this.auth.komponentenFehler()
      ? []
      : BEREICHE.map((b) => ({ ...b, inaktiv: this.inaktiv(b.komponente) })),
  );

  private inaktiv(komponente: Komponente): Inaktiv | null {
    if (!this.auth.komponenten().includes(komponente)) {
      return 'Ausgeschaltet';
    }
    return istVerfuegbar(komponente) ? null : 'Demnächst verfügbar';
  }
}
