# Klavye Stüdyo

Tarayıcıda çalışan, VIA uyumlu kişisel klavye yapılandırıcısı. Klavyeye USB üzerinden (WebHID) bağlanır; tuş haritası, katmanlar, knob, ışıklar ve makrolar doğrudan klavyenin hafızasına yazılır. Firmware’e dokunulmaz, ayarlar klavyede kalır.

Türkçe kullanım için tasarlandı: tuş etiketleri bilgisayardaki düzene göre (Türkçe Q, Türkçe F, US) gösterilir ve makro metinleri o düzene göre doğru tuş basımlarına çevrilir. VIA’da `ad@gmail.com` makrosu Türkçe Q’da `ad'gmaılçcom` yazar; burada birebir `ad@gmail.com` yazar.

## Neler var

- **Bağlantı:** VIA protokolü 9–13, birden çok klavye, izin verilmiş klavyelere otomatik yeniden bağlanma, seçilen klavyenin ışıklarını yakıp söndürme.
- **Klavye tanımları:** VIA’nın 2000’den fazla tanımı uygulamayla gelir. Listede olmayan klavyeler (birçok Neo / QK modeli) için üreticinin JSON dosyası bir kez yüklenir ve kalıcı olarak saklanır.
- **Tuş haritası:** Katmanlar, layout seçenekleri (bölünmüş backspace, ISO shift…), knob (encoder) dönüşleri, geri al / yinele, katman kopyalama ve temizleme, firmware varsayılanına dönüş.
- **Tuş seçici:** Türkçe kategoriler ve arama, “tuşa basarak seç”, bilgisayarın düzenine göre **Semboller** (Türkçe Q’da `@ { } [ ] | < >` gibi AltGr karakterleri tek tuşa atanabilir; ANSI klavyedeki eksik `< >` sorunu böyle çözülür), gelişmiş tuşlar (kısayol, dokun/tut mod-tap ve layer-tap, tek seferlik değiştirici, katman+değiştirici, serbest ifade).
- **Makrolar:** Metin modu (Türkçe karakterler otomatik çevrilir) ve adım modu (kısayol, tuş, bekleme, basılı tut/bırak); hafıza ölçer; ekranda ne yazılacağının önizlemesi; deneme alanı.
- **Işık ve ayarlar:** VIA menüleri (parlaklık, efekt, hız, renk, açma/kapama, açılır liste, koşullu alanlar).
- **Tuş testi:** Matris okuması (firmware izin veriyorsa) veya bilgisayar tuş olaylarıyla.
- **Yedekler:** Bağlanınca otomatik yedek, elle yedek, geri yükleme, VIA `.layout.json` içe/dışa aktarma.
- **Demo klavye:** Donanım olmadan her özelliği deneyen sanal VIA klavyesi.

### Eylem kütüphanesi (Faz 2)

Bir işi bir kez tanımla, istediğin klavyenin istediğin tuşuna ata. Eylemler tarayıcıda saklanır, makro slotu sayısıyla sınırlı değildir.

- **Türler:** kısayol, metin, adım dizisi (tuş / kısayol / bekleme), uygulama aç, komut çalıştır, web adresi aç. 19 hazır eylemle başlanabilir (Kopyala, Ekran görüntüsü, VS Code, Python `main` bloğu…).
- **Windows ve macOS sürümleri:** Bir eylemin her sistem için ayrı içeriği olabilir (Windows’ta Ctrl+C, Mac’te ⌘C). Klavye bu uygulama açıkken bir bilgisayara bağlanınca, atanmış tuşlar o bilgisayarın sistemine göre yeniden yazılır. Klavye en son hangi bilgisayarda eşitlendiyse onun sürümüyle kalır.
- **En ucuz yol seçilir:** Kısayollar tek tuş koduna dönüşür, makro hafızası harcamaz. Metin ve adım dizileri klavyenin makro hafızasına yazılır (boş slotlar sondan kullanılır, senin makrolarına dokunulmaz). Klavyenin kendisi yapamayan işler yardımcı programa gider.
- **Yardımcı programlar:** Uygulama açma, komut çalıştırma, web adresi ve US düzeninde yazılamayan harfler (ş, ğ, ı…) için klavye Ctrl+Alt+Shift+F13 gibi kimsenin kullanmadığı bir kombinasyon gönderir. Uygulama bunun için Windows’ta **AutoHotkey v2** (`klavye-studio.ahk`), Mac’te **Hammerspoon** (`klavye-studio.lua`) dosyası üretir. Yardımcıyı yalnızca istediğin bilgisayarlara kurman yeterli; kurulu olmayan bilgisayarda bu tuşlar hiçbir şey yapmaz. İndirilen dosya eskidiğinde uygulama uyarır.
- **Dışa / içe aktarma:** Kütüphane tek bir JSON dosyası olarak başka tarayıcıya taşınabilir.

### Yazı antrenmanı (Faz 3)

Hız, doğruluk ve 10 parmak için; US düzeninde (Windows ve Mac) yazmaya göre tasarlandı.

- **10 parmak dersleri:** 24 aşamalı ders: ana sıra, üst ve alt sıra, Shift, noktalama, rakamlar ve kod sembolleri. Her derste yalnızca öğrenilmiş tuşlarla gerçek kelimeler ve alıştırmalar üretilir. Ekrandaki ISO klavye parmak renkleriyle sıradaki tuşu ve hangi parmakla (gerekirse hangi Shift ile) basılacağını gösterir. Derslerde yanlış tuşta imleç bekler; doğruluk ve hedef hıza göre 0–3 yıldız verilir.
- **Pratik:** Türkçe ve İngilizce kelime ve cümleler (Türkçe karakterler isteğe bağlı: kapalıyken ç ğ ı ö ş ü yerine c g i o s u), kod sembolleri, rakamlar.
- **Kitaplardan:** Telif süresi dolmuş eserlerden alıntılar, yazar ve eser künyesiyle: Sabahattin Ali, Orhan Veli, Ahmet Haşim, Yunus Emre, Nasreddin Hoca fıkraları; Austen, Dickens, Carroll, Twain, Doyle, Wilde, Wells ve diğerleri.
- **Kendi metinlerim:** Elindeki bir kitaptan bölüm ya da makale yapıştır; uzun metin cümle sonlarından bölümlere ayrılır, her metinde kaldığın yer saklanır. Birden çok metin tutulabilir.
- **Python’u yazarak öğren:** Değişkenlerden sınıflara, dataclass’a ve küçük bir projeye 20 açıklamalı ders. **Java:** 12 parça (stream, record, switch, Optional…). Kodda satır başı girintisi Enter’dan sonra kendiliğinden gelir.
- **Hız testi:** 15 / 30 / 60 / 120 saniye, Türkçe veya İngilizce, isteğe bağlı noktalama ve rakam. Sonuçta saniye saniye hız grafiği.
- **İstatistik:** Son testlerin ortalaması ve gidişatı, hız ve doğruluk grafikleri, bağlı klavyenin kendi dizilimi üzerinde hata ısı haritası, en çok zorlandığın tuşlar ve onlara özel alıştırma.

## Kullanım

Chrome, Edge ya da başka bir Chromium tabanlı tarayıcı gerekir (WebHID; Firefox ve Safari desteklemiyor). Klavyeyi kabloyla bağla, usevia.app açıksa kapat.

**Telefonda:** Arayüz telefona uyumludur. Klavye ayarı için gereken WebHID telefon tarayıcılarında olmadığından ayar kısmı bilgisayarda kullanılır; yazı antrenmanı (telefona USB ya da Bluetooth ile bağlı klavyeyle veya ekran klavyesiyle), demo klavye ve eylem kütüphanesi telefonda da çalışır. Veriler her cihazın tarayıcısında ayrı tutulur.

Linux’ta tarayıcının hidraw cihazlarına erişebilmesi için:

```sh
echo 'KERNEL=="hidraw*", SUBSYSTEM=="hidraw", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/70-klavye-studio.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

## Geliştirme

```sh
npm install
npm run definitions   # VIA tanım paketini derler (the-via/keyboards klonlanır)
npm run dev           # http://localhost:5173
npm test              # birim testleri (protokol, keycode, makro çevirisi…)
npm run e2e           # demo klavyeyle uçtan uca testler (Playwright)
```

Kod yapısı:

| Klasör | İçerik |
| --- | --- |
| `src/via` | WebHID taşıyıcı, komut kuyruğu, VIA API, makro bayt formatı |
| `src/emulator` | Protokolü konuşan sanal klavye ve demo tanımı |
| `src/keycodes` | Protokole göre keycode tabloları, çözümleyici, Türkçe katalog, bilgisayar düzenleri |
| `src/definitions` | Tanım okuma, KLE geometrisi, layout seçenekleri, menüler |
| `src/macros` | Metin ↔ tuş basımı çevirisi (US, US-Mac, TR-Q, TR-F) |
| `src/library` | Eylem kütüphanesi: işletim sistemine göre teslim, eşitleme planı, tetikleyiciler, yardımcı dosya üretimi |
| `src/typing` | Yazı antrenmanı: yazma motoru, dersler, parmak haritası, içerik, istatistikler |
| `src/state` | Uygulama durumu, klavye işlemleri, yedek formatı |
| `src/ui` | Arayüz |

## Yayın

`.github/workflows/deploy.yml` her `main` gönderiminde testleri çalıştırır, tanım paketini derler ve GitHub Pages’e yayınlar (haftada bir de tanımları tazeler). Repo ayarlarında **Settings → Pages → Source: GitHub Actions** seçilmeli.

## Yol haritası

- **Faz 2 – Eylem kütüphanesi:** ✓ Kütüphane, Windows/macOS sürümleri, bağlanınca eşitleme, AutoHotkey ve Hammerspoon dosyaları. Sırada: makro kaydı, uygulama açık değilken de işletim sistemine göre çalışan katman seçeneği.
- **Faz 3 – Yazı antrenmanı:** ✓ 10 parmak dersleri, Türkçe/İngilizce metinler, Python ve Java, hız testi, ısı haritası, istatistikler.
- **Faz 4:** Bilgisayarlar arası senkron, tuş başına RGB, custom firmware (OS algılama) denemeleri.

## Lisans

GPL-3.0-or-later. VIA’nın keycode tabloları, tanım okuyucusu (`@the-via/reader`) ve tanım paketi (`the-via/keyboards`) GPL-3.0 lisanslıdır.
