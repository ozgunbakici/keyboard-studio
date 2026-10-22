# Klavye Stüdyo

Tarayıcıda çalışan, VIA uyumlu kişisel klavye yapılandırıcısı. Klavyeye USB üzerinden (WebHID) bağlanır; tuş haritası, katmanlar, knob, ışıklar ve makrolar doğrudan klavyenin hafızasına yazılır. Firmware’e dokunulmaz, ayarlar klavyede kalır.

Türkçe kullanım için tasarlandı: tuş etiketleri bilgisayardaki düzene göre (Türkçe Q, Türkçe F, US) gösterilir ve makro metinleri o düzene göre doğru tuş basımlarına çevrilir. VIA’da `ad@gmail.com` makrosu Türkçe Q’da `ad'gmaılçcom` yazar; burada birebir `ad@gmail.com` yazar.

## Neler var (Faz 1)

- **Bağlantı:** VIA protokolü 9–13, birden çok klavye, izin verilmiş klavyelere otomatik yeniden bağlanma, seçilen klavyenin ışıklarını yakıp söndürme.
- **Klavye tanımları:** VIA’nın 2000’den fazla tanımı uygulamayla gelir. Listede olmayan klavyeler (birçok Neo / QK modeli) için üreticinin JSON dosyası bir kez yüklenir ve kalıcı olarak saklanır.
- **Tuş haritası:** Katmanlar, layout seçenekleri (bölünmüş backspace, ISO shift…), knob (encoder) dönüşleri, geri al / yinele, katman kopyalama ve temizleme, firmware varsayılanına dönüş.
- **Tuş seçici:** Türkçe kategoriler ve arama, “tuşa basarak seç”, bilgisayarın düzenine göre **Semboller** (Türkçe Q’da `@ { } [ ] | < >` gibi AltGr karakterleri tek tuşa atanabilir; ANSI klavyedeki eksik `< >` sorunu böyle çözülür), gelişmiş tuşlar (kısayol, dokun/tut mod-tap ve layer-tap, tek seferlik değiştirici, katman+değiştirici, serbest ifade).
- **Makrolar:** Metin modu (Türkçe karakterler otomatik çevrilir) ve adım modu (kısayol, tuş, bekleme, basılı tut/bırak); hafıza ölçer; ekranda ne yazılacağının önizlemesi; deneme alanı.
- **Işık ve ayarlar:** VIA menüleri (parlaklık, efekt, hız, renk, açma/kapama, açılır liste, koşullu alanlar).
- **Tuş testi:** Matris okuması (firmware izin veriyorsa) veya bilgisayar tuş olaylarıyla.
- **Yedekler:** Bağlanınca otomatik yedek, elle yedek, geri yükleme, VIA `.layout.json` içe/dışa aktarma.
- **Demo klavye:** Donanım olmadan her özelliği deneyen sanal VIA klavyesi.

## Kullanım

Chrome, Edge ya da başka bir Chromium tabanlı tarayıcı gerekir (WebHID; Firefox ve Safari desteklemiyor). Klavyeyi kabloyla bağla, usevia.app açıksa kapat.

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
| `src/macros` | Metin ↔ tuş basımı çevirisi (TR-Q / TR-F / US) |
| `src/state` | Uygulama durumu, klavye işlemleri, yedek formatı |
| `src/ui` | Arayüz |

## Yayın

`.github/workflows/deploy.yml` her `main` gönderiminde testleri çalıştırır, tanım paketini derler ve GitHub Pages’e yayınlar (haftada bir de tanımları tazeler). Repo ayarlarında **Settings → Pages → Source: GitHub Actions** seçilmeli.

## Yol haritası

- **Faz 2 – Makrolar:** Sınırsız makro kütüphanesi, profiller, işletim sistemine göre makro sürümleri (Mac/Windows katmanı + bağlanınca eşitleme), makro kaydı, macOS Türkçe düzen tabloları, uygulama açma / script çalıştırma için AutoHotkey ve Hammerspoon ayar dosyası üretimi.
- **Faz 3 – Yazı antrenmanı:** 10 parmak dersleri, Türkçe/İngilizce metinler, bolca kod pratiği, sembol alıştırmaları, kendi klavyende ısı haritası, istatistikler.
- **Faz 4:** Bilgisayarlar arası senkron, tuş başına RGB, custom firmware (OS algılama) denemeleri.

## Lisans

GPL-3.0-or-later. VIA’nın keycode tabloları, tanım okuyucusu (`@the-via/reader`) ve tanım paketi (`the-via/keyboards`) GPL-3.0 lisanslıdır.
