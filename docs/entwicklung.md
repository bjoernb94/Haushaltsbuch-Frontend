# Entwicklung

Aufbau und Verhalten der SPA, Tests und CI, Arbeitsweise und Konventionen. Starten, Befehle und
Projektstruktur stehen im [README](../README.md).

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

## Tests und CI

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

## API-Typen

Die Typen der API stehen in `src/app/core/api/api.generated.ts`. `npm run api:typen` erzeugt die
Datei aus `../Haushaltsbuch-Backend/docs/openapi.json`, das Backend muss also daneben ausgecheckt
sein. Nach einer API-Änderung im Backend das Skript ausführen und das Ergebnis mit einchecken. Die
CI kann das private Backend-Repo nicht abrufen und prüft nur, dass der eingecheckte Stand
kompiliert. Sprechende Namen für die Typen stehen in `core/api/api.ts`.

## Arbeitsweise mit Git

Auf `main` wird nicht direkt committet. Jede Änderung entsteht auf einem eigenen Branch und
kommt per Pull Request nach `main`, sobald die CI grün ist.

- Branch-Namen: `feature/<kurzname>` für neue Funktionen, `fix/<kurzname>` für Fehlerbehebungen,
  `docs/<kurzname>` für reine Doku-Änderungen, `chore/<kurzname>` für Wartung (Abhängigkeiten,
  Konfiguration, Umbauten ohne neue Funktion). Gehört der Branch zu einem Issue, die Nummer
  voranstellen, z.&nbsp;B. `feature/12-haushalt`.
- Pull Requests folgen der Vorlage (`.github/pull_request_template.md`).
- Im Pull Request das Issue mit `Closes #<nummer>` verknüpfen, damit es beim Merge geschlossen wird.
- Branches nach dem Merge löschen.

## IntelliJ Run Configurations

Gemeinsame Run Configurations liegen in `.run/`, u.&nbsp;a. „Run Frontend“, „Unit-Tests“,
„E2E-Tests“, „Lint“, „Formatieren“ und „Container-Image bauen“.

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
