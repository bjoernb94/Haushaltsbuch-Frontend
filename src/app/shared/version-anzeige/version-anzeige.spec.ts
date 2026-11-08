import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { VersionService } from '../../core/version/version.service';
import { VersionAnzeige } from './version-anzeige';

describe('VersionAnzeige', () => {
  const stage = signal<string | undefined>(undefined);

  beforeEach(async () => {
    stage.set(undefined);
    await TestBed.configureTestingModule({
      imports: [VersionAnzeige],
      providers: [{ provide: VersionService, useValue: { frontend: { version: '0.1.0' }, stage } }],
    }).compileComponents();
  });

  async function anzeige() {
    const fixture = TestBed.createComponent(VersionAnzeige);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('zeigt die Frontend-Version auch ohne Antwort des Backends', async () => {
    const element = await anzeige();
    expect(element.querySelector('.version')?.textContent).toBe('v0.1.0');
    expect(element.querySelector('.stage')).toBeNull();
  });

  it('zeigt die Stage als Badge, für Screenreader mit Beschriftung', async () => {
    stage.set('DEV');
    const element = await anzeige();
    const badge = element.querySelector('.stage');
    expect(badge?.textContent).toBe('Umgebung DEV');
    expect(badge?.querySelector('.sr-only')?.textContent).toBe('Umgebung ');
    expect(badge?.classList.contains('prod')).toBe(false);
  });

  it('färbt PROD anders', async () => {
    stage.set('PROD');
    expect((await anzeige()).querySelector('.stage')?.classList.contains('prod')).toBe(true);
  });
});
