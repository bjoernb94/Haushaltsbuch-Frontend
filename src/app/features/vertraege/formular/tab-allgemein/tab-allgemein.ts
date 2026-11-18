import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { VertragKategorieAntwort } from '../../../../core/api/api';
import { kategorieText } from '../../vertrag-texte';
import { VertragTab } from '../vertrag-tabs';

/** Tab Allgemein des Vertragsformulars: Anbieter, Bezeichnung, Kategorie, Nummer und Notiz. */
@Component({
  selector: 'app-vertrag-tab-allgemein',
  imports: [ReactiveFormsModule],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tab-allgemein.html',
  styleUrl: '../_tab.scss',
})
export class VertragTabAllgemein extends VertragTab {
  readonly kategorien = input.required<VertragKategorieAntwort[]>();

  protected readonly kategorieText = kategorieText;
}
