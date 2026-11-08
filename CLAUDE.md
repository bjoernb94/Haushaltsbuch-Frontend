# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Angular SPA of a household-budget app ("Haushaltsbuch"). Backend: `../Haushaltsbuch-Backend` (Spring Boot,
Keycloak, has its own CLAUDE.md). UI text, identifiers, comments and the README are in German; keep it that way.

## Commands

```bash
npm start              # dev server on :4200, proxies /api and /actuator to :8080
npm run build          # production build (budgets: initial 500 kB warning)
npm run lint           # ESLint incl. angular-eslint template + accessibility rules
npm run format:check   # Prettier; npm run format to fix (ng add/generate may reformat angular.json)
npm run test:ci        # Vitest unit tests once (npm test = watch)
npm run e2e            # Playwright (Chromium, Firefox), backend simulated in the browser (e2e/backend-mock.ts)
npm run image:pruefen  # start the built image (npm run image) and check CSP, headers and nginx routes
npm run api:typen      # regenerate core/api/api.generated.ts from ../Haushaltsbuch-Backend/docs/openapi.json
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

## Architecture

- Standalone components, signals, `OnPush`, zoneless; `strict` and `strictTemplates` are on.
- `core/` services without UI, `features/` lazy-loaded pages (one folder per backend module, plus
  `anmeldung/` for login/registration and `start/`), `shared/` components used by several areas,
  `shell/` layout of the logged-in area (lazy, so login and registration do not load it). `/start` has no
  navigation (route data `ohneNavigation`), its tiles navigate; all other areas use `shell/hauptmenue`.
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
- System status: `systemstatusBeobachten()` (injection context) polls `/actuator/health/systemstatus` every
  30 s. No answer within 5 s (e.g. while the DB check waits for the pool) → all three services count as
  unreachable (reveals nothing about the setup); a 503 still carries the component status. The last known
  status survives page changes. Login and registration lock while anything is down; the shell only displays it.
- Version and stage: the footer (login, registration, shell) shows the frontend version from `package.json`
  (never missing) and the backend's stage from `/actuator/info` (public, see backend `docs/api.md`); outside
  `PROD` a stripe sits above every page, its height in `--app-streifen-hoehe`. `core/version` loads the info
  once the system status reaches the backend and retries until it gets an answer; without one only the
  badge and stripe are missing. Commit and build time (frontend via `--define` in the image build, backend
  from the info) are for the imprint only.
- Unsaved input: a form reports changes to `core/ungespeichert`. Leaving asks via the dialog in the shell:
  `ungespeichertGuard` (`canDeactivate`) on routes with a form, `bestaetigen()` for anything else that leaves or
  closes one (logout must ask before the session ends). Redirects that must happen (401, 403) and a successful save
  call `vergessen()` first. Tab close and reload only get the browser's own dialog.
- Password rules in `features/anmeldung/registrierung/passwort-regeln.ts` mirror the Keycloak realm policy
  (Unicode letter/digit classes like Keycloak). Keep them in sync when the policy changes.
- Styling: design colours as CSS custom properties `--app-*` in `src/styles.scss`; no UI library, custom markup per
  design, icons as inline SVG, font Manrope from `@fontsource-variable/manrope` (no requests to third parties).
  Form fields and buttons as mixins in `shared/formular/_formular.scss`.
- The design lives in the Claude Design canvas "Haushaltsbuch" (artboards Login, Registrierung, Startseite,
  Verträge, Neuer Vertrag). Changes to page behaviour should be reflected in the artboards as well.

## Conventions

Details in the README, section "Konventionen". ADRs are in the backend under `docs/entscheidungen`.

- No business calculations in the SPA (ADR 0010): only format; status, costs, dates and sorting come from the
  backend. Form checks are for usability only; the backend's field errors decide.
- Error texts by `code` via `core/fehler` (ADR 0007), never show `detail`.
- Money: always `Betrag` with its currency, never assume EUR, show lists per currency in full. Only exception:
  an empty list shows `0,00 €`.
- Format money and dates via `shared/format` (browser `Intl`), not Angular's `CurrencyPipe`, `DatePipe` or
  `formatCurrency`: Those keep about 19 kB in the initial bundle and need `registerLocaleData`, which is not set up.
- Business dates are ISO without time and the backend decides what "today" is. Only exception: display without
  business meaning, e.g. the month in the greeting, may come from the browser.
- A feature is one folder per backend module with service and pages. Services hold no business data: pages
  load it when opened and reload after changes, so nothing is left for the next user after logout. Exempt:
  session data in `AuthService` and the system status.
- Every page with data has loading, error (with "Erneut versuchen") and empty states.

## Tests

- Unit tests mock `AuthService`/`SystemstatusService` via `useValue`; HTTP via `provideHttpClientTesting`.
- E2E: extend `backendSimulieren()` for new endpoints instead of needing a running backend.
- CSP and nginx rules only apply in the image; `e2e-image/` covers them. Check there when changing
  `docker/nginx` or anything the CSP could block.
- In Playwright, `getByLabel('Passwort')` also matches the rules list ("Anforderungen an das Passwort"); use
  `{ exact: true }`.
