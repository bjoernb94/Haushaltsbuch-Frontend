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
import { STARTSEITE } from '../../../core/auth/auth.guards';
import { AuthService } from '../../../core/auth/auth.service';
import { problemCode, problemFelder } from '../../../core/fehler/problem';
import { Komponente } from '../../../core/api/api';
import { KOMPONENTEN } from '../../../core/komponenten/komponente';
import { systemstatusBeobachten } from '../../../core/systemstatus/systemstatus.service';
import { AnmeldeRahmen } from '../anmelde-rahmen/anmelde-rahmen';
import { HinweisBox } from '../../../shared/hinweis-box/hinweis-box';
import { SystemstatusLeiste } from '../../../shared/systemstatus-leiste/systemstatus-leiste';
import { PASSWORT_REGELN } from './passwort-regeln';
import { Feld, FELDER, registrierungPruefen, RegistrierungWerte } from './registrierung-pruefung';

const HINWEIS_GESPERRT = 'Registrierung gerade nicht möglich.';

const FEHLER_VERGEBEN = 'Für diese E-Mail-Adresse gibt es bereits ein Konto.';

const FEHLER_ABGELEHNT =
  'Das Konto konnte mit diesen Daten nicht angelegt werden. Bitte prüfe deine Eingaben, vor allem das Passwort.';

const FEHLER_VALIDIERUNG = 'Bitte prüfe die markierten Felder.';

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

  /** Felder, die das Backend beanstandet hat (z. B. vergebene E-Mail-Adresse). */
  private readonly serverFelder = signal<ReadonlySet<Feld>>(new Set());

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
      this.serverFelder.set(new Set());
    });
  }

  protected ungueltig(feld: Feld): boolean {
    return (this.versucht() && this.pruefung().felder.has(feld)) || this.serverFelder().has(feld);
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
    switch (problemCode(error)) {
      case 'EMAIL_BEREITS_VERGEBEN':
        this.fehler.set(FEHLER_VERGEBEN);
        this.serverFelder.set(new Set(['email']));
        break;
      case 'REGISTRIERUNG_ABGELEHNT':
        // Z. B. Passwort-Richtlinie von Keycloak; welche Regel, sagt das Backend noch nicht.
        this.fehler.set(FEHLER_ABGELEHNT);
        break;
      case 'VALIDIERUNG':
        this.fehler.set(FEHLER_VALIDIERUNG);
        this.serverFelder.set(
          new Set(FELDER.filter((feld) => problemFelder(error).some((f) => f.feld === feld))),
        );
        break;
      default:
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
