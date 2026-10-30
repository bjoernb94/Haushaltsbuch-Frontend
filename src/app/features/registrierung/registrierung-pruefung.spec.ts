import { registrierungPruefen, RegistrierungWerte } from './registrierung-pruefung';

const GUELTIG: RegistrierungWerte = {
  email: 'max@beispiel.de',
  passwort: 'Geheim12!',
  name: 'Muster',
  vorname: 'Max',
  komponenten: ['PORTFOLIO'],
};

describe('registrierungPruefen', () => {
  it('lässt gültige Daten durch', () => {
    const p = registrierungPruefen(GUELTIG);
    expect(p.meldung).toBeNull();
    expect(p.felder.size).toBe(0);
  });

  it('meldet leere Felder zuerst und markiert alle Probleme', () => {
    const p = registrierungPruefen({ ...GUELTIG, name: ' ', vorname: '', komponenten: [] });
    expect(p.meldung).toBe('Bitte fülle alle Felder aus.');
    expect([...p.felder]).toEqual(['name', 'vorname', 'komponenten']);
  });

  it('prüft die E-Mail-Adresse vor dem Passwort', () => {
    const p = registrierungPruefen({ ...GUELTIG, email: 'max@', passwort: 'kurz' });
    expect(p.meldung).toBe('Bitte gib eine gültige E-Mail-Adresse ein.');
    expect([...p.felder]).toEqual(['email', 'passwort']);
  });

  it('meldet die erste verletzte Passwortregel', () => {
    expect(registrierungPruefen({ ...GUELTIG, passwort: 'geheim12!' }).meldung).toBe(
      'Das Passwort muss mindestens einen Großbuchstaben enthalten.',
    );
  });

  it('verlangt mindestens eine Komponente', () => {
    const p = registrierungPruefen({ ...GUELTIG, komponenten: [] });
    expect(p.meldung).toBe('Bitte wähle mindestens eine Komponente aus.');
    expect([...p.felder]).toEqual(['komponenten']);
  });
});
