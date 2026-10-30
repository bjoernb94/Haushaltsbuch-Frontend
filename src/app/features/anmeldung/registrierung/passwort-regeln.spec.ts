import { PASSWORT_REGELN, passwortFehler } from './passwort-regeln';

const EMAIL = 'max@beispiel.de';

describe('Passwortregeln', () => {
  it('akzeptiert ein Passwort, das alle Regeln erfüllt', () => {
    expect(passwortFehler('Geheim12!', EMAIL)).toBeNull();
  });

  it.each([
    ['Ge1!abc', 'Das Passwort muss mindestens 8 Zeichen lang sein.'],
    ['geheim12!', 'Das Passwort muss mindestens einen Großbuchstaben enthalten.'],
    ['GEHEIM12!', 'Das Passwort muss mindestens einen Kleinbuchstaben enthalten.'],
    ['Geheimnis!', 'Das Passwort muss mindestens eine Zahl enthalten.'],
    ['Geheim123', 'Das Passwort muss mindestens ein Sonderzeichen enthalten.'],
  ])('meldet bei %s die erste verletzte Regel', (passwort, fehler) => {
    expect(passwortFehler(passwort, EMAIL)?.fehler).toBe(fehler);
  });

  it('lehnt die E-Mail-Adresse als Passwort ab, auch in anderer Schreibweise', () => {
    expect(passwortFehler('Max1@Beispiel.de', 'max1@beispiel.de ')?.fehler).toBe(
      'Das Passwort darf nicht deine E-Mail-Adresse sein.',
    );
  });

  it('zählt wie Keycloak Umlaute als Buchstaben und Leerzeichen als Sonderzeichen', () => {
    expect(passwortFehler('Ärger 123', EMAIL)).toBeNull();
    expect(passwortFehler('ärger1234!', EMAIL)?.fehler).toContain('Großbuchstaben');
  });

  it('hat für jede Regel einen Text für die Abhakliste', () => {
    expect(PASSWORT_REGELN.map((r) => r.text)).toEqual([
      'Mindestens 8 Zeichen',
      'Ein Großbuchstabe',
      'Ein Kleinbuchstabe',
      'Eine Zahl',
      'Ein Sonderzeichen',
      'Nicht deine E-Mail-Adresse',
    ]);
  });
});
