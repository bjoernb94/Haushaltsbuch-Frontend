import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Shell } from './shell';

describe('Shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('zeigt Kopfzeile und Navigation', async () => {
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('mat-toolbar')?.textContent).toContain('Haushaltsbuch');
    expect(compiled.querySelectorAll('mat-nav-list a').length).toBe(6);
  });

  it('meldet ab und geht zum Login', async () => {
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    const navigiert = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-label="Abmelden"]')!
      .click();
    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'POST', url: '/api/abmeldung' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(navigiert).toHaveBeenCalledWith('/login');
  });
});
