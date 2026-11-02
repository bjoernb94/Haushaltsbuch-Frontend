import { expect, Page, test } from '@playwright/test';
import { backendSimulieren } from './backend-mock';

const KOMPONENTEN_URL = '/api/nutzer/ich/komponenten';

function navigation(page: Page) {
  return page.getByRole('navigation');
}

test('Navigation zeigt nur gebuchte Bereiche, noch nicht verfügbare ohne Link', async ({
  page,
}) => {
  await backendSimulieren(page, {
    angemeldet: true,
    komponenten: ['VERTRAGSUEBERSICHT', 'PORTFOLIO'],
  });
  await page.goto('/start');

  await expect(navigation(page).getByRole('link', { name: 'Verträge' })).toBeVisible();
  await expect(navigation(page).getByRole('link', { name: 'Portfolio' })).toHaveCount(0);
  await expect(navigation(page)).toContainText('PortfolioDemnächst verfügbar');
  await expect(navigation(page)).not.toContainText('Buchungen');
  await expect(navigation(page)).not.toContainText('Versorgung');
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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Willkommen, Max');
  await expect(navigation(page).getByRole('link', { name: 'Verträge' })).toHaveCount(0);

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

  await expect(page).toHaveURL(/\/vertraege$/);
  expect(versuche).toBe(2);
});

test('nach dem Abmelden sieht der nächste Nutzer nur seine Bereiche', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true, komponenten: ['VERTRAGSUEBERSICHT'] });
  await page.goto('/start');
  await expect(navigation(page).getByRole('link', { name: 'Verträge' })).toBeVisible();

  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.route(KOMPONENTEN_URL, (route) => route.fulfill({ json: ['PORTFOLIO'] }));
  await page.getByLabel('E-Mail-Adresse').fill('max@beispiel.de');
  await page.getByLabel('Passwort').fill('geheim123');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/start$/);
  await expect(navigation(page).getByRole('link', { name: 'Verträge' })).toHaveCount(0);
  await expect(navigation(page)).toContainText('Demnächst verfügbar');
});
