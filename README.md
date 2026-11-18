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
[Container](#container)), damit lokal nichts funktioniert, was im Image scheitert.

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
erreichbar. Fehlt ein Dienst, sind Login und Registrierung gesperrt; in der App zeigen ihn nur die
Einstellungen (Kontomenü), Impressum und Datenschutz in der Fußzeile.

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

## Oberfläche

Das Design im Canvas „Haushaltsbuch“ ist maßgeblich (ADR 0020, siehe [Konventionen](#konventionen)).

### Layout

- **Ab 901 px:** Die angemeldeten Bereiche haben eine mitlaufende Seitenleiste mit Logo
  (`shell/hauptmenue`). Die Kopfzeile klappt dort ein, nur das Nutzermenü wandert ans untere Ende der
  Seitenleiste. Die Startseite kommt ohne Navigation aus (Route-Data `ohneNavigation`), ihre Kacheln
  navigieren, und sie behält die grüne Kopfzeile.
- **Bis 900 px:** Jede Seite hat eine mitlaufende, durchscheinende Kopfzeile ohne Logo. Die Shell ergänzt
  die Tab-Leiste (auch auf der Startseite) und blendet ihre Fußzeile aus.
- **Seitenaktionen:** „Zurück“ und „+“ stehen bis 900 px in der Kopfzeile. Seiten melden sie mit
  `seitenaktionenMelden()` (`shared/seitenaktionen`), ihr eigenes „Zurück“ ist dort ausgeblendet. Meldet
  eine Seite `eigeneLeiste` (Neuer Vertrag: Abbrechen | Sichern), bekommt sie weder Kopfzeile noch
  Tab-Leiste.

### Verträge

Details (`/vertraege/:id`, Tab in `?tab=`) und Bearbeiten (`/vertraege/:id/bearbeiten`) sind Kind-Routen
der Liste. Die Liste lädt die Daten und gibt sie weiter; `GET /api/vertraege/{id}` nutzt die SPA deshalb
bewusst nicht. Neuer Vertrag (`/vertraege/neu`) ist eine eigene Seite.

- Auf dem Desktop stehen die Details in einem Panel neben der Liste, Bearbeiten öffnet ein modales Sheet
  (natives `dialog`). Bis 900 px nehmen beide den ganzen Bildschirm ein.
- Schließen geht im Verlauf zurück, wenn die Seite den Eintrag selbst geöffnet hat (Navigation-State
  `intern`), sonst ersetzt es ihn. So schließt der Zurück-Button, und geteilte Links funktionieren.
- Esc, ein Klick daneben und der Zurück-Button schließen alle über die Route, damit
  `ungespeichertGuard` nachfragt. Navigationen innerhalb der Seite übergeben `scroll: 'manual'`.

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

Die E2E-Tests simulieren das Backend im Browser (`e2e/backend-mock.ts`) und brauchen weder
Backend noch Keycloak. Playwright startet den Dev-Server selbst oder nutzt einen bereits
laufenden auf Port 4200. Die Browser installiert einmalig `npx playwright install chromium firefox`.

Die CI (`.github/workflows/build.yml`) führt Lint, Formatprüfung, Production-Build,
`npm audit` für die Laufzeit-Abhängigkeiten, Unit- und E2E-Tests aus. Die E2E-Tests verteilt sie
auf drei Jobs: Chromium und Firefox in zwei Teilen. Diese laufen im offiziellen Playwright-Image, in
dem Browser und Systempakete schon installiert sind. Seine Version liest die CI aus
`package-lock.json`, sie folgt also jedem Update von Playwright. Außerdem baut sie das Container-Image,
startet es und prüft es. Dieser Job läuft wegen Podman direkt auf dem Runner, die Prüfung startet
Playwright aber im selben Image (`PLAYWRIGHT_IMAGE` für `npm run image:pruefen`). Lokal nutzt sie
ohne diese Variable die installierten Browser.

Die Testergebnisse stehen im PR als eigene Checks („Ergebnisse Unit-Tests“, „Ergebnisse E2E …“ je
Teil, „Ergebnisse Container-Image“) und im Summary des jeweiligen Jobs, auch bei grünem Build. Die
Abdeckung der Unit-Tests steht im Check und im Job-Summary, ohne Mindestwert; den HTML-Bericht lädt
die CI immer als Artefakt `abdeckung` hoch. Alle Tests schreiben JUnit nach `junit/`. Die
Playwright-Berichte lädt die CI nur bei Fehlern hoch.

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
(Standard `http://backend:8080`), damit die Cookies beim selben Origin bleiben (ADR 0019). `npm run image` gibt
Commit und Build-Zeit als `--build-arg` (`COMMIT`, `BUILD_ZEIT`) mit; sie stehen später im
Impressum. Ohne diese Angaben fehlen sie dort, die Version aus der `package.json` steht immer.

Impressum und Datenschutzerklärung brauchen die Angaben des Betreibers. Sie stehen nicht im Image,
sondern in einer Datei `instanz.json`, die beim Start eingehängt wird, z.&nbsp;B.
`-v ./instanz.json:/usr/share/nginx/html/instanz.json:ro`. Fehlt die Datei oder ist sie
unvollständig, zeigen beide Seiten einen Hinweis statt der Angaben:

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
  "stand": "2026-11-08"
}
```

Das sind Platzhalter aus `beispiel/instanz.json`. Der Dev-Server (`npm start`) liefert sie als
`/instanz.json` aus, E2E-Tests und Image-Prüfung nutzen sie ebenfalls; im Produktions-Build und im
Image stehen sie nicht. Für eine echte Instanz eine eigene Datei mit den Angaben des Betreibers
einhängen, nie die Beispieldatei.

Lizenz und Quellcode stehen immer im Impressum, auch ohne `instanz.json`. Die Lizenz ist fest, die
Links zum Quellcode zeigen auf die Repos von Frontend und Backend, mit bekanntem Commit genau auf
diesen Stand. Wer eine geänderte Version betreibt, muss den Nutzern ihren Quellcode anbieten
(Abschnitt 13 der AGPL) und ersetzt die Links mit `quellcode` (je optional, nur http(s); gilt auch,
wenn die Betreiberangaben fehlen):

```json
{
  "quellcode": {
    "frontend": "https://example.org/fork/haushaltsbuch-frontend",
    "backend": "https://example.org/fork/haushaltsbuch-backend"
  }
}
```

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

## Fachbereich anlegen

Ein neuer Bereich (z.&nbsp;B. Finanzübersicht) folgt dem Muster von `features/vertraege/`:

- [ ] **Design:** Desktop- und 390-px-Artboards im [Canvas](https://claude.ai/artifact/U1DJUDYTgy9efP1dHJm5Hx)
      sind fertig, neue Farben oder Bausteine stehen zuerst im Design System.
- [ ] **Ordner:** `features/<modul>/` wie das Backend-Modul, darin oben Service, Routen und Texte, darunter
      ein Unterordner je Bereich der Oberfläche (`liste/`, `details/`, `formular/`), nicht je Schicht. Keine Datei
      über 400 Zeilen: große Formulare je Tab aufteilen, Navigation oder Hilfsfunktionen in eigene Dateien.
- [ ] **Service ohne Daten** (ADR 0018): nur Aufrufe mit `HttpClient`, die Seite lädt beim Öffnen und
      nach Änderungen neu. Typen aus `core/api/api.ts`, nach einer API-Änderung `npm run api:typen`.
- [ ] **Routen:** lazy in `app.routes.ts` mit `bereichGuard('<KOMPONENTE>')`, jede Route mit Seitentitel
      (`'<Seite> – Haushaltsbuch'`), Formulare mit `ungespeichertGuard`. Seiten, zu denen „Zurück“ führen
      kann, bekommen ihren Namen in `shared/herkunft`.
- [ ] **Zustände:** Laden, Fehler mit „Erneut versuchen“ und leer; Fehlertexte nach `code`.
- [ ] **Navigation:** `verfuegbar: true` in `core/komponenten`, Pfad und Icon in `shell/hauptmenue`,
      Kachel auf der Startseite.
- [ ] **Tests:** Unit-Tests je Seite, Endpunkte in `backendSimulieren()` (`e2e/backend-mock.ts`, eigene
      Datei wie `e2e/vertraege-mock.ts`), E2E für Desktop und 390 px.

## Konventionen

ADR meint die [Entscheidungen](https://github.com/bjoernb94/Haushaltsbuch-Backend/tree/main/docs/entscheidungen)
im Backend.

- **Keine fachlichen Berechnungen in der SPA** (ADR 0010): Die SPA formatiert nur. Status, Kosten,
  Termine und Sortierung kommen vom Backend. Prüfungen im Formular dienen nur der Bedienung,
  maßgeblich sind die Feldfehler des Backends.
- **Fehlertexte nach `code`** (ADR 0007): `core/fehler` liest nur `code` und `felder` aus der
  Fehlerantwort, die Texte stehen in der Seite, die den Fehler zeigt. `detail` ist nur für Entwickler und wird nie
  angezeigt. Ohne bekannten `code` erscheint ein allgemeiner Text.
- **Geld:** Immer `Betrag` mit seiner Währung, nie EUR annehmen, Listen je Währung vollständig
  anzeigen. Einzige Ausnahme: Eine leere Liste zeigt `0,00 €`.
- **Daten:** Fachliche Daten sind ISO-Daten ohne Uhrzeit, und „heute“ bestimmt das Backend.
  Ausnahme ist reine Anzeige ohne fachliche Bedeutung, z.&nbsp;B. der Monat in der Begrüßung: Sie
  darf aus dem Browser kommen.
- **Aufbau eines Fachbereichs:** ein Ordner je Backend-Modul unter `features/` mit Service und
  Seiten. Services halten keine Fachdaten (ADR 0018): Die Daten liegen in der Seite und werden beim Öffnen
  geladen, nach einer Änderung neu. So bleibt nach dem Abmelden nichts für den nächsten Nutzer im
  Speicher. Ausgenommen sind Sitzungsdaten im `AuthService` und der Systemstatus.
- **Zustände einer Seite:** Jede Seite mit Daten hat einen Lade- und einen Fehlerzustand mit
  „Erneut versuchen“ sowie einen Leerzustand.
- **Angular:** Standalone-Komponenten, Signals, `OnPush` und zoneless (ADR 0017); `strict` und
  `strictTemplates` sind an.
- **Oberfläche ohne UI-Bibliothek** (ADR 0016): Markup nach Design, Icons als Inline-SVG, die Schrift
  Manrope lokal aus `@fontsource-variable/manrope`, Formularfelder und Buttons als Mixins in
  `shared/formular/_formular.scss`.
- **Design zuerst** (ADR 0020): Seiten und Verhalten entstehen im
  [Canvas „Haushaltsbuch“](https://claude.ai/artifact/U1DJUDYTgy9efP1dHJm5Hx), der Code folgt daraus.
  Die Farb-Tokens `--app-*` in `src/styles.scss` sind genau die Farben des
  [Design Systems „Haushaltsbuch“](https://claude.ai/artifact/1mDWVeKNzU1Mp3Co6TFD7H), mit denselben
  Namen; eine neue Farbe oder ein neuer Baustein kommt zuerst dorthin. Weicht der Code bewusst ab, wird
  erst das Artboard angepasst oder die Abweichung am Issue festgehalten.
- **Maße nur aus den Skalen:** Schriftgrößen, Radien und Abstände (`gap`, `padding`, `margin`) kommen aus
  `src/styles/_masse.scss` (`@use 'masse' as *;`) und heißen wie im Design System: `$abstand-1` bis
  `$abstand-12` (Zahl × 4 px) und `$abstand-halb`, `$radius-klein` bis `$radius-pille`, `$schrift-klein` bis
  `$schrift-anzeige`. Feste Werte nur für Ausnahmen mit Kommentar: 1-px-Linien, Zeilenhöhen, Layoutmaße.

## Lizenz

Copyright © 2026 Björn Bochmann. Veröffentlicht unter der
[GNU Affero General Public License v3.0](LICENSE) oder einer späteren Version (`AGPL-3.0-or-later`).
Wer das Frontend verändert und anderen über ein Netzwerk bereitstellt, muss ihnen den geänderten
Quellcode zugänglich machen (Abschnitt 13 der Lizenz).
