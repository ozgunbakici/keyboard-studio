import {devices, expect, test, type Page} from '@playwright/test';

test.use({...devices['Pixel 7']});

const caretIndex = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('[aria-label="Yazılacak metin"] > span')].findIndex((el) => el.hasAttribute('data-current')));

const openTrainer = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Menü'}).click();
  await page.getByRole('button', {name: 'Yazı antrenmanı', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Yazı antrenmanı'})).toBeVisible();
};

test('the menu is a drawer and lessons work with a hardware keyboard', async ({page}) => {
  await openTrainer(page);
  // The drawer closed after choosing a section.
  await expect(page.getByRole('button', {name: 'Yazı antrenmanı', exact: true})).not.toBeInViewport();
  await expect(page.getByRole('combobox', {name: 'Ders'})).toBeVisible();
  const text = ((await page.getByLabel('Yazılacak metin').textContent()) ?? '').replace(/↵\n/g, '\n');
  await page.getByLabel('Yazılacak metin').click();
  await page.keyboard.type(text, {delay: 3});
  await expect(page.getByTestId('result-wpm')).toBeVisible();
});

test('follows a word-suggesting on-screen keyboard', async ({page, context}) => {
  await openTrainer(page);
  await page.getByRole('tab', {name: 'Pratik'}).click();
  await page.getByRole('radio', {name: 'İngilizce kelimeler'}).click();
  const words = ((await page.getByLabel('Yazılacak metin').textContent()) ?? '').split(' ');
  await page.getByLabel('Yazılacak metin').click();
  const cdp = await context.newCDPSession(page);
  // Each word grows as a composition, is committed, then a space follows.
  for (const word of words.slice(0, 2)) {
    for (let i = 1; i <= word.length; i++) await cdp.send('Input.imeSetComposition', {text: word.slice(0, i), selectionStart: i, selectionEnd: i});
    await cdp.send('Input.insertText', {text: word});
    await cdp.send('Input.insertText', {text: ' '});
  }
  expect(await caretIndex(page)).toBe(words.slice(0, 2).join(' ').length + 1);
  // The keyboard's Backspace deletes the placeholder in the hidden field.
  await page.evaluate(() => {
    const field = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Yazma alanı"]')!;
    field.setRangeText('', 0, 1, 'end');
    field.dispatchEvent(new InputEvent('input', {inputType: 'deleteContentBackward', bubbles: true}));
  });
  expect(await caretIndex(page)).toBe(words.slice(0, 2).join(' ').length);
});
