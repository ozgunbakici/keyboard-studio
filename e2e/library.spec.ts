import {readFile} from 'node:fs/promises';
import {expect, test, type Page} from '@playwright/test';

/** Key cap whose accessible name starts with `name` (keys bound to actions start with the action name). */
const keyNamed = (page: Page, name: string) => page.locator(`g[data-key-id][aria-label^="${name}"]`).first();

const openLibrary = async (page: Page) => {
  await page.getByRole('button', {name: 'Eylemler', exact: true}).click();
};

const addTemplates = async (page: Page) => {
  await page.goto('/');
  await openLibrary(page);
  await page.getByRole('button', {name: 'Hazır eylemler'}).first().click();
  await page.getByRole('button', {name: /eylemi ekle$/}).click();
  await expect(page.getByText(/hazır eylem eklendi/)).toBeVisible();
};

const openDemo = async (page: Page) => {
  await page.getByRole('button', {name: /Demo klavyeyi aç/}).click();
  await expect(page.locator('[data-key-id]').first()).toBeVisible();
};

const setOs = async (page: Page, os: 'mac' | 'other') => {
  await page.getByRole('button', {name: 'Ayarlar', exact: true}).click();
  await page.getByLabel('İşletim sistemi').selectOption(os);
  await page.getByRole('button', {name: 'Tuş haritası'}).click();
};

const assignFromLibrary = async (page: Page, keyName: string, action: RegExp) => {
  await keyNamed(page, keyName).click();
  await page.getByRole('tab', {name: /Eylemler/}).click();
  await page.getByRole('button', {name: action}).click();
};

test('a library shortcut follows the computer’s OS', async ({page}) => {
  await addTemplates(page);
  await openDemo(page);
  await setOs(page, 'other');
  await assignFromLibrary(page, 'F5', /^Kopyala Kısayol/);
  const copy = keyNamed(page, 'Kopyala (');
  await expect(copy).toHaveAttribute('aria-label', /Ctrl\+C kısayolu/);
  await setOs(page, 'mac');
  await expect(copy).toHaveAttribute('aria-label', /⌘\+C kısayolu/);
});

test('Turkish text uses the helper on Windows US and a keyboard macro on macOS', async ({page}) => {
  await page.goto('/');
  await openLibrary(page);
  await page.getByRole('button', {name: /Yeni eylem/}).click();
  await page.getByRole('menuitem', {name: /Metin/}).click();
  await page.getByLabel('Eylem adı').fill('İmza');
  await page.getByLabel(/Metin \(tüm sistemler\)/).fill('Saygılarımla,\nÖzgün');
  await expect(page.getByText(/Yardımcı program yazar/)).toBeVisible();
  await page.getByRole('button', {name: 'Kütüphaneye ekle'}).click();

  await openDemo(page);
  await setOs(page, 'other');
  await assignFromLibrary(page, 'F8', /^İmza Metin/);
  const signature = keyNamed(page, 'İmza (');
  await expect(signature).toHaveAttribute('aria-label', /F13 kısayolu/);
  await setOs(page, 'mac');
  await expect(signature).toHaveAttribute('aria-label', /Makro \d+/);
  await setOs(page, 'other');
  await expect(signature).toHaveAttribute('aria-label', /F13 kısayolu/);

  await openLibrary(page);
  await page.getByRole('tab', {name: /Yardımcı programlar/}).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: 'klavye-studio.ahk indir'}).click();
  const text = await readFile((await (await download).path())!, 'utf8');
  expect(text).toContain("^!+F13::SendText 'Saygılarımla,`nÖzgün'");
  await expect(page.getByText('indirilen dosya güncel')).toBeVisible();
});

test('deleting an action empties the keys it was on', async ({page}) => {
  await addTemplates(page);
  await openDemo(page);
  await assignFromLibrary(page, 'F5', /^Kopyala Kısayol/);
  await keyNamed(page, 'Kopyala (').click();
  await page.getByRole('button', {name: 'Eylemi düzenle'}).click();
  await expect(page.getByLabel('Eylem adı')).toHaveValue('Kopyala');
  await expect(page.getByText('F5 tuşu')).toBeVisible();
  await page.getByRole('button', {name: 'Eylemi sil'}).click();
  await page.getByRole('button', {name: 'Sil', exact: true}).click();
  await page.getByRole('button', {name: 'Tuş haritası'}).click();
  await expect(keyNamed(page, 'Kopyala (')).toHaveCount(0);
  await expect(page.locator('g[data-row="0"][data-col="5"]')).toHaveAttribute('aria-label', /^Boş/);
});
