import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-vertraege-seite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Verträge</h1>`,
})
export class VertraegeSeite {}
