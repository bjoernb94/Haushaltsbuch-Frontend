import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';

/** Die vier Zustände des Design Systems. */
export type MeldungArt = 'erfolg' | 'info' | 'warnung' | 'fehler';

/** Was eine Seite meldet. Texte stehen in der Seite (ADR 0007), nicht hier. */
export interface Meldung {
  art: MeldungArt;
  titel: string;
  text?: string;
  /** Optionaler Link, z. B. „Vertrag ansehen“; ihm zu folgen markiert die Meldung als gelesen. */
  link?: { ziel: string; text: string };
  /** Bleibt wie ein Fehler stehen, bis man sie schließt. */
  dauerhaft?: boolean;
}

/** Ein eingeblendeter Toast. */
export interface Toast extends Meldung {
  id: string;
  /** Anzeigedauer in ms; 0 = bleibt, bis man ihn schließt. */
  dauer: number;
  zeit: number;
  /** Vor dem Login gemeldet: kommt nie ins Center und verschwindet mit der Anmeldung. */
  vorLogin: boolean;
}

/** Ein Eintrag im Meldungscenter. */
export interface Eintrag extends Omit<Meldung, 'dauerhaft'> {
  id: string;
  zeit: number;
  gelesen: boolean;
}

/** Anzeigedauer je Art in der App; Fehler bleiben. */
const DAUER: Record<MeldungArt, number> = { erfolg: 5000, info: 6000, warnung: 8000, fehler: 0 };
/** Vor dem Login gibt es kein Center; die Meldung steht dafür etwas länger. */
const DAUER_VOR_LOGIN = 8000;
const HOECHSTENS_TOASTS = 3;
const HOECHSTENS_EINTRAEGE = 50;
const SPEICHER = 'haushaltsbuch.benachrichtigungen';

interface Gespeichert {
  nutzer: string;
  eintraege: Eintrag[];
}

interface Zeitgeber {
  timer?: ReturnType<typeof setTimeout>;
  rest: number;
  start: number;
}

/**
 * Meldungen nach Aktionen an einem festen Ort: als Toast oben rechts (bis 900 px unter der Kopfzeile),
 * danach im Meldungscenter hinter der Glocke. Läuft die Zeit eines Toasts ab, kommt er ungelesen ins
 * Center, schließt man ihn, gelesen. Vor dem Login gibt es nur Toasts.
 *
 * Das Center liegt im sessionStorage des Tabs, gebunden an den Nutzer (E-Mail-Adresse): Es übersteht
 * Neuladen und Seitenwechsel, gehört aber nie einem anderen Nutzer. Abmelden leert es
 * ({@link leeren}). Ausnahme zu ADR 0018 wie AuthService und Systemstatus.
 */
@Injectable({ providedIn: 'root' })
export class Benachrichtigungen {
  private readonly auth = inject(AuthService);

  private readonly _toasts = signal<Toast[]>([]);
  private readonly _eintraege = signal<Eintrag[]>([]);
  private readonly zeitgeber = new Map<string, Zeitgeber>();
  private nummer = 0;

  readonly toasts = this._toasts.asReadonly();
  /** Neueste zuerst. */
  readonly eintraege = this._eintraege.asReadonly();
  readonly ungelesen = computed(() => this._eintraege().filter((e) => !e.gelesen).length);

  constructor() {
    // Nutzer wechselt: dessen Center laden bzw. alles vergessen, was dem vorigen gehörte.
    effect(() => {
      const email = this.auth.nutzer()?.email ?? null;
      untracked(() => this.nutzerGewechselt(email));
    });
  }

  melden(meldung: Meldung): void {
    const vorLogin = !this.auth.angemeldet();
    const dauer =
      meldung.dauerhaft || meldung.art === 'fehler'
        ? 0
        : vorLogin
          ? DAUER_VOR_LOGIN
          : DAUER[meldung.art];
    const toast: Toast = { ...meldung, id: `m${++this.nummer}`, dauer, zeit: Date.now(), vorLogin };
    let toasts = [...this._toasts(), toast];
    const verdraengt: Toast[] = [];
    while (toasts.length > HOECHSTENS_TOASTS) {
      // Der älteste zeitgesteuerte weicht, sonst der älteste überhaupt.
      const index = Math.max(
        0,
        toasts.findIndex((t) => t.dauer > 0),
      );
      verdraengt.push(toasts[index]);
      toasts = toasts.filter((_, i) => i !== index);
    }
    this._toasts.set(toasts);
    verdraengt.forEach((t) => this.ablegen(t, false));
    if (dauer) {
      this.zeitgeber.set(toast.id, { rest: dauer, start: 0 });
      this.fortsetzen(toast.id);
    }
  }

  /** Schließen (×): gelesen ins Center. */
  schliessen(id: string): void {
    const toast = this._toasts().find((t) => t.id === id);
    if (toast) {
      this.ablegen(toast, true);
    }
  }

  /** Maus oder Fokus auf dem Toast: Die Zeit steht. */
  anhalten(id: string): void {
    const zeit = this.zeitgeber.get(id);
    if (zeit?.timer !== undefined) {
      clearTimeout(zeit.timer);
      zeit.timer = undefined;
      zeit.rest = Math.max(0, zeit.rest - (Date.now() - zeit.start));
    }
  }

  fortsetzen(id: string): void {
    const zeit = this.zeitgeber.get(id);
    if (zeit && zeit.timer === undefined) {
      zeit.start = Date.now();
      zeit.timer = setTimeout(() => {
        const toast = this._toasts().find((t) => t.id === id);
        if (toast) {
          this.ablegen(toast, false);
        }
      }, zeit.rest);
    }
  }

  gelesen(id: string): void {
    this.eintraegeSetzen(this._eintraege().map((e) => (e.id === id ? { ...e, gelesen: true } : e)));
  }

  alleGelesen(): void {
    this.eintraegeSetzen(this._eintraege().map((e) => ({ ...e, gelesen: true })));
  }

  entfernen(id: string): void {
    this.eintraegeSetzen(this._eintraege().filter((e) => e.id !== id));
  }

  alleEntfernen(): void {
    this.eintraegeSetzen([]);
  }

  /** Vor dem Abmelden (solange die Sitzung besteht): Center und Toasts des Nutzers vergessen. */
  leeren(): void {
    this.alleToastsEntfernen((t) => !t.vorLogin);
    this._eintraege.set([]);
    try {
      sessionStorage.removeItem(SPEICHER);
    } catch {
      // Ohne sessionStorage gibt es nichts zu löschen.
    }
  }

  /** Toast entfernen; mit Center kommt er dorthin. */
  private ablegen(toast: Toast, gelesen: boolean): void {
    this.alleToastsEntfernen((t) => t.id === toast.id);
    if (toast.vorLogin || !this.auth.angemeldet()) {
      return;
    }
    const { art, titel, text, link, id, zeit } = toast;
    const eintrag: Eintrag = {
      id,
      art,
      titel,
      zeit,
      gelesen,
      ...(text && { text }),
      ...(link && { link }),
    };
    this.eintraegeSetzen([eintrag, ...this._eintraege()]);
  }

  private alleToastsEntfernen(welche: (toast: Toast) => boolean): void {
    const weg = this._toasts().filter(welche);
    for (const toast of weg) {
      this.anhalten(toast.id);
      this.zeitgeber.delete(toast.id);
    }
    if (weg.length) {
      this._toasts.update((toasts) => toasts.filter((t) => !weg.includes(t)));
    }
  }

  private eintraegeSetzen(eintraege: Eintrag[]): void {
    const begrenzt = eintraege.slice(0, HOECHSTENS_EINTRAEGE);
    this._eintraege.set(begrenzt);
    const nutzer = this.auth.nutzer()?.email;
    if (nutzer) {
      try {
        sessionStorage.setItem(SPEICHER, JSON.stringify({ nutzer, eintraege: begrenzt }));
      } catch {
        // Ohne sessionStorage bleibt das Center nur bis zum Neuladen.
      }
    }
  }

  private nutzerGewechselt(email: string | null): void {
    if (!email) {
      // Abgemeldet oder Sitzung abgelaufen: nichts davon bleibt sichtbar. Der gespeicherte Stand
      // bleibt für die erneute Anmeldung desselben Nutzers (Abmelden hat ihn schon gelöscht).
      this.alleToastsEntfernen((t) => !t.vorLogin);
      this._eintraege.set([]);
      return;
    }
    // Angemeldet: Was vor dem Login gemeldet wurde (z. B. „Sitzung abgelaufen“), stimmt nicht mehr.
    this.alleToastsEntfernen((t) => t.vorLogin);
    const gespeichert = this.gespeichert();
    if (gespeichert?.nutzer === email) {
      this._eintraege.set(gespeichert.eintraege.slice(0, HOECHSTENS_EINTRAEGE));
    } else {
      this._eintraege.set([]);
      try {
        sessionStorage.removeItem(SPEICHER);
      } catch {
        // Ohne sessionStorage gibt es nichts zu verwerfen.
      }
    }
  }

  private gespeichert(): Gespeichert | null {
    try {
      const roh = sessionStorage.getItem(SPEICHER);
      const wert: unknown = roh ? JSON.parse(roh) : null;
      return wert && typeof wert === 'object' && Array.isArray((wert as Gespeichert).eintraege)
        ? (wert as Gespeichert)
        : null;
    } catch {
      return null;
    }
  }
}
