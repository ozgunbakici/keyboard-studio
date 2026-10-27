import {expect, test, type Browser, type Page} from '@playwright/test';
import {FakeGitHub} from './fake-github';

const REPO = 'ozgun/klavye-studio-veri';

const keyNamed = (page: Page, name: string) => page.locator(`g[data-key-id][aria-label^="${name}"]`).first();

const setup = () => {
  const github = new FakeGitHub();
  github.addToken('token-1', 'ozgun');
  github.addRepo(REPO);
  github.addRepo('ozgun/herkese-acik', {isPrivate: false});
  return github;
};

/** A computer of its own: separate browser storage, same GitHub. */
const device = async (browser: Browser, github: FakeGitHub) => {
  const context = await browser.newContext();
  await github.attach(context);
  const page = await context.newPage();
  await page.goto('/');
  return page;
};

const openSettings = (page: Page) => page.getByRole('button', {name: 'Ayarlar', exact: true}).click();

const connect = async (page: Page, {repo = 'klavye-studio-veri', token = 'token-1'} = {}) => {
  await openSettings(page);
  await page.getByLabel('Depo', {exact: true}).fill(repo);
  await page.getByLabel('Erişim anahtarı').fill(token);
  await page.getByRole('button', {name: 'Bağlan ve eşitle'}).click();
};

const syncNow = async (page: Page) => {
  await openSettings(page);
  const status = page.getByTestId('cloud-status');
  const before = (await status.getAttribute('data-last-sync')) ?? '';
  await page.getByRole('button', {name: 'Şimdi eşitle'}).click();
  await expect(status).not.toHaveAttribute('data-last-sync', before);
  await expect(status).toHaveText(/Eşitlendi/);
};

/** Templates in the library, the demo keyboard open and Kopyala on its F5 key. */
const copyOnF5 = async (page: Page) => {
  await page.getByRole('button', {name: 'Eylemler', exact: true}).click();
  await page.getByRole('button', {name: 'Hazır eylemler'}).first().click();
  await page.getByRole('button', {name: /eylemi ekle$/}).click();
  await page.getByRole('button', {name: /Demo klavyeyi aç/}).click();
  await keyNamed(page, 'F5').click();
  await page.getByRole('tab', {name: /Eylemler/}).click();
  await page.getByRole('button', {name: /^Kopyala Kısayol/}).click();
  await expect(keyNamed(page, 'Kopyala (')).toHaveAttribute('aria-label', /Ctrl\+C kısayolu/);
};

test('actions, key bindings and settings made on one computer reach the other', async ({browser}) => {
  const github = setup();
  const windows = await device(browser, github);
  await copyOnF5(windows);
  await openSettings(windows);
  await windows.getByLabel('Tema').selectOption('light');
  await connect(windows);
  await expect(windows.getByText('Eşitleme açıldı')).toBeVisible();
  await expect(windows.getByTestId('cloud-status')).toHaveText(/Eşitlendi/);

  const files = github.files(REPO);
  expect(files.get('README.md')).toContain('Klavye Stüdyo');
  expect(files.get('eylemler.json')).toContain('"Kopyala"');
  expect(files.get('atamalar.json')).toContain('"keyName"');
  expect(files.get('ayarlar.json')).toContain('"light"');

  // The Mac joins: its default dark theme gives way to the shared choice.
  const mac = await device(browser, github);
  await connect(mac);
  await expect(mac.locator('html')).toHaveAttribute('data-theme', 'light');
  await mac.getByLabel('İşletim sistemi').selectOption('mac');
  await mac.getByRole('button', {name: /Demo klavyeyi aç/}).click();
  // The keyboard gets the Mac version of the action bound on the Windows computer.
  await expect(keyNamed(mac, 'Kopyala (')).toHaveAttribute('aria-label', /⌘\+C kısayolu/);
});

test('a deletion on one computer clears the key on the other, and practice history travels', async ({browser}) => {
  const github = setup();
  const windows = await device(browser, github);
  await copyOnF5(windows);
  await connect(windows);
  await expect(windows.getByTestId('cloud-status')).toHaveText(/Eşitlendi/);

  const mac = await device(browser, github);
  await connect(mac);
  await expect(mac.getByTestId('cloud-status')).toHaveText(/Eşitlendi/);
  await mac.getByRole('button', {name: 'Eylemler', exact: true}).click();
  await mac.getByLabel('Eylem ara').fill('Kopyala');
  await mac.getByRole('button', {name: /^Kopyala/}).first().click();
  await mac.getByRole('button', {name: 'Eylemi sil'}).click();
  await mac.getByRole('button', {name: 'Sil', exact: true}).click();

  // A lesson on the Mac, slow enough (over 3 s) to be kept in the history.
  await mac.getByRole('button', {name: 'Yazı antrenmanı'}).click();
  const text = (await mac.getByLabel('Yazılacak metin').textContent()) ?? '';
  await mac.keyboard.type(text, {delay: 3500 / text.length});
  await expect(mac.getByTestId('result-wpm')).toBeVisible();
  await syncNow(mac);
  expect([...github.files(REPO).keys()].some((path) => path.startsWith('antrenman/'))).toBe(true);
  expect(github.files(REPO).get('eylemler.json')).not.toContain('"Kopyala"');

  await syncNow(windows);
  await windows.getByRole('button', {name: 'Tuş haritası'}).click();
  await expect(keyNamed(windows, 'Kopyala (')).toHaveCount(0);
  await expect(windows.locator('g[data-row="0"][data-col="5"]')).toHaveAttribute('aria-label', /^Boş/);
  const records = await windows.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open('klavye-studio');
        open.onsuccess = () => {
          const count = open.result.transaction('typing').objectStore('typing').count();
          count.onsuccess = () => resolve(count.result);
        };
      }),
  );
  expect(records).toBeGreaterThan(0);
});

test('refuses a public repository and a wrong token', async ({browser}) => {
  const github = setup();
  const page = await device(browser, github);
  await connect(page, {repo: 'herkese-acik'});
  await expect(page.getByRole('alert')).toContainText('herkese açık');
  await connect(page, {token: 'yanlis'});
  await expect(page.getByRole('alert')).toContainText('Anahtar geçersiz');
  expect(github.files('ozgun/herkese-acik').size).toBe(0);
});
