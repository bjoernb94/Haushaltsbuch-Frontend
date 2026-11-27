import { expect, Page, test } from '@playwright/test';
import { abmelden, backendSimulieren, nutzerKnopf } from './backend-mock';

const KOMPONENTEN_URL = '/api/nutzer/ich/komponenten';

function navigation(page: Page) {
  return page.getByRole('navigation', { name: 'Hauptmenü' });
}

test('Navigation verlinkt gebuchte Bereiche, die übrigen stehen ohne Link da', async ({ page }) => {
  await backendSimulieren(page, {
    angemeldet: true,
    komponenten: ['VERTRAGSUEBERSICHT', 'PORTFOLIO'],
  });
  await page.goto('/vertraege');

  await expect(navigation(page).getByRole('link', { name: 'Verträge' })).toBeVisible();
  await expect(navigation(page).getByRole('link', { name: 'Portfolio' })).toHaveCount(0);
  await expect(navigation(page)).toContainText(/Portfolio\s*Demnächst verfügbar/);
  await expect(navigation(page)).toContainText(/Finanzübersicht.*Ausgeschaltet/);
  await expect(navigation(page)).toContainText(/Versorgungsverträge.*Ausgeschaltet/);
  await expect(navigation(page).getByRole('link', { name: /Finanz|Versorgung/ })).toHaveCount(0);
});

for (const { titel, pfad, komponenten } of [
  { titel: 'nicht gebuchter', pfad: '/vertraege', komponenten: ['PORTFOLIO'] },
  { titel: 'noch nicht verfügbarer', pfad: '/portfolio', komponenten: ['PORTFOLIO'] },
]) {
  test(`direkter Aufruf eines ${titel} Bereichs führt zur Startseite`, async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, komponenten });
    await page.goto(pfad);
    await expect(page).toHaveURL(/\/start$/);
  });
}

test('nach einem Ladefehler hilft „Erneut versuchen“', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true, komponenten: ['VERTRAGSUEBERSICHT'] });
  let scheitert = true;
  await page.route(KOMPONENTEN_URL, (route) =>
    scheitert ? route.fulfill({ status: 500 }) : route.fallback(),
  );
  await page.goto('/start');

  await expect(page.getByRole('alert')).toHaveText('Deine Bereiche konnten nicht geladen werden.');
  await expect(page.getByRole('heading', { name: 'Willkommen, Max!' })).toBeVisible();
  await expect(navigation(page).getByRole('link')).toHaveText(['Übersicht', 'Einstellungen']);

  scheitert = false;
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();

  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(navigation(page).getByRole('link', { name: 'Verträge' })).toBeVisible();
});

test('direkter Aufruf versucht es nach einem Ladefehler erneut', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true, komponenten: ['VERTRAGSUEBERSICHT'] });
  let versuche = 0;
  await page.route(KOMPONENTEN_URL, (route) => {
    versuche++;
    return versuche === 1 ? route.fulfill({ status: 500 }) : route.fallback();
  });

  await page.goto('/vertraege');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Verträge');
  expect(versuche).toBe(2);
});

test('nach dem Abmelden sieht der nächste Nutzer nur seine Bereiche', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true, komponenten: ['VERTRAGSUEBERSICHT'] });
  await page.goto('/vertraege');
  await expect(navigation(page).getByRole('link', { name: 'Verträge' })).toBeVisible();

  await abmelden(page);
  await expect(page).toHaveURL(/\/login$/);

  await page.route(KOMPONENTEN_URL, (route) =>
    route.fulfill({ json: { komponenten: ['PORTFOLIO'], version: 1 } }),
  );
  await page.getByLabel('E-Mail-Adresse').fill('max@beispiel.de');
  await page.getByLabel('Passwort').fill('geheim123');
  await page.getByRole('button', { name: 'Login' }).click();

  await nutzerKnopf(page).waitFor();
  await page.goto('/vertraege');
  await expect(page).toHaveURL(/\/start$/);
});
