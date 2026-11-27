import { expect, Page, test } from '@playwright/test';
import { backendSimulieren, BEISPIEL_VERTRAEGE } from './backend-mock';

// „Wieder aufnehmen“ aus Details und Kontextmenü, die Anzeige der Unterbrechung und ihr Entfernen
// beim Bearbeiten. Der Mock legt die Unterbrechung an wie das Backend (vertraege-mock.ts).

const MOBILFUNK = 'Mobilfunk GmbH';
const ABO = 'Zeitschriften-Abo';

const zeile = (page: Page, name: string) =>
  page.locator('app-vertrag-zeile').filter({ hasText: name });
const details = (page: Page, name: string) => page.getByRole('complementary', { name });
const dialog = (page: Page, name: string) =>
  page.getByRole('dialog', { name: `„${name}“ wieder aufnehmen` });

test.describe('Vertrag wieder aufnehmen', () => {
  test.beforeEach(async ({ page }) => {
    await backendSimulieren(page, { angemeldet: true, vertraege: BEISPIEL_VERTRAEGE });
    await page.goto('/vertraege');
  });

  test('aus den Details: mit Lücke, danach Unterbrechung in Liste und Details', async ({
    page,
  }) => {
    await zeile(page, MOBILFUNK)
      .getByRole('button', { name: /Details zu/ })
      .click();
    const panel = details(page, MOBILFUNK);
    await expect(panel.locator('app-wiederaufnahme-leiste')).toContainText(
      'Beendet am 30.06.2026.',
    );
    await panel.getByRole('button', { name: 'Wieder aufnehmen' }).click();

    const box = dialog(page, MOBILFUNK);
    await expect(box).toBeVisible();
    await expect(page).toHaveURL(/\/vertraege\/alt\/wiederaufnehmen$/);
    await expect(box.getByLabel('Wieder aufgenommen am *')).toHaveValue('2026-09-01');
    await expect(box.getByText('Frühestens am 01.07.2026.')).toBeVisible();
    await expect(box.getByLabel('Wieder aufgenommen am *')).toBeFocused();

    const anfrage = page.waitForRequest((r) => r.url().endsWith('/wiederaufnahme'));
    await box.getByLabel('Verlängerung *').selectOption('ZAHLUNGSINTERVALL');
    await box.getByRole('button', { name: 'Wieder aufnehmen' }).click();
    expect((await anfrage).postDataJSON()).toEqual({
      version: 0,
      datum: '2026-09-01',
      laufzeitende: null,
      verlaengerung: 'ZAHLUNGSINTERVALL',
      kuendigungsfristMonate: null,
      betrag: null,
    });

    await expect(box).toBeHidden();
    await expect(page).toHaveURL(/\/vertraege\/alt$/);
    await expect(panel.locator('.meldung')).toContainText(
      '„Mobilfunk GmbH“ wird ab 01.09.2026 wieder aufgenommen.',
    );
    await expect(panel.locator('app-wiederaufnahme-leiste')).toHaveCount(0);
    await expect(panel.locator('.kachel').filter({ hasText: 'Laufzeit' })).toContainText(
      'wieder seit 01.09.2026',
    );
    await expect(zeile(page, MOBILFUNK)).toContainText('Wieder seit 01.09.2026');

    await panel.getByRole('tab', { name: 'Laufzeit' }).click();
    const unterbrechungen = panel.locator('app-vertrag-unterbrechungen');
    await expect(unterbrechungen).toContainText('01.07.2026 – 31.08.2026');
    await expect(unterbrechungen.getByRole('button', { name: /entfernen/ })).toHaveCount(0);
  });

  test('aus dem Kontextmenü mit neuem Betrag; nur wo es geht', async ({ page }) => {
    await page.getByRole('button', { name: 'Aktionen für Kfz-Versicherung' }).click();
    await expect(page.getByRole('menuitem', { name: 'Details anzeigen' })).toBeFocused();
    await expect(page.getByRole('menuitem', { name: 'Wieder aufnehmen …' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.getByRole('button', { name: `Aktionen für ${ABO}` }).click();
    await page.getByRole('menuitem', { name: 'Wieder aufnehmen …' }).click();
    const box = dialog(page, ABO);
    await expect(box.getByText('Gekündigt zum 31.12.2026.', { exact: false })).toBeVisible();
    await expect(box.getByLabel('Neuer Betrag in € (optional)')).toHaveAttribute(
      'placeholder',
      '9,90',
    );
    const anfrage = page.waitForRequest((r) => r.url().endsWith('/wiederaufnahme'));
    await box.getByLabel('Wieder aufgenommen am *').fill('2027-03-01');
    await box.getByLabel('Neuer Betrag in € (optional)').fill('11,90');
    await box.getByRole('button', { name: 'Wieder aufnehmen' }).click();
    expect((await anfrage).postDataJSON()).toMatchObject({
      datum: '2027-03-01',
      verlaengerung: 'ZAHLUNGSINTERVALL',
      kuendigungsfristMonate: 1,
      betrag: { wert: 11.9, waehrung: 'EUR' },
    });

    // In der Zukunft: bis dahin unterbrochen.
    await expect(box).toBeHidden();
    await expect(zeile(page, ABO)).toContainText('Gekündigt, wieder ab 01.03.2027');
    await expect(zeile(page, ABO).locator('.kuendigung app-chip')).toHaveText(
      'Wieder ab 01.03.2027',
    );
  });

  test('Fehler des Backends am Feld, Esc fragt bei Eingaben nach', async ({ page }) => {
    await page.goto('/vertraege/alt/wiederaufnehmen');
    const box = dialog(page, MOBILFUNK);
    await box.getByLabel('Wieder aufgenommen am *').fill('2026-06-30');
    await box.getByLabel('Verlängerung *').selectOption('MONATLICH');
    await box.getByRole('button', { name: 'Wieder aufnehmen' }).click();
    await expect(
      box.getByText('Das Datum muss nach dem Vertragsende (30.06.2026) liegen.'),
    ).toBeVisible();
    await expect(box.getByLabel('Wieder aufgenommen am *')).toBeFocused();

    await page.keyboard.press('Escape');
    const verwerfen = page.getByRole('button', { name: 'Verwerfen' });
    await expect(verwerfen).toBeVisible();
    await verwerfen.click();
    await expect(box).toBeHidden();
    await expect(page).toHaveURL(/\/vertraege\/alt$/);
  });

  test('Unterbrechung beim Bearbeiten entfernen, rückgängig machen und sichern', async ({
    page,
  }) => {
    await page.goto('/vertraege/alt/wiederaufnehmen');
    const box = dialog(page, MOBILFUNK);
    await box.getByLabel('Verlängerung *').selectOption('ZAHLUNGSINTERVALL');
    await box.getByRole('button', { name: 'Wieder aufnehmen' }).click();
    await expect(box).toBeHidden();

    await details(page, MOBILFUNK).getByRole('button', { name: 'Bearbeiten' }).click();
    const sheet = page.getByRole('dialog', { name: 'Vertrag bearbeiten' });
    await sheet.getByRole('tab', { name: /^Laufzeit/ }).click();
    const entfernen = sheet.getByRole('button', {
      name: 'Unterbrechung 01.07.2026 – 31.08.2026 entfernen',
    });
    await entfernen.click();
    await expect(
      sheet.getByText('Unterbrechung 01.07.2026 – 31.08.2026 wird beim Sichern entfernt.'),
    ).toBeVisible();
    await sheet.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(entfernen).toBeFocused();
    await entfernen.click();

    const anfrage = page.waitForRequest((r) => r.method() === 'PUT');
    await sheet.getByRole('button', { name: 'Sichern' }).click();
    expect((await anfrage).postDataJSON()).toMatchObject({ unterbrechungIds: [] });
    await expect(sheet).toBeHidden();
    await expect(zeile(page, MOBILFUNK)).toContainText('Seit 15.01.2024');
  });

  test(
    'bis 900 px im Vollbild mit Leiste „Abbrechen | Wieder aufnehmen | Sichern“',
    { tag: '@mobil' },
    async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/vertraege/alt/wiederaufnehmen');
      const box = dialog(page, MOBILFUNK);
      await expect(box).toBeVisible();
      expect(await box.boundingBox()).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
      await expect(box.getByRole('heading', { level: 2 })).toBeHidden();
      await expect(box.locator('.name')).toHaveText(MOBILFUNK);
      await expect(box.locator('.aktionen')).toBeHidden();
      await box.getByLabel('Verlängerung *').selectOption('ZAHLUNGSINTERVALL');
      await box.locator('.leiste').getByRole('button', { name: 'Sichern' }).click();
      await expect(box).toBeHidden();
      await expect(
        page.getByText('„Mobilfunk GmbH“ wird ab 01.09.2026 wieder aufgenommen.'),
      ).toBeVisible();
    },
  );

  test('am Desktop ein Dialog in der Fenstermitte, höchstens 480 px breit', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/vertraege/alt/wiederaufnehmen');
    const box = dialog(page, MOBILFUNK);
    const rahmen = (await box.boundingBox())!;
    expect(rahmen.width).toBe(480);
    expect(Math.round(rahmen.x + rahmen.width / 2)).toBe(640);
    await expect(box.locator('.leiste')).toBeHidden();
    await expect(box.getByRole('heading', { level: 2 })).toHaveText(
      '„Mobilfunk GmbH“ wieder aufnehmen',
    );
  });
});
