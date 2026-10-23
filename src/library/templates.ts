import type {ActionVariant, LibraryAction} from './types';

const CTRL = 0x01;
const SHIFT = 0x02;
const ALT = 0x04;
const GUI = 0x08;

type Template = Omit<LibraryAction, 'id' | 'createdAt' | 'updatedAt' | 'trigger'>;

const both = (windows: ActionVariant, mac: ActionVariant) => ({windows, mac});

/** Ready-made actions to start a library with; each is editable after adding. */
export const actionTemplates: Template[] = [
  {name: 'Kopyala', kind: 'shortcut', tags: ['düzenleme'], perOs: true, variants: both({shortcut: {mods: CTRL, key: 'KC_C'}}, {shortcut: {mods: GUI, key: 'KC_C'}})},
  {name: 'Yapıştır', kind: 'shortcut', tags: ['düzenleme'], perOs: true, variants: both({shortcut: {mods: CTRL, key: 'KC_V'}}, {shortcut: {mods: GUI, key: 'KC_V'}})},
  {name: 'Kes', kind: 'shortcut', tags: ['düzenleme'], perOs: true, variants: both({shortcut: {mods: CTRL, key: 'KC_X'}}, {shortcut: {mods: GUI, key: 'KC_X'}})},
  {name: 'Geri al', kind: 'shortcut', tags: ['düzenleme'], perOs: true, variants: both({shortcut: {mods: CTRL, key: 'KC_Z'}}, {shortcut: {mods: GUI, key: 'KC_Z'}})},
  {name: 'Yinele', kind: 'shortcut', tags: ['düzenleme'], perOs: true, variants: both({shortcut: {mods: CTRL, key: 'KC_Y'}}, {shortcut: {mods: GUI | SHIFT, key: 'KC_Z'}})},
  {name: 'Tümünü seç', kind: 'shortcut', tags: ['düzenleme'], perOs: true, variants: both({shortcut: {mods: CTRL, key: 'KC_A'}}, {shortcut: {mods: GUI, key: 'KC_A'}})},
  {name: 'Kaydet', kind: 'shortcut', tags: ['düzenleme'], perOs: true, variants: both({shortcut: {mods: CTRL, key: 'KC_S'}}, {shortcut: {mods: GUI, key: 'KC_S'}})},
  {name: 'Ekran görüntüsü (bölge)', kind: 'shortcut', tags: ['sistem'], perOs: true, variants: both({shortcut: {mods: GUI | SHIFT, key: 'KC_S'}}, {shortcut: {mods: GUI | SHIFT, key: 'KC_4'}})},
  {name: 'Ekranı kilitle', kind: 'shortcut', tags: ['sistem'], perOs: true, variants: both({shortcut: {mods: GUI, key: 'KC_L'}}, {shortcut: {mods: CTRL | GUI, key: 'KC_Q'}})},
  {name: 'Pencere değiştir', kind: 'shortcut', tags: ['sistem'], perOs: true, variants: both({shortcut: {mods: ALT, key: 'KC_TAB'}}, {shortcut: {mods: GUI, key: 'KC_TAB'}})},
  {name: 'Yeni sekme', kind: 'shortcut', tags: ['tarayıcı'], perOs: true, variants: both({shortcut: {mods: CTRL, key: 'KC_T'}}, {shortcut: {mods: GUI, key: 'KC_T'}})},
  {name: 'Kapatılan sekmeyi aç', kind: 'shortcut', tags: ['tarayıcı'], perOs: true, variants: both({shortcut: {mods: CTRL | SHIFT, key: 'KC_T'}}, {shortcut: {mods: GUI | SHIFT, key: 'KC_T'}})},
  {name: 'Satırı yorum yap (IDE)', kind: 'shortcut', tags: ['kod'], perOs: true, variants: both({shortcut: {mods: CTRL, key: 'KC_SLSH'}}, {shortcut: {mods: GUI, key: 'KC_SLSH'}})},
  {name: 'VS Code', kind: 'app', tags: ['uygulama', 'kod'], perOs: true, variants: both({target: 'code'}, {target: 'Visual Studio Code'})},
  {name: 'Terminal', kind: 'app', tags: ['uygulama', 'kod'], perOs: true, variants: both({target: 'wt'}, {target: 'Terminal'})},
  {name: 'GitHub', kind: 'url', tags: ['web'], perOs: false, variants: both({target: 'https://github.com'}, {})},
  {name: 'E-posta adresim', kind: 'text', tags: ['metin'], perOs: false, variants: both({text: 'ad@ornek.com'}, {})},
  {name: 'Python main bloğu', kind: 'text', tags: ['kod', 'python'], perOs: false, variants: both({text: 'if __name__ == "__main__":\n'}, {})},
  {name: 'Java main metodu', kind: 'text', tags: ['kod', 'java'], perOs: false, variants: both({text: 'public static void main(String[] args) {\n'}, {})},
];
