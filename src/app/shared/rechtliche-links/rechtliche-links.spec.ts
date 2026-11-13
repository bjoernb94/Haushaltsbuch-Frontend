import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { herkunftAus } from '../herkunft/herkunft';
import { istRechtlich, RechtlicheLinks } from './rechtliche-links';

@Component({ template: '<app-rechtliche-links />', imports: [RechtlicheLinks] })
class Seite {}

describe('RechtlicheLinks', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'vertraege', component: Seite },
          { path: 'impressum', component: Seite },
          { path: 'datenschutz', component: Seite },
        ]),
      ],
    });
  });

  const link = (element: HTMLElement, text: string) =>
    [...element.querySelectorAll('a')].find((a) => a.textContent?.trim() === text)!;

  it('gibt die aktuelle Seite als Herkunft mit und markiert die aktive Seite', async () => {
    const harness = await RouterTestingHarness.create('/vertraege?filter=1');
    const element = harness.routeNativeElement!;
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Rechtliches');
    link(element, 'Impressum').click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/impressum');
    expect(TestBed.inject(Location).getState()).toMatchObject({ herkunft: '/vertraege?filter=1' });

    const impressum = harness.routeNativeElement!;
    expect(link(impressum, 'Impressum').getAttribute('aria-current')).toBe('page');
    expect(link(impressum, 'Datenschutz').hasAttribute('aria-current')).toBe(false);
  });

  it('behält die Herkunft beim Wechsel zwischen Impressum und Datenschutz', async () => {
    const harness = await RouterTestingHarness.create('/vertraege');
    link(harness.routeNativeElement!, 'Impressum').click();
    await harness.fixture.whenStable();
    link(harness.routeNativeElement!, 'Datenschutz').click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/datenschutz');
    expect(TestBed.inject(Location).getState()).toMatchObject({ herkunft: '/vertraege' });
  });

  it('erkennt Impressum und Datenschutz, auch mit Query', () => {
    expect(istRechtlich('/impressum')).toBe(true);
    expect(istRechtlich('/datenschutz?x=1')).toBe(true);
    expect(istRechtlich('/impressumx')).toBe(false);
    expect(istRechtlich('/vertraege')).toBe(false);
  });

  it.each([
    [{ herkunft: '/vertraege/neu' }, '/vertraege/neu'],
    [{ herkunft: '//boese.example' }, undefined],
    [{ herkunft: 'https://boese.example' }, undefined],
    [{ herkunft: '/impressum' }, undefined],
    [{ herkunft: 42 }, undefined],
    [null, undefined],
  ])('nimmt aus %o nur eigene Pfade: %s', (state, erwartet) => {
    expect(herkunftAus(state, istRechtlich)).toBe(erwartet);
  });
});
