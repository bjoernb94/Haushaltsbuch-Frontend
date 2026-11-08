import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InstanzService } from '../../core/instanz/instanz.service';
import { DatumPipe } from '../../shared/format/datum.pipe';
import { HinweisBox } from '../../shared/hinweis-box/hinweis-box';
import { RechtlicherRahmen } from './rechtlicher-rahmen/rechtlicher-rahmen';

@Component({
  selector: 'app-datenschutz-seite',
  imports: [DatumPipe, HinweisBox, RechtlicherRahmen],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './datenschutz-seite.html',
  styleUrl: './datenschutz-seite.scss',
})
export class DatenschutzSeite {
  protected readonly instanz = inject(InstanzService);

  protected tage(anzahl: number): string {
    return anzahl === 1 ? 'einem Tag' : `${anzahl} Tagen`;
  }
}
