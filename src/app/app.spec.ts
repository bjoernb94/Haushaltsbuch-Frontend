import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { VersionService } from './core/version/version.service';

describe('App', () => {
  const stage = signal<string | undefined>(undefined);

  beforeEach(async () => {
    stage.set(undefined);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: VersionService, useValue: { stage } }],
    }).compileComponents();
  });

  async function app() {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('zeigt außerhalb von PROD den Streifen und reserviert seine Höhe', async () => {
    stage.set('DEV');
    const element = await app();
    expect(element.querySelector('.streifen')?.textContent).toBe(
      'DEV-Umgebung · keine echten Daten eingeben',
    );
    expect(element.style.getPropertyValue('--app-streifen-hoehe')).toBe('24px');
  });

  it.each([['PROD'], [undefined]])('zeigt bei Stage %s keinen Streifen', async (wert) => {
    stage.set(wert);
    const element = await app();
    expect(element.querySelector('.streifen')).toBeNull();
    expect(element.style.getPropertyValue('--app-streifen-hoehe')).toBe('');
  });
});
