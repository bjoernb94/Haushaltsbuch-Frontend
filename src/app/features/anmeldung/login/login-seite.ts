import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { sichereRuecksprungUrl } from '../../../core/auth/auth.guards';
import {
  AnmeldungFehlgrund,
  anmeldungFehlgrund,
  AuthService,
} from '../../../core/auth/auth.service';
import { systemstatusBeobachten } from '../../../core/systemstatus/systemstatus.service';
import { AnmeldeRahmen } from '../anmelde-rahmen/anmelde-rahmen';
import { HinweisBox } from '../../../shared/hinweis-box/hinweis-box';
import { SystemstatusLeiste } from '../../../shared/systemstatus-leiste/systemstatus-leiste';

const FEHLERTEXTE: Record<AnmeldungFehlgrund, string> = {
  UNGUELTIG: 'E-Mail-Adresse oder Passwort ist falsch. Bitte versuche es erneut.',
  GESPERRT: 'Das Konto ist gesperrt. Bitte versuche es später erneut.',
  NICHT_EINGERICHTET: 'Das Konto ist noch nicht vollständig eingerichtet.',
};

const FEHLER_UNBEKANNT = 'Die Anmeldung ist gerade nicht möglich. Bitte versuche es später erneut.';

const HINWEIS_GESPERRT = 'Login gerade nicht möglich.';

const HINWEIS_REGISTRIERT = 'Dein Konto wurde angelegt. Bitte melde dich an.';

@Component({
  selector: 'app-login-seite',
  imports: [ReactiveFormsModule, RouterLink, AnmeldeRahmen, HinweisBox, SystemstatusLeiste],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-seite.html',
  styleUrl: './login-seite.scss',
})
export class LoginSeite {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Seite, auf die der Nutzer vor der Anmeldung wollte (Query-Parameter). */
  readonly returnUrl = input<string>();

  /** Gesetzt nach einer Registrierung, bei der die automatische Anmeldung gescheitert ist. */
  readonly registriert = input(false, { transform: booleanAttribute });

  protected readonly formular = inject(NonNullableFormBuilder).group({
    email: ['', Validators.required],
    passwort: ['', Validators.required],
  });

  protected readonly fehler = signal<string | null>(null);
  protected readonly sendet = signal(false);

  /** Fehlt ein Dienst, sind Login und Registrierung gesperrt. */
  protected readonly systemstatus = systemstatusBeobachten();

  protected readonly fehlerHinweis = computed(() =>
    this.systemstatus.gesperrt() ? HINWEIS_GESPERRT : this.fehler(),
  );

  protected readonly infoHinweis = computed(() =>
    this.registriert() && !this.fehlerHinweis() ? HINWEIS_REGISTRIERT : null,
  );

  constructor() {
    // Wie im Design: Sobald der Nutzer tippt, verschwindet die Fehlermeldung.
    this.formular.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.fehler.set(null));
  }

  protected anmelden(): void {
    if (this.sendet() || this.systemstatus.gesperrt()) {
      return;
    }
    const { email, passwort } = this.formular.getRawValue();
    if (!email.trim() || !passwort) {
      this.fehler.set('Bitte gib E-Mail-Adresse und Passwort ein.');
      return;
    }

    this.sendet.set(true);
    this.auth
      .anmelden(email.trim(), passwort)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigateByUrl(sichereRuecksprungUrl(this.returnUrl())),
        error: (error: unknown) => {
          this.sendet.set(false);
          const grund = anmeldungFehlgrund(error);
          this.fehler.set(grund ? FEHLERTEXTE[grund] : FEHLER_UNBEKANNT);
        },
      });
  }
}
