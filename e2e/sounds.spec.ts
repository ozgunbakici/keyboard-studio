import {expect, test, type Page} from '@playwright/test';
import {wav} from './wav';

const openTrainer = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Yazı antrenmanı'}).click();
};

const countSounds = async (page: Page) => {
  await page.addInitScript(() => {
    const w = window as unknown as {sounds: number};
    w.sounds = 0;
    for (const proto of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype] as {start: (...a: unknown[]) => void}[]) {
      if (!Object.prototype.hasOwnProperty.call(proto, 'start')) continue;
      const start = proto.start;
      proto.start = function (this: unknown, ...args: unknown[]) {
        w.sounds++;
        return start.apply(this, args);
      };
    }
  });
  return () => page.evaluate(() => (window as unknown as {sounds: number}).sounds);
};

test('a fantasy pack can be chosen and typing plays it', async ({page}) => {
  const sounds = await countSounds(page);
  await openTrainer(page);
  await page.getByRole('button', {name: 'Tuş sesi'}).click();
  await expect(page.getByText('Fantastik')).toBeVisible();
  await page.getByRole('radio', {name: /^Pompalı tüfek/}).click();
  await expect.poll(sounds).toBeGreaterThan(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', {name: 'Tuş sesi'})).toContainText('Pompalı tüfek');
  await page.waitForTimeout(1500);
  const before = await sounds();
  await page.keyboard.type('jf');
  await expect.poll(sounds).toBeGreaterThanOrEqual(before + 2);
});

test('your own sound can be uploaded, is refused when too long, and can be removed', async ({page}) => {
  const sounds = await countSounds(page);
  await openTrainer(page);
  await page.getByRole('button', {name: 'Tuş sesi'}).click();
  const input = page.getByLabel('Tuş sesi dosyası yükle');

  // Too long: refused with a message, nothing selected.
  await input.setInputFiles({name: 'uzun.wav', mimeType: 'audio/wav', buffer: wav(6)});
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('radio', {name: /^Kendi sesim/})).toHaveAttribute('aria-checked', 'false');

  await input.setInputFiles({name: 'tik.wav', mimeType: 'audio/wav', buffer: wav(0.3, 900)});
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('tik.wav')).toBeVisible();
  await expect(page.getByRole('radio', {name: /^Kendi sesim/})).toHaveAttribute('aria-checked', 'true');
  await expect.poll(sounds).toBeGreaterThan(0);

  await page.getByRole('button', {name: 'Kaldır'}).click();
  await expect(page.getByText('tik.wav')).toHaveCount(0);
  await expect(page.getByRole('radio', {name: 'Kapalı'})).toHaveAttribute('aria-checked', 'true');
});
