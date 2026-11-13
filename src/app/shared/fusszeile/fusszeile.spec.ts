import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SystemstatusService } from '../../core/systemstatus/systemstatus.service';
import { VersionService } from '../../core/version/version.service';
import { Fusszeile } from './fusszeile';

describe('Fusszeile', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Fusszeile],
      providers: [
        provideRouter([]),
        {
          provide: SystemstatusService,
          useValue: {
            beobachten: () => of({ backend: true, datenbank: false, anmeldeserver: true }),
          },
        },
        {
          provide: VersionService,
          useValue: { frontend: { version: '0.1.0' }, stage: () => 'DEV' },
        },
      ],
    }).compileComponents();
  });

  it('zeigt Copyright, Systemstatus, rechtliche Links und Version', async () => {
    const fixture = TestBed.createComponent(Fusszeile);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.copyright')?.textContent).toBe('© Björn Bochmann');
    expect(element.querySelector('.status')?.textContent).toContain('Datenbank nicht erreichbar');
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Rechtliches');
    expect(element.querySelector('.version')?.textContent).toContain('v0.1.0');
    expect(element.classList.contains('mit-navigation')).toBe(false);
  });

  it('zeigt den Systemstatus nicht, wenn die Seite ihn selbst zeigt, und wird flach', async () => {
    const fixture = TestBed.createComponent(Fusszeile);
    fixture.componentRef.setInput('mitStatus', false);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.status')).toBeNull();
    expect(element.querySelector('.copyright')?.textContent).toBe('© Björn Bochmann');
    expect(element.querySelector('.version')?.textContent).toContain('v0.1.0');
    expect(element.classList.contains('flach')).toBe(true);
  });

  it('kennzeichnet die Variante mit Seitennavigation', async () => {
    const fixture = TestBed.createComponent(Fusszeile);
    fixture.componentRef.setInput('mitNavigation', true);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).classList.contains('mit-navigation')).toBe(true);
  });
});
