import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { KomponentenAenderung, KomponentenAntwort } from '../../../core/api/api';
import { KOMPONENTEN_URL } from '../../../core/auth/auth.service';

/** Gebuchte Komponenten des Haushalts lesen und ändern; hält nichts (ADR 0018). */
@Injectable({ providedIn: 'root' })
export class KomponentenService {
  private readonly http = inject(HttpClient);

  laden(): Observable<KomponentenAntwort> {
    return this.http.get<KomponentenAntwort>(KOMPONENTEN_URL);
  }

  /** Veraltete {@code version}: 409 KONFLIKT; leere Auswahl: 400 VALIDIERUNG. */
  aendern(aenderung: KomponentenAenderung): Observable<KomponentenAntwort> {
    return this.http.put<KomponentenAntwort>(KOMPONENTEN_URL, aenderung);
  }
}
