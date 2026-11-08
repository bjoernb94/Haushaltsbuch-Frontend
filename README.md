# Haushaltsbuch-Frontend

Frontend der Haushaltsbuch-Anwendung: eine Angular-SPA, die über das
[Haushaltsbuch-Backend](https://github.com/bjoernb94/Haushaltsbuch-Backend) (Spring Boot,
Keycloak) läuft. Die Seiten folgen dem Design-Canvas „Haushaltsbuch“.

## Voraussetzungen

- Node.js 26 und npm (Version siehe `packageManager` in `package.json`)
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

Für Login und Registrierung müssen Backend und Keycloak laufen: `./mvnw spring-boot:run` und
Keycloak z.&nbsp;B. per `docker compose up -d keycloak` (Einrichtung siehe README des Backends).
Ist Keycloak nicht erreichbar, zeigt die Login-Seite „Anmeldeserver nicht erreichbar“ und sperrt
das Formular.

Nach dem Verschieben oder Umbenennen von Dateien den Dev-Server neu starten, sonst liefert er
unter Umständen noch das alte Bundle aus.

## Anmeldung

Es gibt keine Weiterleitung zu Keycloak: Login und Registrierung sind eigene Seiten der SPA.
Alle Endpunkte, Fehlercodes und Datenformate stehen in
[`docs/api.md`](https://github.com/bjoernb94/Haushaltsbuch-Backend/blob/main/docs/api.md) im
Backend, die Gründe in den
[Entscheidungen](https://github.com/bjoernb94/Haushaltsbuch-Backend/tree/main/docs/entscheidungen)
(ADRs).

| Aufruf                              | Zweck                                                |
| ----------------------------------- | ---------------------------------------------------- |
| `POST /api/anmeldung`               | Login mit E-Mail und Passwort, Backend setzt Session |
| `POST /api/registrierung`           | Konto anlegen, danach direkt angemeldet              |
| `POST /api/abmeldung`               | Abmelden                                             |
| `GET /api/nutzer/ich`               | Status: angemeldet (Profil) oder 401                 |
| `GET /api/nutzer/ich/komponenten`   | Gebuchte Komponenten                                 |
| `GET /actuator/health/systemstatus` | Erreichbarkeit von Datenbank und Anmeldeserver       |

- `AuthService` (`core/auth`) hält den angemeldeten Nutzer als Signal. Die Guards schicken
  Abgemeldete zum Login (mit `returnUrl`) und Angemeldete von Login und Registrierung zur
  Startseite.
- Der `authInterceptor` leitet bei 401 unter `/api/**` zum Login um. Aufrufe, bei denen 401
  erwartet ist (Login, Statusabfrage), setzen dafür `OHNE_ANMELDE_UMLEITUNG`. Auf `/login` leitet
  er nicht erneut um, damit ein weiteres 401 die `returnUrl` nicht überschreibt.
- `AuthService` lädt mit dem Nutzer auch die gebuchten Komponenten. Die Navigation zeigt nur
  gebuchte Bereiche, noch nicht verfügbare ausgegraut ohne Link; `bereichGuard` leitet alles
  andere zur Startseite um. Scheitert das Laden, zeigt die Shell einen Hinweis mit „Erneut
  versuchen“. Bei 403 `KEIN_ZUGRIFF` lädt der `authInterceptor` die Komponenten neu und geht zur
  Startseite.
- CSRF: Angular schickt den Header `X-XSRF-TOKEN` aus dem Cookie `XSRF-TOKEN` mit (nur bei
  relativen URLs, deshalb laufen alle Aufrufe über `/api`).

### Systemstatus

Login, Registrierung und die Fußzeile der App fragen den Systemstatus beim Öffnen und dann alle
30&nbsp;s ab. Ist das Backend nicht erreichbar, gelten auch Datenbank und Anmeldeserver als nicht
erreichbar. Fehlt ein Dienst, sind Login und Registrierung gesperrt; in der App wird der Status
nur angezeigt.

### Ungespeicherte Eingaben

Ein Formular meldet Änderungen an `core/ungespeichert`. Wer es verlässt, wird im Dialog der Shell
gefragt: `ungespeichertGuard` (`canDeactivate`) auf Routen mit Formular, `bestaetigen()` für alles andere,
das ein Formular schließt oder verlässt, etwa das Abmelden. Umleitungen, die passieren müssen (401, 403),
und erfolgreiches Speichern rufen vorher `vergessen()` auf. Beim Schließen des Tabs und beim Neuladen
erscheint nur der Standarddialog des Browsers.

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
npm run e2e            # E2E-Tests (Playwright) in Chromium und Firefox
npm run image:pruefen  # gebautes Container-Image starten und prüfen (Podman)
npm run api:typen      # API-Typen aus der OpenAPI-Beschreibung des Backends erzeugen
```

Die E2E-Tests simulieren das Backend im Browser (`e2e/backend-mock.ts`) und brauchen weder
Backend noch Keycloak. Playwright startet den Dev-Server selbst oder nutzt einen bereits
laufenden auf Port 4200. Die Browser installiert einmalig `npx playwright install chromium firefox`.

Die CI (`.github/workflows/build.yml`) führt Lint, Formatprüfung, Production-Build,
`npm audit` für die Laufzeit-Abhängigkeiten, Unit- und E2E-Tests aus. Die E2E-Tests verteilt sie
auf drei Jobs: Chromium und Firefox in zwei Teilen. Außerdem baut sie das Container-Image, startet
es und prüft es.

### API-Typen

Die Typen der API stehen in `src/app/core/api/api.generated.ts`. `npm run api:typen` erzeugt die
Datei aus `../Haushaltsbuch-Backend/docs/openapi.json`, das Backend muss also daneben ausgecheckt
sein. Nach einer API-Änderung im Backend das Skript ausführen und das Ergebnis mit einchecken. Die
CI kann das private Backend-Repo nicht abrufen und prüft nur, dass der eingecheckte Stand
kompiliert. Sprechende Namen für die Typen stehen in `core/api/api.ts`.

### Arbeitsweise mit Git

Auf `main` wird nicht direkt committet. Jede Änderung entsteht auf einem eigenen Branch und
kommt per Pull Request nach `main`, sobald die CI grün ist.

- Branch-Namen: `feature/<kurzname>` für neue Funktionen, `fix/<kurzname>` für Fehlerbehebungen,
  `docs/<kurzname>` für reine Doku-Änderungen, `chore/<kurzname>` für Wartung (Abhängigkeiten,
  Konfiguration, Umbauten ohne neue Funktion). Gehört der Branch zu einem Issue, die Nummer
  voranstellen, z.&nbsp;B. `feature/12-haushalt`.
- Pull Requests folgen der Vorlage (`.github/pull_request_template.md`).
- Im Pull Request das Issue mit `Closes #<nummer>` verknüpfen, damit es beim Merge geschlossen wird.
- Branches nach dem Merge löschen.

### IntelliJ Run Configurations

Gemeinsame Run Configurations liegen in `.run/`, u.&nbsp;a. „Run Frontend“, „Unit-Tests“,
„E2E-Tests“, „Lint“, „Formatieren“ und „Container-Image bauen“.

## Container

```bash
npm run image
```

Das Image (`Containerfile`) baut die App und liefert sie mit nginx ohne Root-Rechte auf Port 8080
aus. nginx leitet `/api`, `/actuator/health/systemstatus` und `/actuator/info` an `BACKEND_URL` weiter
(Standard `http://backend:8080`), damit die Cookies beim selben Origin bleiben. `npm run image` gibt
Commit und Build-Zeit als `--build-arg` (`COMMIT`, `BUILD_ZEIT`) mit; sie stehen später im
Impressum. Ohne diese Angaben fehlen sie dort, die Version aus der `package.json` steht immer.

Impressum und Datenschutzerklärung brauchen die Angaben des Betreibers. Sie stehen nicht im Image,
sondern in einer Datei `instanz.json`, die beim Start eingehängt wird, z.&nbsp;B.
`-v ./instanz.json:/usr/share/nginx/html/instanz.json:ro`. Fehlt die Datei oder ist sie
unvollständig, zeigen beide Seiten einen Hinweis statt der Angaben. `lizenz` und `quellcode` (nur
http(s)) sind optional:

```json
{
  "betreiber": {
    "name": "Erika Beispiel",
    "anschrift": ["Beispielstraße 1", "12345 Beispielstadt"],
    "email": "betrieb@example.org"
  },
  "rechtsgrundlage": "Art. 6 Abs. 1 lit. b DSGVO",
  "speicherort": "Beispiel-Rechenzentrum (Platzhalter)",
  "logAufbewahrungTage": 14,
  "stand": "2026-11-08",
  "lizenz": "Beispiel-Lizenz (Platzhalter)",
  "quellcode": "https://example.org/haushaltsbuch"
}
```

Das sind Platzhalter aus `beispiel/instanz.json`. Der Dev-Server (`npm start`) liefert sie als
`/instanz.json` aus, E2E-Tests und Image-Prüfung nutzen sie ebenfalls; im Produktions-Build und im
Image stehen sie nicht. Für eine echte Instanz eine eigene Datei mit den Angaben des Betreibers
einhängen, nie die Beispieldatei.

Die Sicherheits-Header stehen in `docker/nginx/sicherheits-header.conf`, darunter eine strenge
Content Security Policy. `style-src` erlaubt `'unsafe-inline'`, weil Angular Komponenten-Styles zur
Laufzeit anlegt. Damit `script-src 'self'` ohne Hashes reicht, ist `inlineCritical` im
Production-Build aus, denn es schreibt ein Inline-Skript in `index.html`. HSTS gehört zur
TLS-Terminierung und folgt mit v1.0. Die Header greifen nur im Image, nicht bei `npm start`.

Deshalb prüft `npm run image:pruefen` (`e2e-image/`) das laufende Image: Die App läuft ohne
CSP-Verstoß, die Header sind gesetzt, tiefe Links liefern `index.html`, die eingehängte
`instanz.json` kommt an, und nur `/api`, der Systemstatus sowie Version und Umgebung gehen ans
Backend. Das Backend ist dabei eine Attrappe im selben Pod. Vorher muss
`npm run image` gelaufen sein.

## Projektstruktur

```
src/app/
  core/        Dienste ohne eigene Oberfläche: api/, auth/, fehler/, instanz/, komponenten/,
               systemstatus/, ungespeichert/, version/
  features/    Seiten, lazy geladen
    anmeldung/   login/, registrierung/ und ihr gemeinsamer anmelde-rahmen/
    rechtliches/ Impressum und Datenschutz, mit und ohne Session erreichbar
    start/       Startseite nach der Anmeldung
    vertraege/   je ein Backend-Modul; weitere kommen mit ihren Seiten dazu
  shared/      Bausteine für mehrere Bereiche: bestaetigen-dialog/, format/, formular/, fusszeile/,
               hinweis-box/, in-den-blick/, kopfzeile/, layout/, logo/, nutzermenue/, rechtliche-links/,
               systemstatus-leiste/, version-anzeige/, verwerfen-dialog/, zustaende/
  shell/       Rahmen der angemeldeten Bereiche (Kopfzeile, hauptmenue/, Fußzeile); die Startseite
               kommt ohne Navigation aus (Route-Data ohneNavigation)
src/styles.scss          Farb-Tokens (--app-*) des Designs und Grundstile
```

## Konventionen

ADR meint die [Entscheidungen](https://github.com/bjoernb94/Haushaltsbuch-Backend/tree/main/docs/entscheidungen)
im Backend.

- **Keine fachlichen Berechnungen in der SPA** (ADR 0010): Die SPA formatiert nur. Status, Kosten,
  Termine und Sortierung kommen vom Backend. Prüfungen im Formular dienen nur der Bedienung,
  maßgeblich sind die Feldfehler des Backends.
- **Fehlertexte nach `code`** (ADR 0007): `core/fehler` liest `code` und `felder` aus der
  Fehlerantwort, die Texte stehen in der SPA. `detail` ist nur für Entwickler und wird nie
  angezeigt. Ohne bekannten `code` erscheint ein allgemeiner Text.
- **Geld:** Immer `Betrag` mit seiner Währung, nie EUR annehmen, Listen je Währung vollständig
  anzeigen. Einzige Ausnahme: Eine leere Liste zeigt `0,00 €`.
- **Daten:** Fachliche Daten sind ISO-Daten ohne Uhrzeit, und „heute“ bestimmt das Backend.
  Ausnahme ist reine Anzeige ohne fachliche Bedeutung, z.&nbsp;B. der Monat in der Begrüßung: Sie
  darf aus dem Browser kommen.
- **Aufbau eines Fachbereichs:** ein Ordner je Backend-Modul unter `features/` mit Service und
  Seiten. Services halten keine Fachdaten: Die Daten liegen in der Seite und werden beim Öffnen
  geladen, nach einer Änderung neu. So bleibt nach dem Abmelden nichts für den nächsten Nutzer im
  Speicher. Ausgenommen sind Sitzungsdaten im `AuthService` und der Systemstatus.
- **Zustände einer Seite:** Jede Seite mit Daten hat einen Lade- und einen Fehlerzustand mit
  „Erneut versuchen“ sowie einen Leerzustand.
