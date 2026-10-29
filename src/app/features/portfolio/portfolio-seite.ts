import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-portfolio-seite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Portfolio</h1>`,
})
export class PortfolioSeite {}
