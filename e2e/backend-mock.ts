import { readFileSync } from 'node:fs';
import { expect, Locator, Page, Route } from '@playwright/test';
import { VertragAntwort } from '../src/app/core/api/api';
import { vertraegeSimulieren } from './vertraege-mock';

export { BEISPIEL_VERTRAEGE, KATEGORIEN } from './vertraege-mock';

export const MAX = { vorname: 'Max', name: 'Muster', email: 'max@beispiel.de' };

/** Alle Tabs in einer Zeile, ohne dass die Leiste waagerecht scrollt oder ein Text übersteht. */
export async function tabsEinzeilig(liste: Locator) {
  const { breite, sichtbar, oben, ueberstehend } = await liste.evaluate((e) => {
    const tabs = [...e.querySelectorAll<HTMLElement>('[role="tab"]')];
    return {
      breite: e.scrollWidth,
      sichtbar: e.clientWidth,
      oben: tabs.map((t) => Math.round(t.getBoundingClientRect().top)),
      ueberstehend: tabs.filter((t) => t.scrollWidth > t.clientWidth).map((t) => t.textContent),
    };
  });
  expect(breite).toBeLessThanOrEqual(sichtbar);
  expect(new Set(oben).size).toBe(1);
  expect(ueberstehend).toEqual([]);
}

/** Knopf des Nutzermenüs; zeigt zugleich, dass der Nutzer angemeldet ist. */
export function nutzerKnopf(page: Page) {
  return page.getByRole('button', { name: `Konto von ${MAX.vorname} ${MAX.name}` });
}

/** Öffnet das Nutzermenü und klickt „Abmelden“. */
export async function abmelden(page: Page) {
  await nutzerKnopf(page).click();
  await page
    .getByRole('dialog', { name: 'Dein Konto' })
    .getByRole('button', { name: 'Abmelden' })
    .click();
}

/** Beispielangaben des Betreibers, dieselben wie bei `npm start` und in `docs/betrieb.md`. */
export const INSTANZ = JSON.parse(readFileSync('beispiel/instanz.json', 'utf-8')) as {
  betreiber: { name: string; anschrift: string[]; email: string };
};

/** E-Mail-Adresse, für die die Registrierung mit 409 abgelehnt wird. */
export const VERGEBEN = 'vergeben@beispiel.de';

/** E-Mail-Adresse, für die Keycloak die Registrierung ablehnt. */
export const ABGELEHNT = 'abgelehnt@beispiel.de';

/** E-Mail-Adresse eines gesperrten Kontos. */
export const GESPERRT = 'gesperrt@beispiel.de';

/** Fehlerantwort im Format des Backends (`docs/api.md`): `detail` ist englisch und nur für Entwickler. */
function problem(route: Route, status: number, code: string, detail: string) {
  return route.fulfill({
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', status, detail, code },
  });
}

const ALLE_KOMPONENTEN = [
  'FINANZUEBERSICHT',
  'VERTRAGSUEBERSICHT',
  'VERSORGUNGSVERTRAEGE',
  'PORTFOLIO',
];

/**
 * Simuliert die Anmelde-Endpunkte, den Systemstatus, Version und Umgebung des Backends sowie die
 * `instanz.json` im Browser, damit die Tests ohne Backend und
 * Keycloak laufen. Gültig ist nur max@beispiel.de / geheim123; die Registrierung klappt für
 * jede E-Mail-Adresse außer {@link VERGEBEN} und {@link ABGELEHNT}.
 */
export async function backendSimulieren(
  page: Page,
  {
    angemeldet = false,
    datenbank = true,
    keycloak = true,
    komponenten = ALLE_KOMPONENTEN,
    vertraege = [] as VertragAntwort[],
    stage = 'PROD',
    instanz = INSTANZ as object | null,
  } = {},
) {
  let session = angemeldet;
  const komponente = (up: boolean) => ({ status: up ? 'UP' : 'DOWN' });
  await page.route('/actuator/health/systemstatus', (route) =>
    route.fulfill({
      status: datenbank && keycloak ? 200 : 503,
      json: {
        status: datenbank && keycloak ? 'UP' : 'DOWN',
        components: { db: komponente(datenbank), keycloak: komponente(keycloak) },
      },
    }),
  );
  await page.route('/actuator/info', (route) =>
    route.fulfill({
      json: {
        build: { version: '0.1.0', time: '2026-11-05T17:00:00Z' },
        git: { commit: { id: '48eaea5' } },
        app: { stage },
      },
    }),
  );
  await page.route('/instanz.json', (route) =>
    instanz ? route.fulfill({ json: instanz }) : route.fulfill({ status: 404, body: '' }),
  );
  await page.route('/api/nutzer/ich', (route) =>
    session
      ? route.fulfill({ json: MAX })
      : problem(route, 401, 'NICHT_ANGEMELDET', 'Authentication required.'),
  );
  await page.route('/api/nutzer/ich/komponenten', (route) =>
    session
      ? route.fulfill({ json: komponenten })
      : problem(route, 401, 'NICHT_ANGEMELDET', 'Authentication required.'),
  );
  await page.route('/api/anmeldung', async (route) => {
    const { email, passwort } = route.request().postDataJSON();
    if (email === MAX.email && passwort === 'geheim123') {
      session = true;
      return route.fulfill({ status: 204 });
    }
    if (email === GESPERRT) {
      return problem(route, 403, 'ANMELDUNG_GESPERRT', 'Account is locked.');
    }
    return problem(route, 401, 'ANMELDUNG_UNGUELTIG', 'Invalid email or password.');
  });
  await page.route('/api/registrierung', (route) => {
    const { email } = route.request().postDataJSON();
    if (email === VERGEBEN) {
      return problem(route, 409, 'EMAIL_BEREITS_VERGEBEN', `Account exists for ${email}.`);
    }
    if (email === ABGELEHNT) {
      return problem(route, 400, 'REGISTRIERUNG_ABGELEHNT', 'Invalid password: minimum length 12.');
    }
    session = true;
    return route.fulfill({ status: 201 });
  });
  await page.route('/api/abmeldung', (route) => {
    session = false;
    return route.fulfill({ status: 204 });
  });
  await vertraegeSimulieren(page, vertraege, problem, () => {
    if (!session) {
      return 'abgemeldet';
    }
    return komponenten.includes('VERTRAGSUEBERSICHT') ? 'ok' : 'nicht-gebucht';
  });
}
