import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Seitenaktionen, seitenaktionenMelden } from './seitenaktionen';

@Component({ template: '' })
class Seite {
  readonly ziel = signal('/start');

  constructor() {
    seitenaktionenMelden(() => ({ zurueck: { ziel: this.ziel(), label: null } }));
  }
}

describe('Seitenaktionen', () => {
  it('ohne Seite keine Aktionen', () => {
    expect(TestBed.inject(Seitenaktionen).aktionen()).toEqual({});
  });

  it('folgt der Seite und entfernt ihre Aktionen mit ihr', () => {
    const aktionen = TestBed.inject(Seitenaktionen).aktionen;
    const fixture = TestBed.createComponent(Seite);
    expect(aktionen().zurueck?.ziel).toBe('/start');

    fixture.componentInstance.ziel.set('/vertraege');
    expect(aktionen().zurueck?.ziel).toBe('/vertraege');

    fixture.destroy();
    expect(aktionen()).toEqual({});
  });

  it('lässt die Aktionen der nächsten Seite stehen, wenn die vorige danach geht', () => {
    const aktionen = TestBed.inject(Seitenaktionen).aktionen;
    const vorige = TestBed.createComponent(Seite);
    const naechste = TestBed.createComponent(Seite);
    naechste.componentInstance.ziel.set('/einstellungen');

    vorige.destroy();
    expect(aktionen().zurueck?.ziel).toBe('/einstellungen');
  });
});
