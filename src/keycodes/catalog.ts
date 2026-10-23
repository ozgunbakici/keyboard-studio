import {isDeadStroke, type HostLayout} from './host-layouts';
/**
 * Keycode menus shown in the picker, with Turkish labels and explanations.
 * `code` is the canonical text form understood by KeycodeCodec.
 */

export type CatalogKey = {
  code: string;
  label: string;
  title?: string;
  /** Relative width in the picker grid (1 = one key). */
  w?: number;
};

export type CatalogSection = {label: string; keys: CatalogKey[]};

export type CatalogGroup = {
  id: string;
  label: string;
  description?: string;
  sections: CatalogSection[];
};

const k = (code: string, label: string, title?: string, w?: number): CatalogKey => ({code, label, title, w});

const lettersSection: CatalogSection = {
  label: 'Harfler',
  keys: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => k(`KC_${c}`, c)),
};

const numberSection: CatalogSection = {
  label: 'Rakamlar ve semboller',
  keys: [
    k('KC_1', '1'),
    k('KC_2', '2'),
    k('KC_3', '3'),
    k('KC_4', '4'),
    k('KC_5', '5'),
    k('KC_6', '6'),
    k('KC_7', '7'),
    k('KC_8', '8'),
    k('KC_9', '9'),
    k('KC_0', '0'),
    k('KC_GRV', '`', 'Sol üstteki ` / ~ tuşu'),
    k('KC_MINS', '-'),
    k('KC_EQL', '='),
    k('KC_LBRC', '['),
    k('KC_RBRC', ']'),
    k('KC_BSLS', '\\', 'ANSI ters bölü tuşu'),
    k('KC_SCLN', ';'),
    k('KC_QUOT', "'"),
    k('KC_COMM', ','),
    k('KC_DOT', '.'),
    k('KC_SLSH', '/'),
    k('KC_NUBS', '< >', 'ISO ek tuşu (Türkçe Q’da < > |). ANSI klavyelerde fiziksel olarak yoktur.'),
    k('KC_NUHS', 'ISO #', 'ISO Enter yanındaki tuş'),
  ],
};

const editingSection: CatalogSection = {
  label: 'Düzenleme',
  keys: [
    k('KC_ESC', 'Esc'),
    k('KC_TAB', 'Tab', undefined, 1.5),
    k('KC_CAPS', 'Caps Lock', undefined, 1.75),
    k('KC_ENT', 'Enter', undefined, 2),
    k('KC_SPC', 'Boşluk', 'Space', 2.5),
    k('KC_BSPC', 'Backspace', 'Geri sil', 2),
    k('KC_DEL', 'Delete', 'İleri sil'),
    k('KC_INS', 'Insert'),
    k('KC_APP', 'Menü', 'Uygulama menüsü tuşu'),
  ],
};

const navigationSection: CatalogSection = {
  label: 'Gezinme',
  keys: [
    k('KC_LEFT', '←', 'Sol ok'),
    k('KC_DOWN', '↓', 'Aşağı ok'),
    k('KC_UP', '↑', 'Yukarı ok'),
    k('KC_RGHT', '→', 'Sağ ok'),
    k('KC_HOME', 'Home'),
    k('KC_END', 'End'),
    k('KC_PGUP', 'PgUp', 'Sayfa yukarı'),
    k('KC_PGDN', 'PgDn', 'Sayfa aşağı'),
    k('KC_PSCR', 'PrtSc', 'Ekran görüntüsü'),
    k('KC_SLCK', 'ScrLk', 'Scroll Lock'),
    k('KC_PAUS', 'Pause'),
  ],
};

const modifierSection: CatalogSection = {
  label: 'Değiştirici tuşlar',
  keys: [
    k('KC_LCTL', 'Sol Ctrl', 'macOS’ta Control (⌃)', 1.25),
    k('KC_LSFT', 'Sol Shift', undefined, 1.5),
    k('KC_LALT', 'Sol Alt', 'macOS’ta Option (⌥)', 1.25),
    k('KC_LGUI', 'Sol Win', 'macOS’ta Command (⌘)', 1.25),
    k('KC_RCTL', 'Sağ Ctrl', undefined, 1.25),
    k('KC_RSFT', 'Sağ Shift', undefined, 1.5),
    k('KC_RALT', 'AltGr', 'Sağ Alt / AltGr (Türkçe Q’da @ € { [ ] } için)', 1.25),
    k('KC_RGUI', 'Sağ Win', 'macOS’ta sağ Command', 1.25),
  ],
};

const functionSection: CatalogSection = {
  label: 'Fonksiyon tuşları',
  keys: Array.from({length: 24}, (_, i) =>
    k(`KC_F${i + 1}`, `F${i + 1}`, i >= 12 ? 'F13–F24 çoğu klavyede yok: yardımcı programlar için çakışmasız tetik' : undefined),
  ),
};

const numpadSection: CatalogSection = {
  label: 'Sayısal tuş takımı',
  keys: [
    k('KC_NLCK', 'NumLk', 'Num Lock'),
    k('KC_PSLS', 'N÷', 'Numpad /'),
    k('KC_PAST', 'N×', 'Numpad *'),
    k('KC_PMNS', 'N−', 'Numpad -'),
    k('KC_PPLS', 'N+', 'Numpad +'),
    k('KC_PENT', 'NEnt', 'Numpad Enter'),
    k('KC_PDOT', 'N.', 'Numpad .'),
    k('KC_PCMM', 'N,', 'Numpad ,'),
    k('KC_PEQL', 'N=', 'Numpad ='),
    ...Array.from({length: 10}, (_, i) => k(`KC_P${i}`, `N${i}`, `Numpad ${i}`)),
  ],
};

const basicGroup: CatalogGroup = {
  id: 'basic',
  label: 'Temel',
  sections: [
    {
      label: 'Özel',
      keys: [
        k('KC_NO', 'Boş', 'Hiçbir şey yapmaz'),
        k('KC_TRNS', '▽', 'Geçirgen: alttaki katmanın tuşu çalışır'),
      ],
    },
    lettersSection,
    numberSection,
    editingSection,
    modifierSection,
    navigationSection,
    functionSection,
    numpadSection,
  ],
};

const mediaGroup: CatalogGroup = {
  id: 'media',
  label: 'Medya ve sistem',
  sections: [
    {
      label: 'Ses ve medya',
      keys: [
        k('KC_MUTE', 'Sessiz', 'Sesi kapat/aç'),
        k('KC_VOLD', 'Ses −'),
        k('KC_VOLU', 'Ses +'),
        k('KC_MPLY', 'Oynat', 'Oynat / Duraklat'),
        k('KC_MSTP', 'Durdur'),
        k('KC_MPRV', 'Önceki'),
        k('KC_MNXT', 'Sonraki'),
        k('KC_MRWD', 'Geri sar'),
        k('KC_MFFD', 'İleri sar'),
        k('KC_MSEL', 'Medya seç'),
        k('KC_EJCT', 'Çıkar', 'Eject'),
      ],
    },
    {
      label: 'Ekran ve sistem',
      keys: [
        k('KC_BRID', 'Parlaklık −', 'Ekran parlaklığı azalt'),
        k('KC_BRIU', 'Parlaklık +', 'Ekran parlaklığı artır'),
        k('KC_MCTL', 'Mission', 'macOS Mission Control'),
        k('KC_LPAD', 'Launchpad', 'macOS Launchpad'),
        k('KC_PWR', 'Güç', 'Sistem güç tuşu'),
        k('KC_SLEP', 'Uyku'),
        k('KC_WAKE', 'Uyan'),
        k('KC_CALC', 'Hesap', 'Hesap makinesi'),
        k('KC_MAIL', 'Posta'),
        k('KC_MYCM', 'Bilgisayarım'),
      ],
    },
    {
      label: 'Tarayıcı',
      keys: [
        k('KC_WWW_SEARCH', 'Ara'),
        k('KC_WWW_HOME', 'Ana sayfa'),
        k('KC_WWW_BACK', 'Geri'),
        k('KC_WWW_FORWARD', 'İleri'),
        k('KC_WWW_STOP', 'Dur'),
        k('KC_WWW_REFRESH', 'Yenile'),
        k('KC_WWW_FAVORITES', 'Favoriler'),
      ],
    },
  ],
};

// Titles carry the English words too, so searching "mouse", "click" or "scroll" finds them.
const mouseGroup: CatalogGroup = {
  id: 'mouse',
  label: 'Fare',
  description:
    'Fareyi klavyeden kullan: imleci oynat, tıkla, kaydır. Klavyenin firmware’inde fare tuşları (Mouse keys) açıksa çalışır; çoğu VIA klavyede açıktır. ' +
    'Genelde ayrı bir katmana konur ve o katman bir MO tuşuyla açılır. Knob’a Teker ↑ / ↓ atanırsa sayfayı kaydırır.',
  sections: [
    {
      label: 'İmleç',
      keys: [
        k('KC_MS_UP', 'Fare ↑', 'Fare (mouse) imlecini yukarı götürür; basılı tuttukça hızlanır'),
        k('KC_MS_DOWN', 'Fare ↓', 'Fare (mouse) imlecini aşağı götürür; basılı tuttukça hızlanır'),
        k('KC_MS_LEFT', 'Fare ←', 'Fare (mouse) imlecini sola götürür; basılı tuttukça hızlanır'),
        k('KC_MS_RIGHT', 'Fare →', 'Fare (mouse) imlecini sağa götürür; basılı tuttukça hızlanır'),
      ],
    },
    {
      label: 'Tıklama',
      keys: [
        k('KC_MS_BTN1', 'Sol tık', 'Farenin sol tuşu (mouse left click); basılı tutunca sürükler'),
        k('KC_MS_BTN2', 'Sağ tık', 'Farenin sağ tuşu (mouse right click)'),
        k('KC_MS_BTN3', 'Orta tık', 'Farenin orta tuşu, tekerleğe basmak (mouse middle click)'),
        k('KC_MS_BTN4', 'Tık 4', 'Farenin 4. tuşu (mouse button 4); tarayıcıda genelde geri'),
        k('KC_MS_BTN5', 'Tık 5', 'Farenin 5. tuşu (mouse button 5); tarayıcıda genelde ileri'),
      ],
    },
    {
      label: 'Tekerlek',
      keys: [
        k('KC_MS_WH_UP', 'Teker ↑', 'Fare tekerleği: yukarı kaydırır (mouse scroll up)'),
        k('KC_MS_WH_DOWN', 'Teker ↓', 'Fare tekerleği: aşağı kaydırır (mouse scroll down)'),
        k('KC_MS_WH_LEFT', 'Teker ←', 'Fare tekerleği: sola kaydırır (mouse scroll left)'),
        k('KC_MS_WH_RIGHT', 'Teker →', 'Fare tekerleği: sağa kaydırır (mouse scroll right)'),
      ],
    },
    {
      label: 'Hız',
      keys: [
        k('KC_MS_ACCEL0', 'Hız 0', 'Basılıyken imleç yavaş gider, hassas işler için (mouse speed)'),
        k('KC_MS_ACCEL1', 'Hız 1', 'Basılıyken imleç orta hızda gider (mouse speed)'),
        k('KC_MS_ACCEL2', 'Hız 2', 'Basılıyken imleç hızlı gider (mouse speed)'),
      ],
    },
  ],
};

const layerFns: [string, string, string][] = [
  ['MO', 'Basılıyken', 'Basılı tutulduğu sürece katmanı açar'],
  ['TG', 'Aç/Kapat', 'Her basışta katmanı açar ya da kapatır'],
  ['TT', 'Tut/Çift', 'Basılı tutunca MO gibi, art arda dokununca kilitler'],
  ['OSL', 'Tek sefer', 'Sadece bir sonraki tuş için katmanı açar'],
  ['TO', 'Geç', 'Bu katmana geçer, diğerlerini kapatır'],
  ['DF', 'Varsayılan', 'Varsayılan katmanı değiştirir (güç kesilince sıfırlanır)'],
  ['PDF', 'Kalıcı vars.', 'Varsayılan katmanı kalıcı yapar (QMK 2024+). Mac/Windows katmanı geçişi için ideal.'],
];

export const buildLayerGroup = (layerCount: number, protocol: number): CatalogGroup => ({
  id: 'layers',
  label: 'Katmanlar',
  description: 'Katman tuşları; tuşa tıklayıp altta katmanı seç.',
  sections: [
    ...layerFns
      .filter(([fn]) => fn !== 'PDF' || protocol >= 12)
      .map(([fn, label, title]) => ({
        label: `${fn} · ${label}`,
        keys: Array.from({length: Math.max(layerCount, 1)}, (_, layer) =>
          k(`${fn}(${layer})`, `${fn} ${layer}`, `${title} (Katman ${layer})`),
        ),
      })),
    {
      label: 'Hazır kombinasyonlar',
      keys: [
        k('LT(1,KC_SPC)', 'Boşluk / K1', 'Dokununca boşluk, basılı tutunca Katman 1'),
        k('LT(2,KC_SPC)', 'Boşluk / K2', 'Dokununca boşluk, basılı tutunca Katman 2'),
        k('FN_MO13', 'Fn1 (3)', 'Basılıyken Katman 1; Fn2 ile birlikte Katman 3'),
        k('FN_MO23', 'Fn2 (3)', 'Basılıyken Katman 2; Fn1 ile birlikte Katman 3'),
      ],
    },
  ],
});

export const buildMacroGroup = (macroCount: number, names: (string | undefined)[] = []): CatalogGroup => ({
  id: 'macros',
  label: 'Makrolar',
  description: 'Klavyenin hafızasındaki makro slotları.',
  sections: [
    {
      label: 'Makro slotları',
      keys: Array.from({length: macroCount}, (_, i) =>
        k(`MACRO(${i})`, names[i] ? names[i]! : `M${i}`, names[i] ? `M${i}: ${names[i]}` : `Makro ${i}`),
      ),
    },
  ],
});

const specialGroup: CatalogGroup = {
  id: 'special',
  label: 'Özel',
  sections: [
    {
      label: 'Akıllı tuşlar',
      keys: [
        k('KC_GESC', 'Esc / `', 'Normalde Esc; Shift veya Win ile ` yazar'),
        k('CW_TOGG', 'Caps Word', 'Sonraki kelimeyi büyük harf yazar (QMK 2022+)'),
        k('QK_REP', 'Tekrar', 'Son basılan tuşu tekrarlar (QMK 2023+)'),
        k('QK_AREP', 'Ters tekrar', 'Son tuşun “tersini” gönderir (QMK 2023+)'),
        k('QK_LLCK', 'Katman kilidi', 'Etkin katmanı kilitler (QMK 2024+)'),
        k('KC_LSPO', 'Shift / (', 'Sol Shift; dokununca ('),
        k('KC_RSPC', 'Shift / )', 'Sağ Shift; dokununca )'),
        k('KC_LCPO', 'Ctrl / (', 'Sol Ctrl; dokununca ('),
        k('KC_RCPC', 'Ctrl / )', 'Sağ Ctrl; dokununca )'),
        k('KC_LAPO', 'Alt / (', 'Sol Alt; dokununca ('),
        k('KC_RAPC', 'Alt / )', 'Sağ Alt; dokununca )'),
        k('KC_SFTENT', 'Shift / Ent', 'Sağ Shift; dokununca Enter'),
      ],
    },
    {
      label: 'Ctrl / Win / Alt değişimi',
      keys: [
        k('MAGIC_SWAP_CTL_GUI', 'Ctrl↔Win', 'Ctrl ile Win/Command yer değiştirir'),
        k('MAGIC_UNSWAP_CTL_GUI', 'Ctrl↔Win geri', 'Değişimi geri alır'),
        k('MAGIC_TOGGLE_CTL_GUI', 'Ctrl↔Win aç/kapa'),
        k('MAGIC_SWAP_ALT_GUI', 'Alt↔Win', 'Alt ile Win/Command yer değiştirir (Mac için)'),
        k('MAGIC_UNSWAP_ALT_GUI', 'Alt↔Win geri'),
        k('MAGIC_TOGGLE_ALT_GUI', 'Alt↔Win aç/kapa'),
        k('MAGIC_GUI_OFF', 'Win kapalı', 'Win tuşlarını devre dışı bırakır (oyun)'),
        k('MAGIC_GUI_ON', 'Win açık'),
        k('MAGIC_TOGGLE_GUI', 'Win aç/kapa'),
        k('MAGIC_TOGGLE_NKRO', 'NKRO', 'N-tuş eş zamanlı basma modunu aç/kapat'),
      ],
    },
    {
      label: 'Uluslararası',
      keys: [
        k('KC_RO', 'JIS \\'),
        k('KC_JYEN', '¥'),
        k('KC_KANA', 'かな'),
        k('KC_HENK', '変換'),
        k('KC_MHEN', '無変換'),
        k('KC_HAEN', '한영'),
        k('KC_HANJ', '漢字'),
      ],
    },
    {
      label: 'Klavye bakımı',
      keys: [
        k('RESET', 'Bootloader', 'Klavyeyi firmware yükleme moduna alır (QK_BOOT)'),
        k('QK_REBOOT', 'Yeniden başlat'),
        k('QK_CLEAR_EEPROM', 'EEPROM sil', 'Tüm ayarları fabrika değerine döndürür'),
        k('DEBUG', 'Debug'),
      ],
    },
    {
      label: 'Diğer sistem tuşları',
      keys: [
        k('KC_LCAP', 'Kilit Caps'),
        k('KC_LNUM', 'Kilit Num'),
        k('KC_LSCR', 'Kilit Scroll'),
        k('KC_POWER', 'Power (Mac)'),
        k('KC_HELP', 'Yardım'),
        k('KC_UNDO', 'Geri al'),
        k('KC_CUT', 'Kes'),
        k('KC_COPY', 'Kopyala'),
        k('KC_PASTE', 'Yapıştır'),
        k('KC_FIND', 'Bul'),
        k('KC_AGAIN', 'Yinele'),
        k('KC_STOP', 'Stop'),
        k('KC_MENU', 'Menu'),
        k('KC_SELECT', 'Select'),
        k('KC_EXECUTE', 'Execute'),
        k('KC_ERAS', 'Alt Erase'),
      ],
    },
    {
      label: 'Ses (buzzer)',
      keys: [
        k('AU_ON', 'Ses açık'),
        k('AU_OFF', 'Ses kapalı'),
        k('AU_TOG', 'Ses aç/kapa'),
        k('CLICKY_TOGGLE', 'Tık sesi'),
        k('MU_ON', 'Müzik açık'),
        k('MU_OFF', 'Müzik kapalı'),
        k('MU_TOG', 'Müzik aç/kapa'),
        k('MU_MOD', 'Müzik modu'),
      ],
    },
  ],
};

const backlightKeys = [
  k('BL_TOGG', 'BL aç/kapa', 'Arka ışık aç/kapat'),
  k('BL_ON', 'BL açık'),
  k('BL_OFF', 'BL kapalı'),
  k('BL_DEC', 'BL −', 'Arka ışık azalt'),
  k('BL_INC', 'BL +', 'Arka ışık artır'),
  k('BL_STEP', 'BL döngü'),
  k('BL_BRTG', 'BL nefes', 'Nefes efekti aç/kapat'),
];

const legacyRgbKeys = [
  k('RGB_TOG', 'RGB aç/kapa'),
  k('RGB_MOD', 'Efekt +'),
  k('RGB_RMOD', 'Efekt −'),
  k('RGB_HUI', 'Renk +'),
  k('RGB_HUD', 'Renk −'),
  k('RGB_SAI', 'Doygunluk +'),
  k('RGB_SAD', 'Doygunluk −'),
  k('RGB_VAI', 'Parlaklık +'),
  k('RGB_VAD', 'Parlaklık −'),
  k('RGB_SPI', 'Hız +'),
  k('RGB_SPD', 'Hız −'),
  k('RGB_M_P', 'Sabit', 'Düz renk modu'),
  k('RGB_M_B', 'Nefes'),
  k('RGB_M_R', 'Gökkuşağı'),
  k('RGB_M_SW', 'Girdap'),
  k('RGB_M_SN', 'Yılan'),
  k('RGB_M_K', 'Knight'),
  k('RGB_M_X', 'Yılbaşı'),
  k('RGB_M_G', 'Gradyan'),
];

const underglowKeys = [
  k('UG_TOGG', 'Alt ışık aç/kapa'),
  k('UG_NEXT', 'Alt efekt +'),
  k('UG_PREV', 'Alt efekt −'),
  k('UG_HUEU', 'Alt renk +'),
  k('UG_HUED', 'Alt renk −'),
  k('UG_SATU', 'Alt doyg. +'),
  k('UG_SATD', 'Alt doyg. −'),
  k('UG_VALU', 'Alt parl. +'),
  k('UG_VALD', 'Alt parl. −'),
  k('UG_SPDU', 'Alt hız +'),
  k('UG_SPDD', 'Alt hız −'),
];

const rgbMatrixKeys = [
  k('RM_TOGG', 'RGB aç/kapa'),
  k('RM_NEXT', 'Efekt +'),
  k('RM_PREV', 'Efekt −'),
  k('RM_HUEU', 'Renk +'),
  k('RM_HUED', 'Renk −'),
  k('RM_SATU', 'Doygunluk +'),
  k('RM_SATD', 'Doygunluk −'),
  k('RM_VALU', 'Parlaklık +'),
  k('RM_VALD', 'Parlaklık −'),
  k('RM_SPDU', 'Hız +'),
  k('RM_SPDD', 'Hız −'),
];

export type LightingKeycodeSet = {backlight: boolean; legacyRgb: boolean; underglow: boolean; rgbMatrix: boolean};

export const buildLightingGroup = (set: LightingKeycodeSet): CatalogGroup | null => {
  const sections: CatalogSection[] = [];
  if (set.backlight) sections.push({label: 'Arka ışık', keys: backlightKeys});
  if (set.legacyRgb) sections.push({label: 'RGB', keys: legacyRgbKeys});
  if (set.underglow) sections.push({label: 'Alt ışık (underglow)', keys: underglowKeys});
  if (set.rgbMatrix) sections.push({label: 'RGB matris', keys: rgbMatrixKeys});
  return sections.length ? {id: 'lighting', label: 'Işık', sections} : null;
};

export type CustomKeycodeInfo = {name: string; title?: string; shortName?: string};

export const buildCustomGroup = (keycodes: CustomKeycodeInfo[] | undefined): CatalogGroup | null =>
  keycodes?.length
    ? {
        id: 'custom',
        label: 'Klavyeye özel',
        description: 'Üreticinin bu klavye için tanımladığı tuşlar.',
        sections: [
          {
            label: 'Üretici tuşları',
            keys: keycodes.map((kc, i) => k(`CUSTOM(${i})`, kc.shortName || kc.name, kc.title || kc.name)),
          },
        ],
      }
    : null;

export const staticGroups = {basic: basicGroup, media: mediaGroup, mouse: mouseGroup, special: specialGroup};

/** Index of every static catalog key by code for fast label lookup. */
export const catalogIndex: Map<string, CatalogKey> = new Map(
  [basicGroup, mediaGroup, mouseGroup, specialGroup, {id: 'l', label: '', sections: [{label: '', keys: [...backlightKeys, ...legacyRgbKeys, ...underglowKeys, ...rgbMatrixKeys]}]}]
    .flatMap((group) => group.sections)
    .flatMap((section) => section.keys)
    .map((key) => [key.code, key] as const),
);

/**
 * Characters reachable with Shift / AltGr on the computer's layout, as single
 * keycodes. On Turkish Q this is how @ { } [ ] | < > get onto their own keys.
 */
export const buildSymbolGroup = (host: HostLayout): CatalogGroup => {
  const seen = new Set<string>();
  const sections: CatalogSection[] = [
    {label: 'Shift ile', keys: []},
    {label: 'AltGr ile', keys: []},
    {label: 'Shift + AltGr ile', keys: []},
  ];
  const wrappers = ['S', 'RALT', 'RSA'];
  const modText = ['Shift', 'AltGr', 'Shift+AltGr'];
  for (const [key, output] of Object.entries(host.keys)) {
    output.slice(1).forEach((char, i) => {
      if (!char || seen.has(char)) return;
      // Capital letters are just Shift+letter: not worth a button.
      if (i === 0 && char.toLocaleLowerCase('tr-TR') !== char) return;
      seen.add(char);
      const keyName = host.keys[key][0] || key.replace(/^KC_/, '');
      const dead = isDeadStroke(host, key, i + 1) ? ' (ölü tuş: ardından boşluk gerekir)' : '';
      sections[i].keys.push(k(`${wrappers[i]}(${key})`, char, `${modText[i]}+${keyName.toLocaleUpperCase('tr-TR')} → ${char}${dead}`));
    });
  }
  return {
    id: 'symbols',
    label: `Semboller (${host.short})`,
    description: `${host.label} düzeninde Shift veya AltGr ile yazılan karakterler. Bir tuşa atayınca tek basışta o karakteri yazar.`,
    sections: sections.filter((s) => s.keys.length),
  };
};
