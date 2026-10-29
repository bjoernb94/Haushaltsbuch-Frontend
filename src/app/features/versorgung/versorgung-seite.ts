import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-versorgung-seite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Versorgung</h1>`,
})
export class VersorgungSeite {}
