import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-nutzer-seite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Nutzer</h1>`,
})
export class NutzerSeite {}
