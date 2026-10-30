import { TestBed } from '@angular/core/testing';
import { SystemstatusLeiste } from './systemstatus-leiste';

describe('SystemstatusLeiste', () => {
  it('zeigt erreichbare und nicht erreichbare Dienste', async () => {
    const fixture = TestBed.createComponent(SystemstatusLeiste);
    fixture.componentRef.setInput('status', {
      backend: true,
      datenbank: false,
      anmeldeserver: true,
    });
    await fixture.whenStable();

    const dienste = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.dienst')].map(
      (e) => e.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(dienste).toEqual([
      'Backend, verfügbar',
      'Datenbank nicht erreichbar',
      'Anmeldeserver, verfügbar',
    ]);
  });
});
