# Haushaltsbuch-Frontend

Frontend der Haushaltsbuch-Anwendung: eine Angular-SPA, die über das
[Haushaltsbuch-Backend](https://github.com/bjoernb94/Haushaltsbuch-Backend) (Spring Boot,
Keycloak) läuft. Die Seiten folgen dem Design-Canvas „Haushaltsbuch“.

## Voraussetzungen

- Node.js in der Version aus `.nvmrc` (z.&nbsp;B. `nvm use`) und npm (Version siehe `packageManager` in
  `package.json`)
- Für den echten Betrieb: das Backend auf `localhost:8080`, mit Keycloak

```bash
npm ci
```

## Starten

```bash
npm start
```

Die App läuft unter http://localhost:4200. Der Dev-Server leitet `/api`, `/actuator/health/systemstatus`
und `/actuator/info` an `http://localhost:8080` weiter (`proxy.conf.json`); so laufen Session- und
CSRF-Cookie über denselben Origin. Es sind dieselben Pfade wie bei nginx im Image (siehe
[Betrieb](docs/betrieb.md#container)), damit lokal nichts funktioniert, was im Image scheitert.

Für Login und Registrierung müssen Backend und Keycloak laufen: `./mvnw spring-boot:run` und
Keycloak z.&nbsp;B. per `docker compose up -d keycloak` (Einrichtung siehe README des Backends).
Ist Keycloak nicht erreichbar, zeigt die Login-Seite „Anmeldeserver nicht erreichbar“ und sperrt
das Formular.

Nach dem Verschieben oder Umbenennen von Dateien den Dev-Server neu starten, sonst liefert er
unter Umständen noch das alte Bundle aus.

## Build und Tests

```bash
npm run build          # Production-Build nach dist/
npm run lint           # ESLint inkl. Template-Regeln
npm run format:check   # Prettier (npm run format formatiert)
npm test               # Unit-Tests (Vitest), im Watch-Modus
npm run test:ci        # Unit-Tests einmalig, mit Abdeckung (coverage/) und JUnit (junit/)
npm run e2e            # E2E-Tests (Playwright) in Chromium und Firefox
npm run image:pruefen  # gebautes Container-Image starten und prüfen (Podman)
npm run api:typen      # API-Typen aus der OpenAPI-Beschreibung des Backends erzeugen
```

Tests, CI und API-Typen beschreibt [`docs/entwicklung.md`](docs/entwicklung.md#tests-und-ci).

## Veröffentlichen

Ein Release entsteht aus einem Tag auf `main`, nicht von Hand. Der Workflow `.github/workflows/release.yml`
prüft, dass der Tag zur Version in der `package.json` passt, führt die CI aus (`build.yml`), baut das Image,
prüft es mit `npm run image:pruefen` und veröffentlicht genau dieses Image als
`ghcr.io/bjoernb94/haushaltsbuch-frontend`. Danach legt er das GitHub Release mit generierten Notes an
(gruppiert nach den Labels der Pull Requests, siehe `.github/release.yml`).

Zu jeder Version gehört ein Milestone mit genau ihrem Namen, auch für Bugfix-Releases (z.&nbsp;B. `v0.2.1`).
Der Workflow bricht ab, wenn es ihn nicht gibt, er schon geschlossen ist oder noch Issues darin offen sind,
und nennt die offenen Issues. Nach einem erfolgreichen Release schließt er ihn.

1. Version per Pull Request anheben: `npm version 0.2.0 --no-git-tag-version` ändert `package.json` und
   `package-lock.json`.
2. Nach dem Merge auf `main` taggen: `git tag v0.2.0 && git push origin v0.2.0`.

Frontend und Backend zählen gleich hoch; das Backend wird zuerst veröffentlicht. Solange die Hauptversion 0
ist, ist jedes Release eine Vorabversion (Pre-release) und das Image bekommt nur die Tags `0.2.0` und `0.2`;
ab 1.0 kommt `latest` dazu. Das Image ist privat wie das Repo: Zum Herunterladen vorher
`podman login ghcr.io` mit einem Token mit `read:packages`. Es gibt nur ein Image für amd64.

## Dokumentation

| Datei                                                                                              | Inhalt                                                                                 |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`docs/entwicklung.md`](docs/entwicklung.md)                                                       | Anmeldung, Oberfläche, Tests und CI, API-Typen, Git, Fachbereich anlegen, Konventionen |
| [`docs/betrieb.md`](docs/betrieb.md)                                                               | Container-Image, `instanz.json`, Sicherheits-Header                                    |
| [Entscheidungen](https://github.com/bjoernb94/Haushaltsbuch-Backend/tree/main/docs/entscheidungen) | Architekturentscheidungen (ADRs) für Backend und Frontend, im Backend                  |
| [`docs/api.md`](https://github.com/bjoernb94/Haushaltsbuch-Backend/blob/main/docs/api.md)          | API, Fehlercodes und Datenformate, im Backend                                          |

## Projektstruktur

```
src/app/
  core/        Dienste ohne eigene Oberfläche: api/, auth/, fehler/, instanz/, komponenten/,
               systemstatus/, ungespeichert/, version/
  features/    Seiten, lazy geladen
    anmeldung/   login/, registrierung/ und ihr gemeinsamer anmelde-rahmen/
    einstellungen/ Systemstatus, Version und Umgebung, rechtliche Links (über das Kontomenü)
    rechtliches/ Impressum und Datenschutz, mit und ohne Session erreichbar
    start/       Startseite nach der Anmeldung
    vertraege/   je ein Backend-Modul (weitere kommen mit ihren Seiten dazu), nach Bereich gegliedert:
      liste/       Seite mit Kennzahlen und Liste, Zeile, Chips, Navigation der Kind-Routen
      details/     Details mit Preisen, Preisverlauf und Einmalkosten
      formular/    Formular mit je einer Komponente pro Tab, Prüfung, Neuer Vertrag, Bearbeiten
                   und die Bausteine der Tabs (Preisliste, Einmalkosten, Preissteigerung, Zusammenfassung)
                   oben: Service, Routen und vertrag-texte.ts
  shared/      Bausteine für mehrere Bereiche: bestaetigen-dialog/, format/, formular/, fusszeile/,
               herkunft/, hinweis-box/, in-den-blick/, kopfzeile/, layout/, logo/, nutzermenue/,
               rechtliche-links/, rundungshinweis/, seitenaktionen/, systemstatus-leiste/, tabliste/,
               version-anzeige/, verwerfen-dialog/, zustaende/
  shell/       Rahmen der angemeldeten Bereiche (hauptmenue/ als Seitenleiste, bis 900 px als Tab-Leiste,
               Fußzeile); die Startseite kommt ab 901 px ohne Navigation aus (Route-Data ohneNavigation)
               und behält die Kopfzeile
src/styles.scss          Farb-Tokens (--app-*) des Designs und Grundstile
```

## Lizenz

Copyright © 2026 Björn Bochmann. Veröffentlicht unter der
[GNU Affero General Public License v3.0](LICENSE) oder einer späteren Version (`AGPL-3.0-or-later`).
Wer das Frontend verändert und anderen über ein Netzwerk bereitstellt, muss ihnen den geänderten
Quellcode zugänglich machen (Abschnitt 13 der Lizenz).
