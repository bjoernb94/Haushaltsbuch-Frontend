# Haushaltsbuch-Frontend

Frontend der Haushaltsbuch-Anwendung: eine Angular-SPA, die über das
[Haushaltsbuch-Backend](https://github.com/bjoernb94/Haushaltsbuch-Backend) (Spring Boot,
Keycloak) läuft. Die Seiten folgen dem Design-Canvas „Haushaltsbuch“.

## Voraussetzungen

- Node.js 24 und npm (Version siehe `packageManager` in `package.json`)
- Für den echten Betrieb: das Backend auf `localhost:8080`, mit Keycloak

```bash
npm ci
```

## Starten

```bash
npm start
```

Die App läuft unter http://localhost:4200. Der Dev-Server leitet `/api` und `/actuator` an
`http://localhost:8080` weiter (`proxy.conf.json`); so laufen Session- und CSRF-Cookie über
denselben Origin.

Für Login und Registrierung muss das Backend mit `SPRING_PROFILES_ACTIVE=dev,keycloak` laufen
(Einrichtung siehe README des Backends). Ohne Profil `keycloak` gibt es dort keine Anmeldung;
die Login-Seite zeigt dann „Anmeldeserver nicht erreichbar“ und sperrt das Formular.

Nach dem Verschieben oder Umbenennen von Dateien den Dev-Server neu starten, sonst liefert er
unter Umständen noch das alte Bundle aus.

## Anmeldung

Es gibt keine Weiterleitung zu Keycloak: Login und Registrierung sind eigene Seiten der SPA.

| Aufruf                              | Zweck                                                |
| ----------------------------------- | ---------------------------------------------------- |
| `POST /api/anmeldung`               | Login mit E-Mail und Passwort, Backend setzt Session |
| `POST /api/registrierung`           | Konto anlegen, danach direkt angemeldet              |
| `POST /api/abmeldung`               | Abmelden                                             |
| `GET /api/nutzer/ich`               | Status: angemeldet (Profil) oder 401                 |
| `GET /actuator/health/systemstatus` | Erreichbarkeit von Datenbank und Anmeldeserver       |

- `AuthService` (`core/auth`) hält den angemeldeten Nutzer als Signal. Die Guards schicken
  Abgemeldete zum Login (mit `returnUrl`) und Angemeldete von Login und Registrierung zur
  Startseite.
- Der `authInterceptor` leitet bei 401 unter `/api/**` zum Login um. Aufrufe, bei denen 401
  erwartet ist (Login, Statusabfrage), setzen dafür `OHNE_ANMELDE_UMLEITUNG`.
- CSRF: Angular schickt den Header `X-XSRF-TOKEN` aus dem Cookie `XSRF-TOKEN` mit (nur bei
  relativen URLs, deshalb laufen alle Aufrufe über `/api`).

### Systemstatus

Login, Registrierung und die Fußzeile der App fragen den Systemstatus beim Öffnen und dann alle
30&nbsp;s ab. Ist das Backend nicht erreichbar, gelten auch Datenbank und Anmeldeserver als nicht
erreichbar. Fehlt ein Dienst, sind Login und Registrierung gesperrt; in der App wird der Status
nur angezeigt.

### Passwortregeln

Die Registrierung prüft die Passwort-Richtlinie des Keycloak-Realms schon im Formular
(`features/anmeldung/registrierung/passwort-regeln.ts`). Entscheidend bleibt Keycloak: Wird die
Richtlinie dort geändert, muss die Datei angepasst werden.

## Build und Tests

```bash
npm run build          # Production-Build nach dist/
npm run lint           # ESLint inkl. Template-Regeln
npm run format:check   # Prettier (npm run format formatiert)
npm test               # Unit-Tests (Vitest), im Watch-Modus
npm run test:ci        # Unit-Tests einmalig
npm run e2e            # E2E-Tests (Playwright)
```

Die E2E-Tests simulieren das Backend im Browser (`e2e/backend-mock.ts`) und brauchen weder
Backend noch Keycloak. Playwright startet den Dev-Server selbst oder nutzt einen bereits
laufenden auf Port 4200.

Die CI (`.github/workflows/build.yml`) führt Lint, Formatprüfung, Production-Build, Unit- und
E2E-Tests aus.

### IntelliJ Run Configurations

Gemeinsame Run Configurations liegen in `.run/`, u.&nbsp;a. „Run Frontend“, „Unit-Tests“,
„E2E-Tests“, „Lint“, „Formatieren“ und „Container-Image bauen“.

## Container

```bash
npm run image
```

Das Image (`Containerfile`) baut die App und liefert sie mit nginx aus. nginx leitet `/api` und
`/actuator` an `BACKEND_URL` weiter (Standard `http://backend:8080`), damit die Cookies beim
selben Origin bleiben.

## Projektstruktur

```
src/app/
  core/        Dienste ohne eigene Oberfläche: auth/, komponenten/, systemstatus/
  features/    Seiten, lazy geladen
    anmeldung/   login/, registrierung/ und ihr gemeinsamer anmelde-rahmen/
    start/       Startseite nach der Anmeldung
    buchungen/, vertraege/, versorgung/, portfolio/, nutzer/   je ein Backend-Modul
  shared/      Bausteine für mehrere Bereiche: hinweis-box/, systemstatus-leiste/
  shell/       Rahmen der angemeldeten Bereiche (Kopfzeile, Navigation, Fußzeile)
src/styles.scss          Material-Theme und Farb-Tokens (--app-*) des Designs
src/styles/_theme-colors.scss   aus der Designfarbe erzeugte Material-Paletten
```
