import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, of, timeout } from 'rxjs';
import { version } from '../../../../package.json';

/** Version, Commit und Build-Zeit eines Teils der Anwendung, soweit bekannt. */
export interface Stand {
  version?: string;
  commit?: string;
  buildZeit?: string;
}

/** Ausschnitt von /actuator/info; steht nicht in openapi.json (siehe docs/api.md im Backend). */
interface InfoAntwort {
  build?: { version?: string; time?: string };
  git?: { commit?: { id?: string } };
  app?: { stage?: string };
}

export const INFO_URL = '/actuator/info';

/** Wie beim Systemstatus: Hängt das Backend, gilt das wie keine Antwort. */
const ANTWORT_TIMEOUT_MS = 5_000;

// Setzt der Image-Build per --define (Containerfile); bei npm start und ohne Angaben fehlen sie.
declare const HAUSHALTSBUCH_COMMIT: string | undefined;
declare const HAUSHALTSBUCH_BUILD_ZEIT: string | undefined;

const definiert = (wert: string | undefined) => wert || undefined;

/** Die Version kommt beim Build aus der package.json und fehlt deshalb nie. */
export const FRONTEND: Stand & { version: string } = {
  version,
  commit: definiert(typeof HAUSHALTSBUCH_COMMIT === 'string' ? HAUSHALTSBUCH_COMMIT : undefined),
  buildZeit: definiert(
    typeof HAUSHALTSBUCH_BUILD_ZEIT === 'string' ? HAUSHALTSBUCH_BUILD_ZEIT : undefined,
  ),
};

/**
 * Version und Umgebung (Stage) der Instanz. Die Angaben des Backends kommen aus /actuator/info, öffentlich
 * und ohne Session. Ohne Antwort bleiben sie leer; {@link laden} versucht es dann beim nächsten Aufruf neu.
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly http = inject(HttpClient);

  private readonly info = signal<InfoAntwort | undefined>(undefined);
  private laedt = false;

  readonly frontend = FRONTEND;

  /** Fehlt, solange keine Antwort da ist; einzelne Angaben fehlen z. B. beim Start aus der IDE. */
  readonly backend = computed<Stand | undefined>(() => {
    const info = this.info();
    return (
      info && {
        version: info.build?.version,
        commit: info.git?.commit?.id,
        buildZeit: info.build?.time,
      }
    );
  });

  readonly stage = computed(() => this.info()?.app?.stage || undefined);

  /** Lädt die Angaben des Backends, solange noch keine Antwort da ist. */
  laden(): void {
    if (this.info() || this.laedt) {
      return;
    }
    this.laedt = true;
    this.http
      .get<InfoAntwort>(INFO_URL)
      .pipe(
        timeout(ANTWORT_TIMEOUT_MS),
        catchError(() => of(undefined)),
      )
      .subscribe((info) => {
        this.laedt = false;
        // Auch ein leeres Objekt zählt als Antwort; danach wird nicht erneut gefragt.
        this.info.set(info ?? undefined);
      });
  }
}
