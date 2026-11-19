import { Location } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ZurueckLink } from './zurueck-link';

@Component({
  imports: [ZurueckLink],
  template: `<a [appZurueckLink]="ziel()" [verlauf]="verlauf()">Zurück</a>`,
})
class Testseite {
  readonly ziel = signal('/einstellungen');
  readonly verlauf = signal(false);
}

describe('ZurueckLink', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'einstellungen', children: [] },
          { path: 'profil', children: [] },
        ]),
      ],
    });
  });

  async function link(verlauf: boolean) {
    const fixture = TestBed.createComponent(Testseite);
    fixture.componentInstance.verlauf.set(verlauf);
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
  }

  it('zeigt auf das Ziel und navigiert ohne Verlauf vorwärts dorthin', async () => {
    const router = TestBed.inject(Router);
    const back = vi.spyOn(TestBed.inject(Location), 'back');
    const a = await link(false);
    expect(a.getAttribute('href')).toBe('/einstellungen');

    a.click();
    await vi.waitFor(() => expect(router.url).toBe('/einstellungen'));
    expect(back).not.toHaveBeenCalled();
  });

  it('geht mit Verlauf zurück, das Ziel bleibt als href', async () => {
    const navigiert = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    const a = await link(true);
    expect(a.getAttribute('href')).toBe('/einstellungen');

    a.click();
    expect(back).toHaveBeenCalledOnce();
    expect(navigiert).not.toHaveBeenCalled();
  });

  it('überlässt dem Browser Klicks mit Zusatztaste', async () => {
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    const a = await link(true);
    const klick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    // Im Test soll der Browser nicht wirklich einen Tab öffnen.
    a.addEventListener('click', (e) => e.preventDefault());
    a.dispatchEvent(klick);
    expect(back).not.toHaveBeenCalled();
  });
});
