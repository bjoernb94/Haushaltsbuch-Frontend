import { expect, test } from '@playwright/test';
import { backendSimulieren, nutzerKnopf } from './backend-mock';

// Headless blendet Chromium die Scrollleisten aus; hier sollen sie Platz brauchen wie im Browser.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test('Kopfzeile springt nicht zwischen kurzen und langen Seiten', async ({ page }, info) => {
  test.skip(
    info.project.name !== 'chromium',
    'Scrollleisten lassen sich nur in Chromium einblenden',
  );
  // So hoch, dass Startseite und Impressum nicht scrollen, die Datenschutzerklärung aber schon.
  await page.setViewportSize({ width: 1280, height: 1300 });
  await backendSimulieren(page, { angemeldet: true });

  const positionen = [];
  for (const pfad of ['/start', '/impressum', '/datenschutz']) {
    await page.goto(pfad);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await expect(nutzerKnopf(page)).toBeVisible();
    positionen.push({
      logo: (await page
        .getByRole('banner')
        .getByText('Haushaltsbuch', { exact: true })
        .boundingBox())!.x,
      knopf: (await nutzerKnopf(page).boundingBox())!.x,
    });
  }
  expect(positionen[1]).toEqual(positionen[0]);
  expect(positionen[2]).toEqual(positionen[0]);
});
