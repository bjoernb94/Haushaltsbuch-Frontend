import { TestBed } from '@angular/core/testing';
import { UngespeicherteEingaben } from './ungespeicherte-eingaben';

describe('UngespeicherteEingaben', () => {
  let eingaben: UngespeicherteEingaben;

  beforeEach(() => {
    eingaben = TestBed.inject(UngespeicherteEingaben);
  });

  // Der Listener am Fenster überlebt den Test, er darf den nächsten nicht beeinflussen.
  afterEach(() => eingaben.melden(false));

  it('lässt ohne Eingaben sofort durch', async () => {
    await expect(eingaben.bestaetigen()).resolves.toBe(true);
    expect(eingaben.frageOffen()).toBe(false);
  });

  it('fragt bei Eingaben und antwortet wie im Dialog gewählt', async () => {
    eingaben.melden(true);
    const frage = eingaben.bestaetigen();
    expect(eingaben.frageOffen()).toBe(true);

    eingaben.antworten(false);
    await expect(frage).resolves.toBe(false);
    expect(eingaben.frageOffen()).toBe(false);
    expect(eingaben.vorhanden()).toBe(true);
  });

  it('nach „Verwerfen“ fragt der nächste Schritt nicht noch einmal', async () => {
    eingaben.melden(true);
    const frage = eingaben.bestaetigen();
    eingaben.antworten(true);
    await expect(frage).resolves.toBe(true);
    await expect(eingaben.bestaetigen()).resolves.toBe(true);
    expect(eingaben.frageOffen()).toBe(false);
  });

  it('stellt dieselbe Frage nur einmal', async () => {
    eingaben.melden(true);
    const erste = eingaben.bestaetigen();
    const zweite = eingaben.bestaetigen();
    eingaben.antworten(true);
    await expect(erste).resolves.toBe(true);
    await expect(zweite).resolves.toBe(true);
  });

  it('eine Antwort ohne Frage bewirkt nichts', () => {
    eingaben.melden(true);
    eingaben.antworten(true);
    expect(eingaben.vorhanden()).toBe(true);
  });

  it('vergessen beendet eine offene Frage und lässt danach durch', async () => {
    eingaben.melden(true);
    const frage = eingaben.bestaetigen();
    eingaben.vergessen();
    await expect(frage).resolves.toBe(false);
    expect(eingaben.frageOffen()).toBe(false);
    await expect(eingaben.bestaetigen()).resolves.toBe(true);
  });

  it('der Browser fragt beim Verlassen nur bei Eingaben nach', () => {
    const verlassen = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(verlassen()).toBe(false);
    eingaben.melden(true);
    expect(verlassen()).toBe(true);
  });
});
