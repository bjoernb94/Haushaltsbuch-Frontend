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
import { AuthService } from '../../../core/auth/auth.service';
import { problemCode } from '../../../core/fehler/problem';
import { systemstatusBeobachten } from '../../../core/systemstatus/systemstatus.service';
import { AnmeldeRahmen } from '../anmelde-rahmen/anmelde-rahmen';
import { HinweisBox } from '../../../shared/hinweis-box/hinweis-box';
import { SystemstatusLeiste } from '../../../shared/systemstatus-leiste/systemstatus-leiste';

const FEHLER_UNVOLLSTAENDIG = 'Bitte gib E-Mail-Adresse und Passwort ein.';

const FEHLERTEXTE: Record<string, string> = {
  ANMELDUNG_UNGUELTIG: 'E-Mail-Adresse oder Passwort ist falsch. Bitte versuche es erneut.',
  ANMELDUNG_GESPERRT: 'Das Konto ist gesperrt. Bitte versuche es später erneut.',
  ANMELDUNG_NICHT_EINGERICHTET: 'Das Konto ist noch nicht vollständig eingerichtet.',
  VALIDIERUNG: FEHLER_UNVOLLSTAENDIG,
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

  /** Rote Felder nur, wenn es an den Eingaben liegt, nicht z. B. bei gesperrtem Konto. */
  protected readonly eingabenFalsch = signal(false);

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
    this.formular.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.fehler.set(null);
      this.eingabenFalsch.set(false);
    });
  }

  protected anmelden(): void {
    if (this.sendet() || this.systemstatus.gesperrt()) {
      return;
    }
    const { email, passwort } = this.formular.getRawValue();
    if (!email.trim() || !passwort) {
      this.fehler.set(FEHLER_UNVOLLSTAENDIG);
      this.eingabenFalsch.set(true);
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
          const code = problemCode(error);
          this.fehler.set(FEHLERTEXTE[code ?? ''] ?? FEHLER_UNBEKANNT);
          this.eingabenFalsch.set(code === 'ANMELDUNG_UNGUELTIG' || code === 'VALIDIERUNG');
        },
      });
  }
}
