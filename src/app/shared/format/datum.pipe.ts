import { Pipe, PipeTransform } from '@angular/core';

/** ISO-Datum als „TT.MM.JJJJ“; ohne Umweg über {@code Date}, damit keine Zeitzone es verschiebt. */
export function datumText(iso: string | null): string {
  return iso ? iso.split('-').reverse().join('.') : '';
}

@Pipe({ name: 'datum' })
export class DatumPipe implements PipeTransform {
  transform(iso: string | null): string {
    return datumText(iso);
  }
}
