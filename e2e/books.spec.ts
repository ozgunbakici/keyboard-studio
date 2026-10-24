import {expect, test, type Page} from '@playwright/test';

const targetText = async (page: Page) => ((await page.getByLabel('Yazılacak metin').textContent()) ?? '').replace(/↵\n/g, '\n');

const openPractice = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Yazı antrenmanı'}).click();
  await page.getByRole('tab', {name: /Pratik/}).click();
};

test('public-domain book excerpts can be practised, Turkish letters folded', async ({page}) => {
  await openPractice(page);
  await page.getByRole('radio', {name: 'Türkçe kitaplardan'}).click();
  await page.getByLabel('Alıntı').selectOption({label: 'Orhan Veli Kanık — İstanbul’u Dinliyorum'});
  await expect(page.getByText('kamu malı eser')).toBeVisible();
  const text = await targetText(page);
  expect(text.startsWith("Istanbul'u dinliyorum, gozlerim kapali;\nOnce hafiften")).toBe(true);
  await page.keyboard.type(text, {delay: 2});
  await expect(page.getByTestId('result-wpm')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Başka alıntı'}).last()).toBeVisible();
});

test('own texts are split into passages and remember where you are', async ({page}) => {
  await openPractice(page);
  await page.getByRole('radio', {name: 'Kendi metinlerim'}).click();
  const sentence = (i: number) => `This is sentence number ${i} of a chapter that is long enough to need two passages.`;
  await page.getByLabel('Metin başlığı').fill('Deneme bölümü');
  await page.getByLabel('Metin', {exact: true}).fill([1, 2, 3, 4, 5, 6].map(sentence).join(' '));
  await page.getByRole('button', {name: 'Ekle ve başla'}).click();
  await expect(page.getByText('Bölüm 1 / 2')).toBeVisible();
  await page.keyboard.type(await targetText(page), {delay: 2});
  await page.getByRole('button', {name: 'Sonraki bölüm'}).click();
  await expect(page.getByText('Bölüm 2 / 2')).toBeVisible();
  expect(await targetText(page)).toContain('sentence number 6');

  await page.reload();
  await page.getByRole('button', {name: 'Yazı antrenmanı'}).click();
  await page.getByRole('tab', {name: /Pratik/}).click();
  await expect(page.getByText('Bölüm 2 / 2')).toBeVisible();
  await expect(page.getByLabel('Metin', {exact: true})).toHaveValue(/^metin-/);
});
