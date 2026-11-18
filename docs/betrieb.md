# Betrieb

Container-Image, Angaben des Betreibers (`instanz.json`) und Sicherheits-Header. Wie die ganze
Anwendung per Compose startet, steht in
[`docs/betrieb.md`](https://github.com/bjoernb94/Haushaltsbuch-Backend/blob/main/docs/betrieb.md) im Backend.

## Container

```bash
npm run image
```

Das Image (`Containerfile`) baut die App und liefert sie mit nginx ohne Root-Rechte auf Port 8080
aus. nginx leitet `/api`, `/actuator/health/systemstatus` und `/actuator/info` an `BACKEND_URL` weiter
(Standard `http://backend:8080`), damit die Cookies beim selben Origin bleiben (ADR 0019). `npm run image` gibt
Commit und Build-Zeit als `--build-arg` (`COMMIT`, `BUILD_ZEIT`) mit; sie stehen später im
Impressum. Ohne diese Angaben fehlen sie dort, die Version aus der `package.json` steht immer.

## Angaben des Betreibers

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

## Sicherheits-Header

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
