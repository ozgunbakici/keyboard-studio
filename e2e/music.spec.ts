import {expect, test} from '@playwright/test';
import {wav} from './wav';

test('music plays while typing fast, ducks or pauses when slowing down and comes back', async ({page}) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.getByRole('button', {name: 'Yazı antrenmanı'}).click();
  await page.getByRole('tab', {name: /Pratik/}).click();
  await page.getByLabel('Uzunluk').selectOption({label: 'Uzun (4+ satır)'});

  const button = page.getByRole('button', {name: 'Müzik'});
  await button.click();
  await page.getByRole('switch', {name: 'Hızlı yazınca müzik çal'}).click();
  await page.getByLabel('Müzik dosyası ekle').setInputFiles([
    {name: 'bir.wav', mimeType: 'audio/wav', buffer: wav(15, 330)},
    {name: 'iki.wav', mimeType: 'audio/wav', buffer: wav(15, 550)},
  ]);
  await expect(page.getByText('2 parça')).toBeVisible();
  await page.getByRole('slider', {name: 'Hız eşiği'}).fill('20');
  await page.keyboard.press('Escape');
  await expect(button).toHaveAttribute('data-status', 'waiting');

  const text = ((await page.getByLabel('Yazılacak metin').textContent()) ?? '').replace(/↵\n/g, '\n');
  await page.getByLabel('Yazılacak metin').click({force: true}).catch(() => {});
  const typing = page.keyboard.type(text.slice(0, 400), {delay: 150});
  await expect(button).toHaveAttribute('data-status', 'playing', {timeout: 25_000});
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.metadata?.title)).toBe('bir');
  await typing;

  await expect(button).toHaveAttribute('data-status', 'ducked', {timeout: 15_000});

  // Typing again brings it back.
  const again = page.keyboard.type(text.slice(400, 700), {delay: 150});
  await expect(button).toHaveAttribute('data-status', 'playing', {timeout: 25_000});
  await again;
  await expect(button).toHaveAttribute('data-status', 'ducked', {timeout: 15_000});

  // "Dursun" pauses instead.
  await button.click();
  await page.getByRole('radio', {name: 'Dursun'}).click();
  await page.keyboard.press('Escape');
  await expect(button).toHaveAttribute('data-status', 'paused', {timeout: 15_000});
});
