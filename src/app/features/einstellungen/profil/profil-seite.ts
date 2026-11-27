import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { initialen } from '../../../shared/nutzermenue/initialen';
import { zurueckZuEinstellungen } from '../unterseite';

/**
 * Profil, nur zum Nachsehen: Name und E-Mail-Adresse aus der Registrierung, wie sie {@code AuthService}
 * schon hält. Ändern kommt mit #8.
 */
@Component({
  selector: 'app-profil-seite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profil-seite.html',
  styleUrl: './profil-seite.scss',
})
export class ProfilSeite {
  protected readonly nutzer = inject(AuthService).nutzer;

  protected readonly initialen = computed(() => {
    const nutzer = this.nutzer();
    return nutzer ? initialen(nutzer.vorname, nutzer.name) : '';
  });

  constructor() {
    zurueckZuEinstellungen('Profil');
  }
}
