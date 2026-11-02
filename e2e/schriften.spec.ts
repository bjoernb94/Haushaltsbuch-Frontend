import { expect, test } from '@playwright/test';
import { backendSimulieren } from './backend-mock';

test('Login lädt nichts von fremden Servern und nutzt die eigene Schrift', async ({
  page,
  baseURL,
}) => {
  const fremd: string[] = [];
  page.on('request', (anfrage) => {
    if (!anfrage.url().startsWith(baseURL!) && !anfrage.url().startsWith('data:')) {
      fremd.push(anfrage.url());
    }
  });
  await backendSimulieren(page);

  await page.goto('/login');
  await page.getByRole('status', { name: 'Systemstatus' }).waitFor();

  const geladen = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
  });
  expect(geladen.join()).toContain('Manrope Variable');
  expect(fremd).toEqual([]);
});
