## Worum geht es?

<!-- Kurz: was ändert sich und warum. -->

Closes #

## Checkliste

- [ ] Tests ergänzt bzw. angepasst, alle CI-Prüfungen lokal grün (auch `npm run image` und `npm run image:pruefen`)
- [ ] Neue oder geänderte Endpunkte in `backendSimulieren()` (`e2e/backend-mock.ts`) im echten Format
- [ ] API im Backend geändert? `npm run api:typen` ausgeführt, Ergebnis eingecheckt, Backend-PR verlinkt
- [ ] API-Anbindung geändert? Gegen das echte Backend geprüft
- [ ] Neue Fehlercodes mit Text versehen
- [ ] Neue Seite? Lade-, Fehler- und Leerzustand, Seitentitel, `bereichGuard`
- [ ] Doku angepasst, wo nötig: `README.md`, `CLAUDE.md`
- [ ] Architekturentscheidung? Neuer Eintrag unter `docs/entscheidungen` im Backend
- [ ] Seitenverhalten geändert? Artboards im Design angepasst
- [ ] Neue Farbe oder neuer Baustein? Zuerst im Design System, dann in `styles.scss` (ADR 0020, #112)
- [ ] Layout geändert? Screenshots für Desktop und ≤ 900 px im PR
- [ ] Passwort-Richtlinie geändert? `passwort-regeln.ts` angepasst
- [ ] Label und Milestone gesetzt
