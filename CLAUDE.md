# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Angular SPA of a household-budget app ("Haushaltsbuch"). Backend: `../Haushaltsbuch-Backend` (Spring Boot,
Keycloak, has its own CLAUDE.md). UI text, identifiers, comments, the README and `docs/` are in German; keep it
that way. Running the image and `instanz.json`: `docs/betrieb.md`; behaviour, tests and conventions in German:
`docs/entwicklung.md`.

## Commands

```bash
npm start              # dev server on :4200, proxies the same paths as nginx to :8080 (proxy.conf.json)
npm run build          # production build (budgets: initial 500 kB warning)
npm run lint           # ESLint incl. angular-eslint template + accessibility rules
npm run format:check   # Prettier; npm run format to fix (ng add/generate may reformat angular.json)
npm run test:ci        # Vitest unit tests once, with coverage and JUnit as in CI (npm test = watch)
npm run e2e            # Playwright (Chromium, Firefox, Mobile Chrome), backend simulated in the browser (e2e/backend-mock.ts)
npm run e2e:webkit     # Desktop and Mobile Safari in the Playwright image via Podman (WebKit needs Ubuntu/Debian)
npm run image:pruefen  # start the built image (npm run image) and check CSP, headers and nginx routes
npm run api:typen      # regenerate core/api/api.generated.ts from ../Haushaltsbuch-Backend/docs/openapi.json
npm run design:pruefen -- <dir>  # check a downloaded canvas or design system (<dir>/project/…) against the tokens
```

Playwright reuses a dev server already running on :4200. If that server predates moved/renamed files it may
serve a stale bundle; restart it, or run Playwright against a fresh `ng serve --port <other>`.

## Git workflow

- Never commit to `main` directly. Every change goes on its own branch and reaches `main` via pull request
  (CI must be green). Branch names: `feature/<kurzname>`, `fix/<kurzname>`, `docs/<kurzname>`, `chore/<kurzname>`,
  prefixed with the issue number if there is one (e.g. `feature/12-haushalt`). Link the issue in the PR with
  `Closes #<n>`.
- Before starting work, create the branch from an up-to-date `main` if you are still on `main`.
- PR descriptions follow `.github/pull_request_template.md`.
- Releases come only from a tag `v<version>` on `main` that matches `package.json` (`.github/workflows/release.yml`,
  README section "Veröffentlichen"); it requires an open milestone named exactly like the tag without open issues
  and closes it at the end. Release notes are grouped by PR labels, so label PRs by branch prefix: `feature/` →
  `enhancement`, `fix/` → `bug`, `docs/` → `documentation`, `chore/` → `technisch`.

## Architecture

- Standalone components, signals, `OnPush`, zoneless (ADR 0017); `strict` and `strictTemplates` are on.
- `core/` services without UI, `features/` lazy-loaded pages (one folder per backend module, plus
  `anmeldung/` for login/registration, `start/` and `einstellungen/`), `shared/` components used by several areas,
  `shell/` layout of the logged-in area (lazy, so login and registration do not load it), header and footer in
  `shared/kopfzeile` and `shared/fusszeile` (also used by imprint and privacy policy). From 901 px `/start` has
  no navigation (route data `ohneNavigation`), its tiles navigate, and keeps the green header; all other areas
  use `shell/hauptmenue`, a sticky sidebar with logo. There the header collapses and only the user menu
  (`shared/nutzermenue`, one instance) moves to the bottom of the sidebar. Up to 900 px every page has a sticky,
  translucent header without logo (blur on its own layer so the fixed menu is not trapped; raised above the tab
  bar while the menu is open), the shell adds the tab bar (also on `/start`) and hides its footer. Page actions
  in that header ("Zurück", "+") come from `shared/seitenaktionen`: pages call `seitenaktionenMelden()`, the
  content's own "Zurück" is hidden there. A page reporting `eigeneLeiste` (new contract: Abbrechen | Sichern)
  gets neither header nor tab bar.
- API types come from the backend's OpenAPI description: `core/api/api.generated.ts` (checked in, never edit by
  hand), named aliases in `core/api/api.ts`. After an API change in the backend, run `npm run api:typen` and commit
  the result. HTTP stays `HttpClient` with interceptors, no generated client.
- Auth (see backend CLAUDE.md): the SPA posts email/password to `POST /api/anmeldung` and only ever holds the
  session cookie; `AuthService` asks `GET /api/nutzer/ich` once (401 = logged out, other errors = logged out
  but not cached). `authInterceptor` redirects 401 under `/api/**` to `/login?returnUrl=…` unless the request
  sets the `OHNE_ANMELDE_UMLEITUNG` context token or the user is already on `/login` (keeps the `returnUrl`).
  Never redirect to Keycloak.
- Booked components: `AuthService` loads them with the user (`GET /api/nutzer/ich/komponenten`). The navigation
  shows booked areas only, not yet available ones (`verfuegbar` in `core/komponenten`) without a link;
  `bereichGuard` sends everything else to `/start`. A failed load keeps the user logged in, the shell then shows a
  hint with "Erneut versuchen". 403 `KEIN_ZUGRIFF` reloads them in `authInterceptor` and goes to `/start`.
  `/einstellungen/komponenten` loads them itself with their `version` and changes them via `PUT` (409
  `KONFLIKT`: reload, hint); after saving it calls `komponentenLaden()` so navigation and start page follow.
- System status: `systemstatusBeobachten()` (injection context) polls `/actuator/health/systemstatus` every
  30 s. No answer within 5 s (e.g. while the DB check waits for the pool) → all three services count as
  unreachable (reveals nothing about the setup); a 503 still carries the component status. The last known
  status survives page changes. Login and registration lock while anything is down; in the shell only the
  settings page (`/einstellungen`, via the user menu) shows it, imprint and privacy policy in their footer. The
  shell footer still polls (without showing it) because version loading depends on it.
- Version and stage: the footer (login, registration, shell) shows the frontend version from `package.json`
  (never missing) and the backend's stage from `/actuator/info` (public, see backend `docs/api.md`); outside
  `PROD` a stripe sits above every page, its height in `--app-streifen-hoehe`. `core/version` loads the info
  once the system status reaches the backend and retries until it gets an answer; without one only the
  badge and stripe are missing. Commit and build time (frontend via `--define` in the image build, backend
  from the info) are for the imprint only.
- Imprint and privacy policy (`/impressum`, `/datenschutz`, `features/rechtliches`): reachable with and without
  a session, no guard; they check the session themselves (user menu, target of "Zurück"). The links
  (`shared/rechtliche-links`) pass the current page as `herkunft` in the navigation state (`shared/herkunft`),
  kept when switching between the two. The settings link in the user menu does the same. Operator details come
  from `instanz.json`, mounted into the image (`core/instanz`), never from code; missing or incomplete → a hint
  instead of the details. License (fixed) and source links are shown regardless: they point to the two repos
  (`/tree/<commit>` when the commit is known), `quellcode` in `instanz.json` replaces them. Placeholder data
  in `beispiel/instanz.json` is served by the dev server only (development build assets) and used by the E2E
  mock, the image check and `docs/betrieb.md`.
- Unsaved input: a form reports changes to `core/ungespeichert`. Leaving asks via the dialog in the shell:
  `ungespeichertGuard` (`canDeactivate`) on routes with a form, `bestaetigen()` for anything else that leaves or
  closes one (logout must ask before the session ends). Redirects that must happen (401, 403) and a successful save
  call `vergessen()` first. Tab close and reload only get the browser's own dialog.
- Settings subpages (`/einstellungen/profil`, `/einstellungen/komponenten`, routes in `einstellungen.routes.ts`)
  are not part of the settings for `herkunft`: their "Zurück" always leads to `/einstellungen` via
  `zurueckZuEinstellungen()`, going back in history (`shared/zurueck-link`) when the settings opened them (state
  `intern`), so the settings keep their own origin.
- Contracts: details (`/vertraege/:id`, tab in `?tab=`) and editing (`/vertraege/:id/bearbeiten`) are child
  routes of the list page, which loads the data and hands it down; desktop: panel next to the list and a modal
  sheet (native `dialog`), up to 900 px full screen. Closing goes back in history when the page opened the entry
  itself (state `intern`), otherwise it replaces it, so the back button closes and shared links work. Navigations
  inside the page pass `scroll: 'manual'`. Esc, a click outside and the back button all close via the route, so
  `ungespeichertGuard` asks.
- Password rules in `features/anmeldung/registrierung/passwort-regeln.ts` mirror the Keycloak realm policy
  (Unicode letter/digit classes like Keycloak). Keep them in sync when the policy changes.
- Styling: design colours as CSS custom properties `--app-*` in `src/styles.scss`; no UI library (ADR 0016), custom
  markup per design, icons as inline SVG, font Manrope from `@fontsource-variable/manrope` (no requests to third
  parties). Form fields and buttons as mixins in `shared/formular/_formular.scss`. Font sizes, radii and spacing
  (gap, padding, margin) only via the SCSS variables in `src/styles/_masse.scss` (`@use 'masse' as *;`, include path
  `src/styles`), named like the design system (`$abstand-4`, `$radius-feld`, `$schrift-text`); exceptions (1px, line
  heights, layout sizes) stay fixed values with a comment.
- The design in the Claude Design canvas "Haushaltsbuch" (https://claude.ai/artifact/1MUUwCGUPdDSQ15Ab5QzWb; pages
  Anmeldung, Allgemein, Verträge with desktop and 390 px artboards, Grundlagen with the shared building blocks) is
  authoritative (ADR 0020): pages and behaviour are designed there first, the code follows. App and canvas are
  always kept the same: if the code has to differ (texts, conditions, layout), update the artboard in the same
  change; a note on the issue alone is not enough. Logo, app icons and UI symbols live in the design
  system's assets (symbols: 24 grid, stroke 2, below 16 px 2.5). Colour tokens `--app-*` are exactly the colours
  of the design system "Haushaltsbuch" (https://claude.ai/artifact/1mDWVeKNzU1Mp3Co6TFD7H) with the same names; a
  new colour or building block goes there first. `--app-trenner` frames an area, `--app-trenner-innen` separates
  inside it.
- Canvas and design system use colours only as `var(--app-…, <token value>)` (the canvas provides the design
  system's tokens as CSS variables; the colour picker writes them so; SVG colours via `style`, not attributes) and
  sizes only from the scales. After every change to the canvas or the design system, download the changed state
  (Artifact `read` with `paths`/`out_dir`, keeping `project/`) and run `npm run design:pruefen -- <dir>`; it also
  checks that `styles.scss` and `_masse.scss` match the tokens. The CI cannot load the canvas.

## Conventions

Details in `docs/entwicklung.md`, section "Konventionen". ADRs are in the backend under `docs/entscheidungen`.

- No business calculations in the SPA (ADR 0010): only format; status, costs, dates and sorting come from the
  backend. Form checks are for usability only; the backend's field errors decide.
- Error texts by `code` (ADR 0007), never show `detail`: `core/fehler` only reads `code` and `felder` from the
  problem response, the texts live in the page that shows the error.
- Money: always `Betrag` with its currency, never assume EUR, show lists per currency in full. Only exception:
  an empty list shows `0,00 €`.
- Format money and dates via `shared/format` (browser `Intl`), not Angular's `CurrencyPipe`, `DatePipe` or
  `formatCurrency`: Those keep about 19 kB in the initial bundle and need `registerLocaleData`, which is not set up.
- Business dates are ISO without time and the backend decides what "today" is. Only exception: display without
  business meaning, e.g. the month in the greeting, may come from the browser.
- A feature is one folder per backend module with service and pages, inside grouped by UI area (`liste/`,
  `details/`, `formular/`), no file over 400 lines; checklist in `docs/entwicklung.md` "Fachbereich anlegen".
  Services hold no business data (ADR 0018): pages load it when opened and reload after changes, so nothing is
  left for the next user after logout. Exempt: session data in `AuthService` and the system status.
- Every page with data has loading, error (with "Erneut versuchen") and empty states.

## Tests

- Unit tests mock `AuthService`/`SystemstatusService` via `useValue`; HTTP via `provideHttpClientTesting`.
- E2E: extend `backendSimulieren()` for new endpoints instead of needing a running backend.
- E2E on phones (`mobile-chrome`, `mobile-safari`) runs only tests tagged `@mobil`; tag every test that checks a
  width up to 900 px. Mobile WebKit has no `mouse.wheel`; scroll via `window.scrollBy`.
- CSP and nginx rules (ADR 0019) only apply in the image; `e2e-image/` covers them. Check there when changing
  `docker/nginx` or anything the CSP could block.
- In Playwright, `getByLabel('Passwort')` also matches the rules list ("Anforderungen an das Passwort"); use
  `{ exact: true }`.
