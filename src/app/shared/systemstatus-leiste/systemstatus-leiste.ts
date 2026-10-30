import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Systemstatus } from '../../core/systemstatus/systemstatus.service';

/** Zeile mit der Erreichbarkeit von Backend, Datenbank und Anmeldeserver. */
@Component({
  selector: 'app-systemstatus-leiste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './systemstatus-leiste.html',
  styleUrl: './systemstatus-leiste.scss',
})
export class SystemstatusLeiste {
  readonly status = input.required<Systemstatus>();

  protected readonly dienste = computed(() => {
    const s = this.status();
    return [
      { name: 'Backend', ok: s.backend },
      { name: 'Datenbank', ok: s.datenbank },
      { name: 'Anmeldeserver', ok: s.anmeldeserver },
    ];
  });
}
