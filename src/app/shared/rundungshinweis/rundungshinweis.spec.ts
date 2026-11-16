import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Rundungshinweis, RUNDUNG_TEXT, RUNDUNG_TEXT_KURZ } from './rundungshinweis';

@Component({
  imports: [Rundungshinweis],
  template: `<app-rundungshinweis [kurz]="kurz()" />`,
})
class Host {
  readonly kurz = signal(false);
}

describe('Rundungshinweis', () => {
  async function erstellen(kurz = false) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.kurz.set(kurz);
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).querySelector('app-rundungshinweis')!;
  }

  it('nennt die Rundung und was verbindlich ist', async () => {
    expect((await erstellen()).textContent?.trim()).toBe(
      'Umgerechnete Werte und Summen sind gerundet und können um wenige Cent abweichen. Verbindlich ist der Betrag je Abbuchung.',
    );
    expect(RUNDUNG_TEXT).toContain('Verbindlich ist der Betrag je Abbuchung.');
  });

  it('kurz: nur die Rundung', async () => {
    expect((await erstellen(true)).textContent?.trim()).toBe(RUNDUNG_TEXT_KURZ);
    expect(RUNDUNG_TEXT_KURZ).toBe('Gerundet, kann um wenige Cent abweichen.');
  });
});
