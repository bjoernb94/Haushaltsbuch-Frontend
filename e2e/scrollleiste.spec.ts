import { expect, test } from '@playwright/test';
import { backendSimulieren, BEISPIEL_VERTRAEGE, nutzerKnopf } from './backend-mock';

// Headless blendet Chromium die Scrollleisten aus; hier sollen sie Platz brauchen wie im Browser.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test('Kopfzeile springt nicht zwischen kurzen und langen Seiten', async ({ page }, info) => {
  test.skip(
    info.project.name !== 'chromium',
    'Scrollleisten lassen sich nur in Chromium einblenden',
  );
  // So hoch, dass Startseite und Impressum nicht scrollen, Vertragsliste und Datenschutzerklärung
  // aber schon.
  await page.setViewportSize({ width: 1280, height: 1300 });
  await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });

  const positionen = async (pfade: string[], mitLogo: boolean) => {
    const ergebnis = [];
    for (const pfad of pfade) {
      await page.goto(pfad);
      await page.getByRole('heading', { level: 1 }).waitFor();
      await expect(nutzerKnopf(page)).toBeVisible();
      ergebnis.push({
        logo: mitLogo
          ? (await page
              .getByRole('banner')
              .getByText('Haushaltsbuch', { exact: true })
              .boundingBox())!.x
          : null,
        knopf: (await nutzerKnopf(page).boundingBox())!.x,
      });
    }
    return ergebnis;
  };

  const shell = await positionen(['/start', '/vertraege'], false);
  expect(shell[1]).toEqual(shell[0]);
  const rechtlich = await positionen(['/impressum', '/datenschutz'], true);
  expect(rechtlich[1]).toEqual(rechtlich[0]);
});
