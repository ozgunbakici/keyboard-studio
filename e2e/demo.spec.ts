import {expect, test, type Page} from '@playwright/test';

const openDemo = async (page: Page, layout = 'tr-q') => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Ayarlar', exact: true}).click();
  await page.getByLabel('Klavye düzeni').selectOption(layout);
  await page.getByRole('button', {name: /Demo klavyeyi aç/}).click();
  await expect(page.locator('[data-key-id]').first()).toBeVisible();
};

const key = (page: Page, row: number, col: number) => page.locator(`[data-row="${row}"][data-col="${col}"]`).first();

test('shows Turkish Q legends for the connected keyboard', async ({page}) => {
  await openDemo(page);
  await expect(key(page, 3, 10)).toHaveAttribute('aria-label', /Ş/);
  await expect(key(page, 2, 8)).toHaveAttribute('aria-label', /^I /);
  await expect(key(page, 3, 11)).toHaveAttribute('aria-label', /İ/);
});

test('assigns a keycode, advances the selection and undoes it', async ({page}) => {
  await openDemo(page);
  await key(page, 2, 1).click();
  await page.getByRole('tab', {name: 'Katmanlar'}).click();
  await page.getByRole('button', {name: /^MO 2/}).first().click();
  await expect(key(page, 2, 1)).toHaveAttribute('aria-label', /Katman 2/);
  // Selection moved on to the next key (W).
  await expect(key(page, 2, 2)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: /Geri al/}).click();
  await expect(key(page, 2, 1)).toHaveAttribute('aria-label', /^Q /);
});

test('puts AltGr symbols on a key in one click', async ({page}) => {
  await openDemo(page);
  await key(page, 4, 11).click();
  await page.getByRole('tab', {name: /Semboller/}).click();
  await page.getByRole('button', {name: /^@/}).first().click();
  await expect(key(page, 4, 11)).toHaveAttribute('aria-label', /@ karakteri/);
});

test('layout options swap keys in place', async ({page}) => {
  await openDemo(page);
  const before = await page.locator('[data-key-id]').count();
  await page.getByLabel('Sol Shift', {exact: true}).selectOption('1');
  await expect(page.locator('[data-key-id]')).toHaveCount(before + 1);
  await expect(key(page, 4, 1)).toBeVisible();
});

test('macro text is converted for Turkish Q and survives a round trip', async ({page}) => {
  await openDemo(page);
  await page.getByRole('button', {name: 'Makrolar'}).click();
  const text = 'Şişli ofisi: ad@gmail.com {not}';
  await page.locator('textarea').first().fill(text);
  await expect(page.locator('pre').first()).toHaveText(text);
  await page.getByRole('button', {name: 'Klavyeye kaydet'}).click();
  await expect(page.getByRole('button', {name: 'Klavyeye kaydet'})).toBeDisabled();
  // Re-read from the (virtual) keyboard and check the decoded text.
  await page.getByRole('button', {name: 'Klavyeden yeniden oku'}).click();
  await page.getByRole('button', {name: 'Makrolar'}).click();
  await expect(page.locator('textarea').first()).toHaveValue(text);
});

test('lighting controls are translated and writable', async ({page}) => {
  await openDemo(page);
  await page.getByRole('button', {name: 'Işık ve ayarlar'}).click();
  await expect(page.getByText('Parlaklık')).toBeVisible();
  await page.getByLabel('Efekt', {exact: true}).selectOption({label: 'Kapalı'});
  // Speed is hidden when lighting is off (showIf).
  await expect(page.getByText('Efekt hızı')).toBeHidden();
});

test('mouse keys have their own tab and turn up when searching "mouse"', async ({page}) => {
  await openDemo(page, 'us');
  await key(page, 2, 1).click();
  await page.getByRole('tab', {name: 'Fare'}).click();
  await page.getByRole('button', {name: 'Sol tık', exact: true}).click();
  await expect(key(page, 2, 1)).toHaveAttribute('aria-label', /^Sol tık/);
  await key(page, 2, 3).click();
  await page.getByPlaceholder(/Tuş ara/).fill('mouse');
  await expect(page.getByRole('button', {name: 'Teker ↓', exact: true})).toBeVisible();
});
