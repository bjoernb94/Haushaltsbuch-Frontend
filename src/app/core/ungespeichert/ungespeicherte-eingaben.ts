import { DOCUMENT, inject, Injectable, signal } from '@angular/core';

/**
 * Weiß, ob ein offenes Formular ungespeicherte Eingaben hat, und fragt vor dem Verlassen nach. Hält
 * keine Fachdaten, nur diesen Zustand; den Dialog dazu zeigt die Shell.
 */
@Injectable({ providedIn: 'root' })
export class UngespeicherteEingaben {
  private readonly _vorhanden = signal(false);
  private readonly _frageOffen = signal(false);

  private offeneFrage: Promise<boolean> | null = null;
  private antwort: ((verwerfen: boolean) => void) | null = null;

  readonly vorhanden = this._vorhanden.asReadonly();
  readonly frageOffen = this._frageOffen.asReadonly();

  constructor() {
    // Tab schließen oder neu laden: Hier geht nur der Standarddialog des Browsers.
    inject(DOCUMENT).defaultView?.addEventListener('beforeunload', (event) => {
      if (this._vorhanden()) {
        event.preventDefault();
      }
    });
  }

  melden(vorhanden: boolean): void {
    this._vorhanden.set(vorhanden);
  }

  /** Darf es weitergehen? Ohne ungespeicherte Eingaben sofort, sonst nach der Antwort im Dialog. */
  bestaetigen(): Promise<boolean> {
    if (!this._vorhanden()) {
      return Promise.resolve(true);
    }
    this.offeneFrage ??= new Promise((antwort) => {
      this.antwort = antwort;
      this._frageOffen.set(true);
    });
    return this.offeneFrage;
  }

  antworten(verwerfen: boolean): void {
    const antwort = this.antwort;
    if (!antwort) {
      return;
    }
    this.antwort = null;
    this.offeneFrage = null;
    this._frageOffen.set(false);
    if (verwerfen) {
      this._vorhanden.set(false);
    }
    antwort(verwerfen);
  }

  /** Für Wechsel, bei denen niemand gefragt werden soll: gespeichert, Sitzung fort, kein Zugriff. */
  vergessen(): void {
    this._vorhanden.set(false);
    this.antworten(false);
  }
}
