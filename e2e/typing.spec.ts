import {expect, test, type Page} from '@playwright/test';

const openTrainer = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Yazı antrenmanı'}).click();
};

/** The text still to be typed, as the user sees it (↵ marks line breaks). */
const targetText = async (page: Page) => ((await page.getByLabel('Yazılacak metin').textContent()) ?? '').replace(/↵\n/g, '\n');

/** Code is typed without leading spaces: the trainer fills in indentation after Enter. */
const withoutIndent = (code: string) =>
  code
    .split('\n')
    .map((line, i) => (i === 0 ? line : line.trimStart()))
    .join('\n');

test('a touch-typing lesson waits on mistakes and awards stars', async ({page}) => {
  await openTrainer(page);
  await expect(page.getByRole('heading', {name: 'F ve J'})).toBeVisible();
  const text = await targetText(page);
  expect(text).toMatch(/^[fj ]+$/);
  // A wrong key does not move the cursor in lessons; the right one continues.
  await page.keyboard.type('x');
  await expect(page.getByText('%0')).toBeVisible();
  await page.keyboard.type(text, {delay: 5});
  await expect(page.getByTestId('result-wpm')).toBeVisible();
  await expect(page.getByLabel(/\d yıldız/).first()).toBeVisible();
  await page.getByRole('button', {name: 'Sonraki ders'}).click();
  await expect(page.getByRole('heading', {name: 'D ve K'})).toBeVisible();
});

test('Python lessons fill in indentation after Enter', async ({page}) => {
  await openTrainer(page);
  await page.getByRole('tab', {name: /Pratik/}).click();
  await page.getByRole('radio', {name: 'Python dersleri'}).click();
  // Lesson 5 (conditions) has indented blocks.
  for (let i = 0; i < 4; i++) await page.getByRole('button', {name: /Sonraki/}).click();
  await expect(page.getByRole('heading', {name: 'Koşullar'})).toBeVisible();
  const code = await targetText(page);
  expect(code).toContain('\n    grade = "A"');
  await page.keyboard.type(withoutIndent(code), {delay: 3});
  await expect(page.getByTestId('result-wpm')).toBeVisible();
  await expect(page.getByText('hiç hata yok')).toBeVisible();
});

test('the finger guide is an ANSI board unless ISO is chosen', async ({page}) => {
  await openTrainer(page);
  const guide = page.getByLabel('Parmak rehberi');
  await expect(guide.locator('[data-key-id="std-KC_BSLS"]')).toHaveCount(1);
  await expect(guide.locator('[data-key-id="std-KC_NUBS"]')).toHaveCount(0);
  await page.getByRole('radio', {name: 'ISO', exact: true}).click();
  await expect(guide.locator('[data-key-id="std-KC_NUBS"]')).toHaveCount(1);
  await expect(guide.locator('[data-key-id="std-KC_BSLS"]')).toHaveCount(0);
  // Kept in the settings.
  await page.reload();
  await page.getByRole('button', {name: 'Ayarlar', exact: true}).click();
  await expect(page.getByLabel('Klavye dizilimi')).toHaveValue('iso');
});

test('key presses sound like the chosen switch, and stay silent by default', async ({page}) => {
  // Counts every sound layer the page starts.
  await page.addInitScript(() => {
    const w = window as unknown as {sounds: number};
    w.sounds = 0;
    // Noise layers start through AudioBufferSourceNode's own start, tones through the shared one.
    for (const proto of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype] as {start: (...a: unknown[]) => void}[]) {
      if (!Object.prototype.hasOwnProperty.call(proto, 'start')) continue;
      const start = proto.start;
      proto.start = function (this: unknown, ...args: unknown[]) {
        w.sounds++;
        return start.apply(this, args);
      };
    }
  });
  const sounds = () => page.evaluate(() => (window as unknown as {sounds: number}).sounds);
  await openTrainer(page);
  await page.keyboard.type('jf');
  expect(await sounds()).toBe(0);

  await page.getByRole('button', {name: 'Tuş sesi'}).click();
  await page.getByRole('radio', {name: /^Tıklı/}).click();
  // Choosing a switch plays a few keystrokes of it.
  await expect.poll(sounds).toBeGreaterThan(10);
  await expect(page.getByRole('slider', {name: 'Ses düzeyi'})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  const afterPreview = await sounds();

  // Typing goes straight back to the text, each key with a click.
  await page.keyboard.type('jf');
  await expect.poll(sounds).toBeGreaterThanOrEqual(afterPreview + 2 * 6);
  await expect(page.getByRole('button', {name: 'Tuş sesi'})).toContainText('Tıklı');
});

test('Turkish practice drops ç ğ ı ö ş ü unless asked for', async ({page}) => {
  await openTrainer(page);
  await page.getByRole('tab', {name: /Pratik/}).click();
  await page.getByRole('radio', {name: 'Türkçe cümleler'}).click();
  expect(await targetText(page)).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/);
  await page.getByLabel('Türkçe karakterler').click();
  expect(await targetText(page)).toMatch(/[çğıöşüÇĞİÖŞÜ]/);
});

test('a timed test ends by itself and shows up in the statistics', async ({page}) => {
  test.setTimeout(45_000);
  await openTrainer(page);
  await page.getByRole('tab', {name: /Hız testi/}).click();
  await page.getByRole('radio', {name: '15 sn'}).click();
  const words = await targetText(page);
  await page.keyboard.type(words.slice(0, 60), {delay: 40});
  await expect(page.getByTestId('result-wpm')).toBeVisible({timeout: 20_000});
  await page.getByRole('tab', {name: /İstatistik/}).click();
  await expect(page.getByText('En iyi test')).toBeVisible();
  await expect(page.getByText('Hata ısı haritası')).toBeVisible();
});
