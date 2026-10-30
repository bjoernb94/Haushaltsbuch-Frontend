import { Page } from '@playwright/test';

export const MAX = { vorname: 'Max', name: 'Muster', email: 'max@beispiel.de' };

/** E-Mail-Adresse, für die die Registrierung mit 409 abgelehnt wird. */
export const VERGEBEN = 'vergeben@beispiel.de';

/**
 * Simuliert die Anmelde-Endpunkte und den Systemstatus des Backends im Browser, damit die Tests ohne Backend und
 * Keycloak laufen. Gültig ist nur max@beispiel.de / geheim123; die Registrierung klappt für
 * jede E-Mail-Adresse außer {@link VERGEBEN}.
 */
export async function backendSimulieren(
  page: Page,
  { angemeldet = false, datenbank = true, keycloak = true } = {},
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
  await page.route('/api/nutzer/ich', (route) =>
    session ? route.fulfill({ json: MAX }) : route.fulfill({ status: 401 }),
  );
  await page.route('/api/anmeldung', async (route) => {
    const { email, passwort } = route.request().postDataJSON();
    if (email === MAX.email && passwort === 'geheim123') {
      session = true;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      json: { status: 401, detail: 'E-Mail-Adresse oder Passwort ist falsch.', grund: 'UNGUELTIG' },
    });
  });
  await page.route('/api/registrierung', (route) => {
    const { email } = route.request().postDataJSON();
    if (email === VERGEBEN) {
      return route.fulfill({
        status: 409,
        contentType: 'application/problem+json',
        json: {
          status: 409,
          detail: `Für die E-Mail-Adresse ${email} existiert bereits ein Konto.`,
        },
      });
    }
    session = true;
    return route.fulfill({ status: 201 });
  });
  await page.route('/api/abmeldung', (route) => {
    session = false;
    return route.fulfill({ status: 204 });
  });
}
