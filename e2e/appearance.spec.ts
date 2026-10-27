import {expect, test, type Page} from '@playwright/test';

// An 8×8 PNG, enough to stand in for an uploaded photo.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGOM6glgwAaYsIoOWgkA9tYBRiTNZ5AAAAAASUVORK5CYII=', 'base64');

const html = (page: Page) => page.locator('html');
const picture = (page: Page) => page.getByTestId('backdrop').locator('div').first();
const cssVar = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

const openSettings = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Ayarlar', exact: true}).click();
};

test('the plain background stays the default; each photo brings its keycap colours', async ({page}) => {
  await openSettings(page);
  await expect(html(page)).toHaveAttribute('data-bg', 'plain');
  await expect(html(page)).toHaveAttribute('data-keys', 'default');
  await expect(page.getByRole('button', {name: 'Düz', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('backdrop')).toHaveCount(0);

  const backgrounds = page.getByRole('group', {name: 'Arka plan'});
  await backgrounds.getByRole('button', {name: 'Sakura klavye'}).click();
  await expect(html(page)).toHaveAttribute('data-bg', 'image');
  await expect(html(page)).toHaveAttribute('data-keys', 'sakura');
  await expect(picture(page)).toHaveAttribute('style', /sakura/);
  expect(await cssVar(page, '--key-alpha')).toBe('#f2eee4');

  await backgrounds.getByRole('button', {name: 'Mordor'}).click();
  await expect(html(page)).toHaveAttribute('data-keys', 'mordor');
  await expect(picture(page)).toHaveAttribute('style', /mordor/);
  expect(await cssVar(page, '--key-mod')).toBe('#8e2a14');
  // A dark photo is darkened less.
  await expect(page.getByRole('slider', {name: 'Karartma'})).toHaveValue('30');

  // Kept after a reload, and the key colours can be changed on their own.
  await page.reload();
  await expect(html(page)).toHaveAttribute('data-keys', 'mordor');
  await page.getByRole('button', {name: 'Ayarlar', exact: true}).click();
  await page.getByRole('group', {name: 'Tuş renkleri'}).getByRole('button', {name: 'Varsayılan'}).click();
  await expect(html(page)).toHaveAttribute('data-keys', 'default');
  await expect(html(page)).toHaveAttribute('data-bg', 'image');

  await page.getByRole('button', {name: 'Düz', exact: true}).click();
  await expect(html(page)).toHaveAttribute('data-bg', 'plain');
  await expect(page.getByTestId('backdrop')).toHaveCount(0);
});

test('an uploaded picture becomes the background, survives a reload and can be removed', async ({page}) => {
  await openSettings(page);
  await page.getByLabel('Arka plan resmi yükle').setInputFiles({name: 'masam.png', mimeType: 'image/png', buffer: png});
  await expect(page.getByText('Arka plan resmi yüklendi.')).toBeVisible();
  await expect(html(page)).toHaveAttribute('data-bg', 'image');
  await expect(picture(page)).toHaveAttribute('style', /blob:/);
  await expect(page.getByRole('button', {name: 'Kendi resmim', exact: true})).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(picture(page)).toHaveAttribute('style', /blob:/);
  await page.getByRole('button', {name: 'Ayarlar', exact: true}).click();
  await page.getByRole('button', {name: 'Yüklenen resmi kaldır'}).click();
  await expect(html(page)).toHaveAttribute('data-bg', 'plain');
  await expect(page.getByRole('button', {name: 'Düz', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', {name: 'Yüklenen resmi kaldır'})).toHaveCount(0);
});
