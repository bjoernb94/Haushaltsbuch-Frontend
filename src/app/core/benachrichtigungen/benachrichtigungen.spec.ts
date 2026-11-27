import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProfilAntwort } from '../api/api';
import { AuthService } from '../auth/auth.service';
import { Benachrichtigungen } from './benachrichtigungen';

const MAX: ProfilAntwort = { vorname: 'Max', name: 'Muster', email: 'max@beispiel.de' };
const ERIKA: ProfilAntwort = { vorname: 'Erika', name: 'Beispiel', email: 'erika@beispiel.de' };
const SPEICHER = 'haushaltsbuch.benachrichtigungen';

describe('Benachrichtigungen', () => {
  const nutzer = signal<ProfilAntwort | null>(MAX);

  function dienst(): Benachrichtigungen {
    const b = TestBed.inject(Benachrichtigungen);
    TestBed.tick();
    return b;
  }

  function anmelden(profil: ProfilAntwort | null): void {
    nutzer.set(profil);
    TestBed.tick();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    nutzer.set(MAX);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { nutzer, angemeldet: computed(() => !!nutzer()) } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('blendet einen Toast ein und legt ihn nach Ablauf ungelesen ins Center', () => {
    const b = dienst();
    b.melden({ art: 'erfolg', titel: '„Kfz“ wurde gespeichert.' });
    expect(b.toasts()).toHaveLength(1);
    expect(b.toasts()[0].dauer).toBe(5000);

    vi.advanceTimersByTime(4999);
    expect(b.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(b.toasts()).toEqual([]);
    expect(b.eintraege()).toMatchObject([{ titel: '„Kfz“ wurde gespeichert.', gelesen: false }]);
    expect(b.ungelesen()).toBe(1);
  });

  it.each([
    ['info', 6000],
    ['warnung', 8000],
    ['fehler', 0],
  ] as const)('zeigt %s %i ms', (art, dauer) => {
    const b = dienst();
    b.melden({ art, titel: 'x' });
    expect(b.toasts()[0].dauer).toBe(dauer);
  });

  it('lässt dauerhafte Meldungen und Fehler stehen, bis man sie schließt; Schließen legt gelesen ab', () => {
    const b = dienst();
    b.melden({ art: 'info', titel: 'Bleibt', dauerhaft: true });
    b.melden({ art: 'fehler', titel: 'Fehler' });
    vi.advanceTimersByTime(60_000);
    expect(b.toasts().map((t) => t.titel)).toEqual(['Bleibt', 'Fehler']);

    b.schliessen(b.toasts()[1].id);
    expect(b.toasts().map((t) => t.titel)).toEqual(['Bleibt']);
    expect(b.eintraege()).toMatchObject([{ titel: 'Fehler', gelesen: true }]);
    expect(b.ungelesen()).toBe(0);
  });

  it('hält die Zeit an, solange Maus oder Fokus auf dem Toast liegen', () => {
    const b = dienst();
    b.melden({ art: 'erfolg', titel: 'x' });
    const id = b.toasts()[0].id;
    vi.advanceTimersByTime(3000);
    b.anhalten(id);
    vi.advanceTimersByTime(10_000);
    expect(b.toasts()).toHaveLength(1);

    b.fortsetzen(id);
    vi.advanceTimersByTime(1999);
    expect(b.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(b.toasts()).toEqual([]);
  });

  it('zeigt höchstens drei Toasts; ein vierter schiebt den ältesten zeitgesteuerten ins Center', () => {
    const b = dienst();
    b.melden({ art: 'fehler', titel: 'Fehler' });
    b.melden({ art: 'erfolg', titel: 'Eins' });
    b.melden({ art: 'erfolg', titel: 'Zwei' });
    b.melden({ art: 'erfolg', titel: 'Drei' });
    expect(b.toasts().map((t) => t.titel)).toEqual(['Fehler', 'Zwei', 'Drei']);
    expect(b.eintraege()).toMatchObject([{ titel: 'Eins', gelesen: false }]);
  });

  it('ohne zeitgesteuerten Toast weicht der älteste', () => {
    const b = dienst();
    for (const titel of ['A', 'B', 'C', 'D']) {
      b.melden({ art: 'fehler', titel });
    }
    expect(b.toasts().map((t) => t.titel)).toEqual(['B', 'C', 'D']);
    expect(b.eintraege().map((e) => e.titel)).toEqual(['A']);
  });

  it('hält höchstens 50 Einträge, neueste zuerst', () => {
    const b = dienst();
    for (let i = 0; i < 55; i++) {
      b.melden({ art: 'fehler', titel: `M${i}` });
      b.schliessen(b.toasts()[0].id);
    }
    expect(b.eintraege()).toHaveLength(50);
    expect(b.eintraege()[0].titel).toBe('M54');
  });

  it('markiert gelesen und entfernt, einzeln und alle', () => {
    const b = dienst();
    for (const titel of ['A', 'B', 'C']) {
      b.melden({ art: 'fehler', titel });
      b.schliessen(b.toasts()[0].id);
    }
    b.alleEntfernen();
    b.melden({ art: 'erfolg', titel: 'A' });
    b.melden({ art: 'erfolg', titel: 'B' });
    vi.advanceTimersByTime(5000);
    expect(b.ungelesen()).toBe(2);

    b.gelesen(b.eintraege()[0].id);
    expect(b.ungelesen()).toBe(1);
    b.alleGelesen();
    expect(b.ungelesen()).toBe(0);
    b.entfernen(b.eintraege()[0].id);
    expect(b.eintraege()).toHaveLength(1);
    b.alleEntfernen();
    expect(b.eintraege()).toEqual([]);
  });

  it('behält Text und Link im Center', () => {
    const b = dienst();
    b.melden({
      art: 'warnung',
      titel: 'Frist',
      text: 'Bald',
      link: { ziel: '/vertraege/kfz', text: 'Vertrag ansehen' },
    });
    vi.advanceTimersByTime(8000);
    expect(b.eintraege()[0]).toMatchObject({
      text: 'Bald',
      link: { ziel: '/vertraege/kfz', text: 'Vertrag ansehen' },
    });
  });

  describe('sessionStorage', () => {
    function gespeichert() {
      return JSON.parse(sessionStorage.getItem(SPEICHER) ?? 'null') as {
        nutzer: string;
        eintraege: { titel: string }[];
      } | null;
    }

    it('speichert das Center mit dem Nutzer und lädt es nach dem Neuladen', () => {
      const b = dienst();
      b.melden({ art: 'erfolg', titel: 'A' });
      vi.advanceTimersByTime(5000);
      expect(gespeichert()).toMatchObject({ nutzer: MAX.email, eintraege: [{ titel: 'A' }] });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: AuthService, useValue: { nutzer, angemeldet: computed(() => !!nutzer()) } },
        ],
      });
      expect(
        dienst()
          .eintraege()
          .map((e) => e.titel),
      ).toEqual(['A']);
    });

    it('verwirft das Center eines anderen Nutzers', () => {
      sessionStorage.setItem(
        SPEICHER,
        JSON.stringify({ nutzer: ERIKA.email, eintraege: [{ id: 'x', titel: 'Fremd' }] }),
      );
      const b = dienst();
      expect(b.eintraege()).toEqual([]);
      expect(gespeichert()).toBeNull();
    });

    it('vergisst bei abgelaufener Sitzung alles Sichtbare, behält es aber für denselben Nutzer', () => {
      const b = dienst();
      b.melden({ art: 'erfolg', titel: 'A' });
      vi.advanceTimersByTime(5000);
      b.melden({ art: 'erfolg', titel: 'B' });

      anmelden(null);
      expect(b.toasts()).toEqual([]);
      expect(b.eintraege()).toEqual([]);

      anmelden(MAX);
      expect(b.eintraege().map((e) => e.titel)).toEqual(['A']);
    });

    it('leert beim Abmelden auch den Speicher', () => {
      const b = dienst();
      b.melden({ art: 'fehler', titel: 'A' });
      b.schliessen(b.toasts()[0].id);
      b.leeren();
      expect(b.eintraege()).toEqual([]);
      expect(gespeichert()).toBeNull();
    });
  });

  describe('vor dem Login', () => {
    beforeEach(() => nutzer.set(null));

    it('zeigt nur Toasts, 8 s lang, ohne Center', () => {
      const b = dienst();
      b.melden({ art: 'erfolg', titel: 'Du wurdest abgemeldet.' });
      expect(b.toasts()[0]).toMatchObject({ dauer: 8000, vorLogin: true });
      vi.advanceTimersByTime(8000);
      expect(b.toasts()).toEqual([]);
      expect(b.eintraege()).toEqual([]);
    });

    it('lässt einen dauerhaften Toast stehen, bis die Anmeldung gelingt', () => {
      const b = dienst();
      b.melden({ art: 'info', titel: 'Deine Sitzung ist abgelaufen.', dauerhaft: true });
      vi.advanceTimersByTime(60_000);
      expect(b.toasts()).toHaveLength(1);

      anmelden(MAX);
      expect(b.toasts()).toEqual([]);
      expect(b.eintraege()).toEqual([]);
    });
  });
});
