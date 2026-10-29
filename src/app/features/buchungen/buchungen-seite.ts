import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-buchungen-seite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Buchungen</h1>`,
})
export class BuchungenSeite {}
