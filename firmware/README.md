# Firmware: wilba.tech WT60-H1, fare tuşları açık

WT60-H1’in standart QMK firmware’inde fare tuşları (Mouse keys) kapalıdır. Klavye Stüdyo’da Fare sekmesinden atanan tuşlar klavyeye yazılır ama hiçbir şey yapmaz. Buradaki firmware aynı VIA firmware’idir, yalnızca fare tuşları açıktır.

- **USB kimliği aynı** (6582:0024): VIA ve Klavye Stüdyo klavyeyi yine tanır.
- **VIA protokolü 13**, firmware sürümü `0x4B530001` (Klavye Stüdyo bu işaretten fare tuşlarının açık olduğunu anlar ve uyarıyı göstermez).
- **Boyut:** 19 804 / 28 672 bayt.

| Dosya | Ne için | SHA-256 |
| --- | --- | --- |
| [`wilba_tech_wt60_h1_via_mousekey.hex`](../public/firmware/wilba_tech_wt60_h1_via_mousekey.hex) | Fare tuşları açık | `3dea77ee5a8b6c252b86fb37b03946cf7824db7b1df936a0fba3e86a9538cad9` |
| [`wilba_tech_wt60_h1_via_stock.hex`](../public/firmware/wilba_tech_wt60_h1_via_stock.hex) | Aynı kaynak, fare tuşları kapalı (geri dönmek için) | `4ab3486dd3300dfbbda7a80544e632b90c13a20ecac00a866c3f8e294cd69244` |

Dosyalar siteden de indirilebilir: `https://ozgunbakici.github.io/keyboard-studio/firmware/wilba_tech_wt60_h1_via_mousekey.hex`

## Yüklemeden önce

Firmware yüklemek klavyedeki tuş haritasını ve makroları sıfırlar. Önce yedek al:

1. Klavye Stüdyo’yu aç, WT60-H1’i bağla.
2. **Yedekler → Şimdi yedekle.** Yedek tuş adlarıyla tutulur; yeni firmware’e sorunsuz geri yüklenir.

## Yükleme (QMK Toolbox)

1. [QMK Toolbox](https://github.com/qmk/qmk_toolbox/releases)’ı indir ve kur. Windows’ta ilk açılışta sürücü kurmayı kabul et; sormazsa **Tools → Install Drivers**.
2. QMK Toolbox’ta **Open** ile `wilba_tech_wt60_h1_via_mousekey.hex` dosyasını seç. MCU **atmega32u4** olmalı.
3. Klavyeyi yükleme moduna al: kabloyu çıkar, **sol üstteki Esc tuşuna basılı tutarken kabloyu tak**. Olmazsa PCB’nin arkasındaki **RESET** düğmesine bas. QMK Toolbox’ta sarı renkte *Atmel DFU device connected* yazar.
4. **Flash**’a bas. *Flash complete* yazınca klavye yeniden başlar.

## Yükledikten sonra

1. Klavye Stüdyo’da klavyeyi yeniden bağla (gerekirse sayfayı yenile).
2. **Yedekler**’den az önce aldığın yedeği geri yükle.
3. Tuş haritasında Fare sekmesindeki uyarı artık görünmez; fare tuşlarını atayıp dene. Genelde bir katmana konur ve o katman bir MO tuşuyla açılır.

Bir şey ters giderse: yükleyici (bootloader) ayrı bir bölümdedir, firmware yüklemek klavyeyi bozmaz. Aynı adımlarla yeniden yükleyebilir ya da `_stock.hex` ile eski hâle dönebilirsin.

## Kaynak ve yeniden derleme

- QMK: [`qmk/qmk_firmware`](https://github.com/qmk/qmk_firmware) `f5db9621` (2026-10-29), klavye `wilba_tech/wt60_h1`.
- VIA tuş haritası: [`the-via/qmk_userspace_via`](https://github.com/the-via/qmk_userspace_via) `3e440ab`, `keyboards/wilba_tech/wt60_h1/keymaps/via/keymap.c` (değiştirilmedi).
- Değişiklikler [`wt60_h1_via/`](wt60_h1_via) klasöründe: `rules.mk`’de `MOUSEKEY_ENABLE = yes`, `config.h`’de `VIA_FIRMWARE_VERSION 0x4B530001`.

```sh
# QMK kurulumundan sonra
cp -r <qmk_userspace_via>/keyboards/wilba_tech/wt60_h1/keymaps/via keyboards/wilba_tech/wt60_h1/keymaps/
cp firmware/wt60_h1_via/rules.mk firmware/wt60_h1_via/config.h keyboards/wilba_tech/wt60_h1/keymaps/via/
make wilba_tech/wt60_h1:via
```

QMK ve VIA tuş haritası GPL-2.0-or-later lisanslıdır; bu firmware de öyledir.
