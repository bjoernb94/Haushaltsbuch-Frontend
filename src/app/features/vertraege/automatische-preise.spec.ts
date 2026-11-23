import { gruppenText, gruppieren, neuHinweisText } from './automatische-preise';

describe('gruppieren', () => {
  const auto = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, automatisch: true }));

  it('lässt weniger als fünf automatische Einträge einzeln', () => {
    const eintraege = [{ id: 'a', automatisch: false }, ...auto(4)];
    expect(gruppieren(eintraege, (e) => e.automatisch).map((a) => a.art)).toEqual(
      Array(5).fill('einzeln'),
    );
  });

  it('fasst fünf und mehr hintereinander zusammen, mit ihrer Stelle in der Liste', () => {
    const eintraege = [
      { id: 'a', automatisch: false },
      ...auto(5),
      { id: 'b', automatisch: false },
    ];
    const abschnitte = gruppieren(eintraege, (e) => e.automatisch);
    expect(abschnitte.map((a) => a.art)).toEqual(['einzeln', 'gruppe', 'einzeln']);
    const gruppe = abschnitte[1];
    expect(gruppe.art === 'gruppe' && gruppe.schluessel).toBe(1);
    expect(gruppe.art === 'gruppe' && gruppe.eintraege.map((e) => e.index)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('ein eingetragener Eintrag unterbricht die Folge', () => {
    const eintraege = [...auto(3), { id: 'x', automatisch: false }, ...auto(3)];
    expect(gruppieren(eintraege, (e) => e.automatisch).every((a) => a.art === 'einzeln')).toBe(
      true,
    );
  });
});

describe('gruppenText', () => {
  it('nennt Anzahl und Jahre', () => {
    expect(gruppenText(12, '2022-03-01', '2026-03-01')).toBe('12 automatische Preise, 2022–2026');
    expect(gruppenText(5, '2026-01-01', '2026-12-01')).toBe('5 automatische Preise, 2026');
  });
});

describe('neuHinweisText', () => {
  it('nennt Anzahl und Jahre, eine Stufe in der Einzahl', () => {
    expect(neuHinweisText(5, '2022-03-01', '2026-03-01')).toBe(
      'Beim Speichern werden 5 automatische Preise angelegt (2022–2026)',
    );
    expect(neuHinweisText(1, '2022-03-01', '2022-03-01')).toBe(
      'Beim Speichern wird 1 automatischer Preis angelegt (2022)',
    );
  });
});
