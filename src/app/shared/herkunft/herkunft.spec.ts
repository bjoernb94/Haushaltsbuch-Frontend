import { zurueckLabel } from './herkunft';

describe('zurueckLabel', () => {
  it.each([
    ['/vertraege', 'Zurück zu Verträge'],
    ['/einstellungen?x=1', 'Zurück zu Einstellungen'],
    ['/einstellungen/profil', 'Zurück zu Profil'],
    ['/impressum#kontakt', 'Zurück zu Impressum'],
    ['/unbekannt', null],
  ])('beschriftet %s mit %s', (url, erwartet) => {
    expect(zurueckLabel(url)).toBe(erwartet);
  });
});
