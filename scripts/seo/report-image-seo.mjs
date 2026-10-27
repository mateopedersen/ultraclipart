// Human-readable local evidence. Never copied to public/ or a production release.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { previewUrls } from '../preview-assets.mjs';
const root = resolve(import.meta.dirname, '../..'),
  out = join(root, 'reports/image-seo');
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const audit = json('reports/image-seo/audit.json');
const browser = json('reports/image-seo/browser/report.json');
const tooltips = json('reports/image-seo/image-information/report.json');
const live = json('reports/assets-indexing/live-audit.json');
const lighthouse = json('reports/image-seo/lighthouse/summary.json');
const changes = json('reports/image-seo/review/changes.json');
const art = json('data/art.json').filter((a) => a.published && a.indexable);
const reviews = json('data/image-metadata-reviews.json').artwork;
if (
  audit.errors.length ||
  browser.errors.length ||
  tooltips.failures.length ||
  browser.states.length !== 64
)
  throw Error('Do not publish a successful local report with incomplete or failed checks.');
const units = readFileSync(join(root, 'reports/image-seo-unit.log'), 'utf8').match(
  /pass (\d+)/,
)?.[1];
const unitFailures = readFileSync(join(root, 'reports/image-seo-unit.log'), 'utf8').match(
  /fail (\d+)/,
)?.[1];
if (!units || unitFailures !== '0') throw Error('Unit checks are missing or failed.');
const count = (n) => Number(n).toLocaleString('tr-TR');
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const stamp = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
const missingLive = live.images.notInLocalManifest.length;
const paragraphs = [
  'ULTRACLIPART — GÖRSEL SEO ÇALIŞMASI',
  `Rapor zamanı: ${stamp} (Türkiye). Durum: yalnızca yerel; canlıya yayın yapılmadı.`,
  `Kapsam: ${count(audit.htmlPages)} derlenmiş HTML sayfası; ${count(audit.eligibleArtwork)} yayımlanabilir katalog görseli. ${count(audit.indexablePages)} indekslenebilir ve ${count(audit.noindexPages)} noindex sayfa ayrı kontrol edildi.`,
  `Bu turda ${changes.length} orijinal görsel açılarak incelendi ve başlık/alt metin/açıklaması yenilendi. Önceki yerel turlarla birlikte kaynak özetiyle bağlı ${Object.keys(reviews).length} görsel incelemesi var. 12.152 resmin tamamı bu turda tek tek görsel olarak incelendi denilmiyor.`,
  `1. ORTAK METADATA: ImageObject şemaları tek kaynağa bağlandı. Görsele özgü ad, açıklama, caption, kalıcı kimlik, gerçek contentUrl, piksel ölçüleri, dosya türü, creator, creditText, copyrightNotice, license ve acquireLicensePage birlikte üretiliyor. Orijinal dosya ile görüntüleme kopyası ilişkili, farklı dosyalar olarak tanımlanıyor.`,
  `2. SAYFA GENELİ: Katalog resminin indekslenebilir bir sayfada kullanıldığı her yerde lisans metadatası HTML içine derleme sırasında yazılıyor. JavaScript çalışmasına bağlı değil. ${count(audit.licensedRenderedImages)} sayfa–görsel çifti için kapsam doğrulandı; toplam ${count(audit.imageSchemas)} ImageObject düğümü denetlendi. Aynı dosya bir sayfada birden çok kez kullanılıyorsa gereksiz şema kopyası eklenmiyor.`,
  `3. AÇIKLAMALAR: Mevcut ${count(art.length)} katalog kaydının başlık/alt/açıklama alanları boşluk, tutarlılık ve tekrar açısından denetlendi. Bu turdaki 28 incelemede fil, eldiven ve şekerleme resimlerindeki genel ifadeler, dil hataları ve yanıltıcı ayrıntılar düzeltildi. Yeni marka/model veya malzeme sertifikası uydurulmadı.`,
  `4. KORUNAN VERİLER: Orijinal indirme dosyaları, kimlikler, URL'ler, çözünürlükler ve dosya özetleri korundu. Görüntüleme için küçük, kaynak özetiyle bağlı WebP kopyaları ve srcset/sizes kullanılıyor. Tarayıcı testi orijinal dosyanın SHA-256 değerini de karşılaştırdı. Özel projeler, Favoriler, localStorage ve IndexedDB temizlenmedi.`,
  `5. TEKNİK DENETİM: ${count(audit.imageInstances)} img etiketi; ${count(audit.informativeImages)} anlamlı görsel açıklaması; ${count(audit.decorativeImages)} boş alt ile işaretli dekoratif kullanım kontrol edildi. ${count(audit.srcsetCandidates)} farklı boyutlu dosya bağlantısı ve ${count(audit.localImageSignatures || 0)} yerel dosyanın biçim imzası denetlendi. Eksik dosya, alt/title, ölçü, yanlış biçim, hatalı şema veya kaynak uyumsuzluğu: ${audit.errors.length}. Biçim imzası kontrolü bütün dosyanın görsel olarak incelenmesi anlamına gelmez.`,
  `6. KEŞİF: Görsel site haritasındaki ${count(audit.imageSitemapOriginals)} benzersiz orijinal dosya ve sayfa haritasındaki ${count(audit.pageSitemapEntries)} adres katalogla karşılaştırıldı. Arama, filtreler, Favoriler ve düzenleme alanları indekslenmeye açılmadı. Dekoratif ikonlara anahtar kelime doldurulmadı; portrelere ve rehber ekran görüntülerine katalog lisansı atanmadı.`,
  `7. KALICI KONTROL: Normal Astro derlemesi ortak şemayı üretir ve kapsamlı SEO denetimini çalıştırır; hata varsa yayın paketinden önce durur. Onaylı yeni içeriğin kendi metadata alanları tüm ortak gösterimlere otomatik taşınır. Bu sistem resimdeki nesnenin kimliğini kendiliğinden tahmin etmez; içerik incelemesinin yerini almaz. Bellek kullanımında HTML alt dizgelerinin tüm belgeleri tutmasına yol açan sorun giderildi; denetim ayrı işlemde çalışıyor.`,
  `8. GERÇEK TARAYICI: Chromium ve WebKit, 390 ve 1440 piksel, 16 sayfa türü/adres = ${browser.states.length} başarılı durum. Mobil aramadan güncellenen resme geçiş, orijinal indirme özeti ve JavaScript kapalı kullanım için ${browser.interactions.length} kontrol; açıklama balonları için ${tooltips.checks.length} ek etkileşim geçti. ${units} kaynak regresyon testi geçti. Bunlar fiziksel iPhone/Android testi değildir.`,
  `9. CANLI OKUMA: ${live.checks.length} salt okunur HTTP kontrolü yapıldı. Örneklenen ${live.summary.sampledFiles} canlı medya dosyası doğru durum/kullanım türüyle erişilebilir; dosya hatası ${live.summary.assetFailures.length}. assets.ultraclipart.com/robots.txt HTTP ${live.summary.robotsStatus} döndü. 404, Google açısından otomatik tarama engeli değildir; ancak açık robots politikası ve sitemap bağlantısı için hazırlanan ayrı kök dosya yayın bekliyor. Pages yayını bu R2 dosyasını kendiliğinden yüklemez.`,
  `10. YAYINDAN ÖNCE: Canlı görsel haritasında ${count(live.images.count)} dosya var; ${count(missingLive)} tanesi eski yerel yayın listesinde yok. Bu yeni görseller kaybedilmeden güncel katalogla birleştirme yapılmalı. Bu turda ne canlı dosyalar değiştirildi ne Google/Bing'e gönderim yapıldı. Yayın izniniz verilmediği için bu adımlar uygulanmadı.`,
  'SINIRLAR: Yerel HTML/şema kontrolleri ve örneklenmiş tarayıcı testleri tamamlandı. Google Rich Results Test ile dışarıdan yerel URL testi ve Search Console doğrulaması çalıştırılmadı. İndekslenme, sıralama artışı veya tüm sitenin PageSpeed puanının 100 olması garanti edilmez.',
  'KAYNAKLAR:',
  'https://developers.google.com/search/docs/appearance/google-images',
  'https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata',
  'https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps',
  'https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec',
];
paragraphs.splice(
  14,
  0,
  '11. ÖRNEK HIZ/SEO ÖLÇÜMÜ: ' +
    lighthouse
      .map(
        (r) =>
          `${r.path === '/' ? 'Ana sayfa' : 'Görsel sayfası'} ${r.device === 'mobile' ? 'mobil' : 'masaüstü'}: performans ${r.scores.performance}, erişilebilirlik ${r.scores.accessibility}, iyi uygulamalar ${r.scores['best-practices']}, SEO ${r.scores.seo}.`,
      )
      .join(' ') +
    ' Bu dört yerel Lighthouse ölçümüdür; bütün sayfaların PageSpeed sonucu veya canlı CrUX verisi değildir. Mobil performansın her sayfada 100 olduğu iddia edilmiyor.',
);
const csv = (values) =>
  values.map((s) => '"' + String(s ?? '').replaceAll('"', '""') + '"').join(',');
const changed = new Set(changes.map((r) => r.id));
writeFileSync(
  join(out, 'gorsel-envanteri.csv'),
  '\ufeff' +
    csv([
      'Görsel kimliği',
      'Başlık',
      'Alt metin',
      'Açıklama',
      'Genişlik',
      'Yükseklik',
      'Kaynak SHA-256',
      'Bu turda görsel inceleme',
      'Önceki yerel turda görsel inceleme',
    ]) +
    '\n' +
    art
      .map((a) =>
        csv([
          a.id,
          a.title,
          a.alt,
          a.description,
          a.width,
          a.height,
          a.files.webp.sha256,
          changed.has(a.id) ? 'Evet' : 'Hayır',
          reviews[a.id] && !changed.has(a.id) ? 'Evet' : 'Hayır',
        ]),
      )
      .join('\n'),
);
writeFileSync(join(out, 'rapor.txt'), paragraphs.join('\n\n') + '\n');
const cards = changes
  .map((change) => {
    const item = art.find((a) => a.id === change.id);
    return `<article class="review"><a href="/art/${encodeURIComponent(item.id)}/"><img src="${esc(previewUrls(item)[440])}" alt="${esc(item.alt)}" title="${esc(item.title)}" width="240" height="220" loading="lazy"></a><h3>${esc(item.title)}</h3><p class="label">Önceki alt metin</p><p>${esc(change.before.alt)}</p><p class="label">Düzeltilen alt metin</p><p>${esc(item.alt)}</p><details><summary>Kaynak ve açıklama</summary><p>${esc(item.description)}</p><code>${esc(change.sourceSha256)}</code></details></article>`;
  })
  .join('');
const evidence = '/__image-seo-evidence/';
const html = `<!doctype html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>UltraClipart — Türkçe Görsel SEO Raporu</title><style>
*{box-sizing:border-box}body{margin:0;background:#f2f6fc;color:#213b5b;font:16px/1.65 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:40px 24px 80px}header{background:linear-gradient(135deg,#123d70,#287dc1);color:#fff;padding:34px;border-radius:24px}h1{font-size:clamp(28px,4vw,42px);line-height:1.15;margin:8px 0 18px}h2{font-size:25px;line-height:1.3}h3{line-height:1.35}a{color:#155fa8;text-underline-offset:3px}header a{color:#fff}.badge{display:inline-block;background:#fff;color:#145289;padding:5px 14px;border-radius:100px;font-weight:750}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:24px 0}.stats div,section,.review{background:#fff;border:1px solid #d5e1ee;border-radius:18px;padding:24px}.stats strong{display:block;font-size:30px;line-height:1.2;color:#17528d}.stats span{font-size:14px}.notice{border-left:5px solid #bd7a00;background:#fff7e4;padding:18px 22px;border-radius:14px;margin:24px 0}section{margin:24px 0}.downloads{display:flex;flex-wrap:wrap;gap:12px}.downloads a{background:#eaf3ff;padding:12px 17px;border-radius:12px;font-weight:650}.copy p{margin:0 0 22px}.reviews{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.review{min-width:0;box-shadow:0 5px 16px #18385708}.review img{display:block;width:100%;height:210px;object-fit:contain}.review h3{margin-top:18px}.review p{font-size:14px}.label{color:#326796;font-weight:750;font-size:12px!important;letter-spacing:.03em;text-transform:uppercase;margin-bottom:4px}code{font-size:11px;overflow-wrap:anywhere}summary{cursor:pointer}footer{margin-top:35px;font-size:14px;color:#526c87}@media(max-width:760px){main{padding:20px 14px 60px}header{padding:24px}.stats{grid-template-columns:repeat(2,1fr)}.reviews{grid-template-columns:repeat(2,minmax(0,1fr))}.review{padding:16px}}@media(max-width:460px){.reviews{grid-template-columns:1fr}.review img{height:235px}section{padding:20px}.stats strong{font-size:25px}}
</style></head><body><main><header><span class="badge">Yalnızca yerel • Yayın yapılmadı</span><h1>Görsellerin kendi kimliği.<br>Site genelinde tutarlı metadata.</h1><p>UltraClipart görsel SEO denetimi, düzeltmeler ve doğrulanmış sonuçlar.</p><small>${esc(stamp)} • Türkiye saati</small></header><div class="stats"><div><strong>${count(audit.htmlPages)}</strong><span>HTML sayfası denetlendi</span></div><div><strong>${count(art.length)}</strong><span>Katalog görseli kontrol edildi</span></div><div><strong>${browser.states.length}</strong><span>Tarayıcı durumu geçti</span></div><div><strong>0</strong><span>Yerel teknik denetim hatası</span></div></div><aside class="notice"><strong>Canlıya aktarım öncesinde:</strong> Güncel canlı katalogda yerel listede olmayan ${count(missingLive)} görsel var. Bunlar korunarak birleştirme yapılmalı. Görsel sunucusunun robots.txt dosyası için hazırlanan düzeltme de yayın bekliyor.</aside><section><h2>İndirilebilir tam kayıtlar</h2><div class="downloads"><a href="${evidence}rapor.txt">Türkçe rapor</a><a href="${evidence}sayfa-denetimi.csv">${count(audit.htmlPages)} sayfanın dökümü</a><a href="${evidence}gorsel-envanteri.csv">${count(art.length)} görselin metadata kaydı</a><a href="${evidence}browser/report.json">Tarayıcı kanıtı</a><a href="${evidence}audit.json">Teknik kontrol sonuçları</a></div></section><section class="copy"><h2>Yapılanlar ve testlerin kapsamı</h2>${paragraphs
  .slice(2, paragraphs.indexOf('KAYNAKLAR:'))
  .map((p) => `<p>${esc(p)}</p>`)
  .join(
    '',
  )}</section><section><h2>Bu turda incelenen 28 görsel: önce ve sonra</h2><p>Görseller kaynak dosyaları açılarak incelendi. Metadata incelemesi orijinal dosyanın SHA-256 özetiyle bağlıdır; dosya veya onaylı metin değişirse mevcut inceleme geçersiz olur.</p></section><div class="reviews">${cards}</div><section><h2>Google'ın birincil kaynakları</h2><ul>${paragraphs
  .slice(-4)
  .map((url) => `<li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a></li>`)
  .join(
    '',
  )}</ul></section><footer>Bu rapor yerel teşhis alanındadır; üretim sayfalarına ve site haritalarına eklenmez. Kapsamlı otomatik kontrol, her resmin bu turda görsel olarak incelendiği anlamına gelmez.</footer></main></body></html>`;
writeFileSync(join(out, 'rapor.html'), html);
console.log('Türkçe görsel SEO raporu ve iki CSV kayıt dosyası hazır.');
