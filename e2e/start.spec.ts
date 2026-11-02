import { expect, test } from '@playwright/test';
import { backendSimulieren } from './backend-mock';

test('zeigt verfügbare Kacheln mit Link und die übrigen ausgegraut', async ({ page }) => {
  const aufrufe: string[] = [];
  page.on('request', (anfrage) => {
    if (anfrage.url().includes('/api/buchungen') || anfrage.url().includes('/api/portfolio')) {
      aufrufe.push(anfrage.url());
    }
  });
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/start');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Willkommen, Max!');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Finanzübersicht',
    'Vertragsübersicht',
    'Versorgungsverträge',
    'Portfolio',
  ]);
  await expect(page.getByText('Demnächst verfügbar')).toHaveCount(3);
  await expect(page.getByRole('link')).toHaveCount(1);
  expect(aufrufe).toEqual([]);

  await page.getByRole('link', { name: 'Alle Verträge' }).click();
  await expect(page).toHaveURL(/\/vertraege$/);
});

test('zeigt nur Kacheln gebuchter Komponenten', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true, komponenten: ['PORTFOLIO'] });
  await page.goto('/start');

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Portfolio']);
  await expect(page.getByRole('link', { name: 'Alle Verträge' })).toHaveCount(0);
});

test('ohne geladene Komponenten bleibt nur der Hinweis', async ({ page }) => {
  await backendSimulieren(page, { angemeldet: true });
  await page.route('/api/nutzer/ich/komponenten', (route) => route.fulfill({ status: 500 }));
  await page.goto('/start');

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);
});

test('passt auf dem Handy in die Breite', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await backendSimulieren(page, { angemeldet: true });
  await page.goto('/start');

  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(page.getByRole('navigation')).toHaveCount(0);
});
