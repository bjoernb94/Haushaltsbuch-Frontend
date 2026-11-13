import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  output,
} from '@angular/core';

export interface Tab {
  key: string;
  label: string;
}

/**
 * Tab-Leiste nach dem ARIA-Muster: Nur der aktive Tab liegt in der Tab-Reihenfolge, Pfeiltasten,
 * Pos1 und Ende wählen und fokussieren. Das Panel ({@code role="tabpanel"}, {@link panelId}) gehört
 * der Seite; seine Beschriftung ist {@link tabId} des aktiven Tabs.
 */
@Component({
  selector: 'app-tabliste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (tab of tabs(); track tab.key; let i = $index) {
    <button
      type="button"
      role="tab"
      class="tab"
      [id]="tabId(tab.key)"
      [attr.aria-controls]="panelId()"
      [attr.aria-selected]="aktiv() === tab.key"
      [tabIndex]="aktiv() === tab.key ? 0 : -1"
      (click)="waehlen.emit(tab.key)"
      (keydown)="taste($event, i)"
    >
      {{ tab.label }}
    </button>
  }`,
  styleUrl: './tabliste.scss',
  host: { role: 'tablist', '[attr.aria-label]': 'label()' },
})
export class Tabliste {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly tabs = input.required<readonly Tab[]>();
  readonly aktiv = input.required<string>();
  readonly label = input.required<string>();
  /** Präfix der IDs, eindeutig auf der Seite. */
  readonly idPrefix = input.required<string>();
  readonly panelId = input.required<string>();

  readonly waehlen = output<string>();

  tabId(key: string): string {
    return `${this.idPrefix()}-${key}`;
  }

  protected taste(event: KeyboardEvent, index: number): void {
    const anzahl = this.tabs().length;
    const ziel: Record<string, number> = {
      ArrowRight: (index + 1) % anzahl,
      ArrowLeft: (index - 1 + anzahl) % anzahl,
      Home: 0,
      End: anzahl - 1,
    };
    if (!(event.key in ziel)) {
      return;
    }
    event.preventDefault();
    const key = this.tabs()[ziel[event.key]].key;
    this.waehlen.emit(key);
    afterNextRender(
      () =>
        this.element.nativeElement
          .querySelector<HTMLElement>(`#${CSS.escape(this.tabId(key))}`)
          ?.focus(),
      { injector: this.injector },
    );
  }
}
