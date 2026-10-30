import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { STARTSEITE } from '../../core/auth/auth.guards';
import { AuthService } from '../../core/auth/auth.service';
import { Komponente, KOMPONENTEN } from '../../core/komponenten/komponente';
import { systemstatusBeobachten } from '../../core/systemstatus/systemstatus.service';
import { AnmeldeRahmen } from '../../shared/anmelde-rahmen/anmelde-rahmen';
import { HinweisBox } from '../../shared/hinweis-box/hinweis-box';
import { SystemstatusLeiste } from '../../shared/systemstatus-leiste/systemstatus-leiste';
import { PASSWORT_REGELN } from './passwort-regeln';
import { Feld, registrierungPruefen, RegistrierungWerte } from './registrierung-pruefung';

const HINWEIS_GESPERRT = 'Registrierung gerade nicht möglich.';

const FEHLER_VERGEBEN = 'Für diese E-Mail-Adresse gibt es bereits ein Konto.';

const FEHLER_UNBEKANNT =
  'Die Registrierung ist gerade nicht möglich. Bitte versuche es später erneut.';

@Component({
  selector: 'app-registrierung-seite',
  imports: [ReactiveFormsModule, RouterLink, AnmeldeRahmen, HinweisBox, SystemstatusLeiste],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './registrierung-seite.html',
  styleUrl: './registrierung-seite.scss',
})
export class RegistrierungSeite {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly komponenten = KOMPONENTEN;

  protected readonly formular = this.fb.group({
    email: [''],
    passwort: [''],
    name: [''],
    vorname: [''],
    komponenten: this.fb.group(
      Object.fromEntries(KOMPONENTEN.map((k) => [k.wert, false])) as Record<Komponente, boolean>,
    ),
  });

  private readonly werte = toSignal(
    this.formular.valueChanges.pipe(map(() => this.aktuelleWerte())),
    { initialValue: this.aktuelleWerte() },
  );

  private readonly pruefung = computed(() => registrierungPruefen(this.werte()));

  /** Erst nach dem ersten Absenden werden fehlerhafte Felder markiert. */
  private readonly versucht = signal(false);

  /** Feld, das das Backend beanstandet hat (z. B. vergebene E-Mail-Adresse). */
  private readonly serverFeld = signal<Feld | null>(null);

  protected readonly fehler = signal<string | null>(null);
  protected readonly sendet = signal(false);

  /** Fehlt ein Dienst, ist die Registrierung gesperrt. */
  protected readonly systemstatus = systemstatusBeobachten();

  protected readonly hinweis = computed(() =>
    this.systemstatus.gesperrt() ? HINWEIS_GESPERRT : this.fehler(),
  );

  /** Abhakliste unter dem Passwortfeld; vor der ersten Eingabe neutral. */
  protected readonly passwortRegeln = computed(() => {
    const { passwort, email } = this.werte();
    return PASSWORT_REGELN.map((regel) => ({
      text: regel.text,
      zustand: !passwort ? 'offen' : regel.erfuellt(passwort, email) ? 'erfuellt' : 'verletzt',
    }));
  });

  protected readonly gewaehlt = computed(() => new Set(this.werte().komponenten));

  constructor() {
    // Wie im Design: Sobald der Nutzer etwas ändert, verschwindet die Fehlermeldung.
    this.formular.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.fehler.set(null);
      this.serverFeld.set(null);
    });
  }

  protected ungueltig(feld: Feld): boolean {
    return (this.versucht() && this.pruefung().felder.has(feld)) || this.serverFeld() === feld;
  }

  protected registrieren(): void {
    if (this.sendet() || this.systemstatus.gesperrt()) {
      return;
    }
    this.versucht.set(true);
    const meldung = this.pruefung().meldung;
    if (meldung) {
      this.fehler.set(meldung);
      return;
    }

    const w = this.werte();
    this.sendet.set(true);
    this.auth
      .registrieren({
        email: w.email.trim(),
        passwort: w.passwort,
        name: w.name.trim(),
        vorname: w.vorname.trim(),
        komponenten: w.komponenten,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (angemeldet) =>
          void (angemeldet
            ? this.router.navigateByUrl(STARTSEITE)
            : this.router.navigate(['/login'], { queryParams: { registriert: true } })),
        error: (error: unknown) => {
          this.sendet.set(false);
          this.serverFehlerAnzeigen(error);
        },
      });
  }

  private serverFehlerAnzeigen(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.fehler.set(FEHLER_VERGEBEN);
      this.serverFeld.set('email');
    } else if (
      error instanceof HttpErrorResponse &&
      error.status === 400 &&
      typeof error.error?.detail === 'string'
    ) {
      // Z. B. Passwort-Richtlinie von Keycloak (Text vom Backend).
      this.fehler.set(error.error.detail);
    } else {
      this.fehler.set(FEHLER_UNBEKANNT);
    }
  }

  private aktuelleWerte(): RegistrierungWerte {
    const { komponenten, ...rest } = this.formular.getRawValue();
    return {
      ...rest,
      komponenten: KOMPONENTEN.map((k) => k.wert).filter((wert) => komponenten[wert]),
    };
  }
}
