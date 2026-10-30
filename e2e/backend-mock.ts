import { Page } from '@playwright/test';

export const MAX = { vorname: 'Max', name: 'Muster', email: 'max@beispiel.de' };

/**
 * Simuliert die Anmelde-Endpunkte des Backends im Browser, damit die Tests ohne Backend und
 * Keycloak laufen. Gültig ist nur max@beispiel.de / geheim123.
 */
export async function backendSimulieren(page: Page, { angemeldet = false } = {}) {
  let session = angemeldet;
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
  await page.route('/api/abmeldung', (route) => {
    session = false;
    return route.fulfill({ status: 204 });
  });
}
