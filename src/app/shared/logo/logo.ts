import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Logo der App: Buch und Münze als flache Glyphe in der Textfarbe, wie im Design System („Logos“).
 * Die Größe setzt die umgebende Seite. Ein einziger Pfad statt Masken und mit dem € als Kontur, damit
 * nichts von IDs oder einer geladenen Schrift abhängt.
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      fill-rule="evenodd"
      d="M5.6 2.5V20.5A2.6 2.6 0 0 1 3 17.9V5.1A2.6 2.6 0 0 1 5.6 2.5ZM7 2.5H13.4A2.6 2.6 0 0 1 16 5.1V10.48A6.6 6.6 0 0 0 11.4 20.5H7ZM9.85 6.5H13.15A.85 .85 0 0 1 13.15 8.2H9.85A.85 .85 0 0 1 9.85 6.5ZM9.85 10H11.55A.85 .85 0 0 1 11.55 11.7H9.85A.85 .85 0 0 1 9.85 10ZM17 11.8A5.2 5.2 0 1 1 17 22.2A5.2 5.2 0 1 1 17 11.8ZM17.84 19.71Q17.05 19.71 16.47 19.36Q15.9 19 15.58 18.38Q15.48 18.17 15.41 17.95H14.65V17.17H15.26Q15.25 17.06 15.25 16.94Q15.25 16.82 15.26 16.71H14.65V15.93H15.4Q15.47 15.69 15.58 15.48Q15.9 14.85 16.47 14.51Q17.05 14.16 17.84 14.16Q18.23 14.16 18.6 14.26Q18.96 14.36 19.27 14.56L18.74 15.39Q18.55 15.25 18.32 15.17Q18.08 15.1 17.84 15.1Q17.33 15.1 16.99 15.33Q16.68 15.55 16.51 15.93H18.21V16.71H16.32Q16.31 16.82 16.31 16.94Q16.31 17.06 16.32 17.17H18.21V17.95H16.51Q16.68 18.33 17 18.54Q17.34 18.77 17.84 18.76Q18.35 18.77 18.75 18.48L19.27 19.3Q18.96 19.51 18.59 19.61Q18.22 19.71 17.84 19.71Z"
    ></path>
  </svg>`,
  styles: `
    :host {
      flex: none;
      display: block;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class Logo {}
