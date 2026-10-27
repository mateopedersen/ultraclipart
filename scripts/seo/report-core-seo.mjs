import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = join(root, 'reports/seo-final');
const audit = JSON.parse(readFileSync(join(out, 'audit.json'), 'utf8'));
const pages = JSON.parse(readFileSync(join(out, 'pages.json'), 'utf8'));
const browserFile = join(out, 'browser/report.json');
const browser = existsSync(browserFile) ? JSON.parse(readFileSync(browserFile, 'utf8')) : null;
const browserProof =
  browser?.release === audit.buildDirectory
    ? `${browser.checks.length} tarayıcı kontrolü, ${browser.errors.length} hata. Chromium/WebKit; mobil ve masaüstü; JavaScript açık ve kapalı. Yerel üretim CSP kural seti uygulandı.`
    : 'Bu derlemeyle eşleşen tarayıcı kanıtı henüz kaydedilmedi.';
const readOptional = (file) =>
  existsSync(join(out, file)) ? JSON.parse(readFileSync(join(out, file), 'utf8')) : null;
const unit = readOptional('unit-results.json'),
  xml = readOptional('xml-http.json');
const otherProof =
  unit?.release === audit.buildDirectory && xml?.release === audit.buildDirectory
    ? `${unit.passed}/${unit.tests} birim kontrolü geçti; ${unit.failed} hata. XML haritaları bağımsız okuyucuyla ayrıştırıldı; HTTP durumları, dosya türleri ve PNG/ICO dosyaları kontrol edildi.`
    : 'Bu derlemeyle eşleşen birim veya XML doğrulama kaydı henüz kaydedilmedi.';
const esc = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
const count = (number) => number.toLocaleString('tr-TR');
const cell = (value) =>
  '"' +
  (/^[=+@-]/.test(String(value)) ? "'" : '') +
  String(value ?? '').replaceAll('"', '""') +
  '"';
writeFileSync(
  join(out, 'sayfalar.csv'),
  '\uFEFF' +
    [
      ['Sayfa', 'Başlık', 'Açıklama', 'Canonical', 'İndeksleme', 'Hata Sayısı'],
      ...pages.map((page) => [
        page.page,
        page.title,
        page.description,
        page.canonical,
        page.noindex ? 'noindex' : 'index',
        page.errors,
      ]),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n'),
);
const body = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>UltraClipart · Son SEO Raporu</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f3f7fd;color:#173455;font:16px/1.6 system-ui,sans-serif}main{max-width:1180px;margin:auto;padding:24px}h1{font-size:clamp(28px,5vw,44px);line-height:1.2}h2{font-size:24px;color:#1464d4}section{background:#fff;border:1px solid #cedef1;border-radius:18px;padding:24px;margin-block:20px}a{color:#1260d8}li{margin-block:8px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.stat{padding:16px;background:#edf4ff;border-radius:12px}.stat strong{display:block;font-size:28px}code{overflow-wrap:anywhere}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid #dce7f5;padding:12px;text-align:left;vertical-align:top}th{background:#edf4ff}input,select,button{font:inherit;padding:10px;border:1px solid #b8cfe9;border-radius:9px;max-width:100%}.controls{display:flex;gap:12px;flex-wrap:wrap}.muted,small{color:#526c89}small{display:block}.notice{border-left:5px solid #1260d8;padding-left:18px}</style>
<main><p><a href="http://127.0.0.1:4326/">Son yerel site</a> · <a href="/__performance-report/">Hız ve Studio raporu</a></p><h1>UltraClipart<br>Son Teknik SEO Raporu</h1>
<p class="notice"><strong>Yerel çalışma; yayın yapılmadı.</strong> Bu rapor ${esc(audit.date)} tarihinde denetlenen derlemeye aittir. Canlıya dağıtım ve Search Console/Bing gönderimi yapılmadı.</p><p><code>${esc(audit.buildDirectory.split('/').pop())}</code></p>
<section><h2>Denetim sonucu</h2><div class="stats">${[
  ['HTML sayfası', audit.htmlPages],
  ['İndekslenebilir sayfa', audit.indexablePages],
  ['Bilinçli noindex', audit.noindexPages],
  ['Teknik hata', audit.errors.length],
  ['Aynı başlık incelemesi', audit.duplicateTitleReview.length],
]
  .map(([label, value]) => `<div class="stat"><strong>${count(value)}</strong>${label}</div>`)
  .join(
    '',
  )}</div><p>Her derlenmiş HTML sayfasında başlık, açıklama, ana başlık, dil, canonical, indeksleme politikası, sosyal etiketler ve JSON-LD kontrol edildi. Site haritası üyeliği de karşılaştırıldı. Bu, tüm görsellerin yeniden gözle incelendiği veya Google tarafından indekslendiği anlamına gelmez.</p><p><a href="/__seo-evidence/audit.json">Ham denetim</a> · <a href="/__seo-evidence/sayfalar.csv">Tüm sayfaları indir (CSV)</a> · <a href="/__seo-evidence/before/audit.json">Düzeltme öncesi denetim</a></p></section>
<section><h2>Uygulanan ortak düzenlemeler</h2><ul><li>Mevcut U logosundan kare 96/192 PNG, kare SVG, 16/32/48 ICO ve 180 piksel Apple simgesi üretildi. Kaynak logo korunur; yeni derlemeler bunları otomatik hazırlar. <a href="https://developers.google.com/search/docs/appearance/favicon-in-search">Google favicon rehberi</a>.</li><li>Organization, WebSite ve WebPage verileri tutarlı kimliklerle bağlandı. Katalog görsellerinin mevcut kurum oluşturucusu aynı kimliği kullanır. Gerçek kişi yazarlığı, ödül, adres veya uzmanlık uydurulmadı. <a href="https://developers.google.com/search/docs/appearance/site-names">Google site adı rehberi</a>.</li><li>Sayfa ve görsel haritaları onaylı katalogdan otomatik üretilir. Büyümede 50.000 URL veya 50 MiB sınırında bölünür; ilk dosya adresleri korunur. Güvenilir değişiklik tarihi bulunmadığında sahte lastmod tarihi yazılmaz. <a href="https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap">Google site haritası rehberi</a>.</li><li>Arama, düzenleyiciler, Favorites ve mevcut indeks dışı gezinme sayfaları site haritasına eklenmedi. Canonical adreslerde sorgu ve parçacık bulunmaması doğrulandı. <a href="https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag">Google robots etiketleri</a>.</li><li>Başlık ve açıklamalar sayfaya özgü kaldı. Kontrol, keyfî bir karakter veya kelime sayısını sıralama garantisi olarak kullanmaz. <a href="https://developers.google.com/search/docs/appearance/title-link">Google başlık rehberi</a>.</li><li>Mevcut görsele özgü alt, title, ImageObject, lisans, creator ve copyrightNotice alanları ortak denetimlerle korunur. Yeni içerik aynı kaynak ve dosya özeti kontrollerinden geçer. <a href="https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata">Google görsel metaverisi</a>.</li></ul></section>
<section><h2>Gerçek doğrulamalar</h2><p>${browserProof}</p><p>${otherProof}</p><p><a href="/__seo-evidence/browser/report.json">Tarayıcı kayıtları</a> · <a href="/__seo-evidence/xml-http.json">XML ve HTTP kanıtı</a> · <a href="/__seo-evidence/unit-results.json">Birim kontrolleri</a></p></section><section><h2>Site haritaları</h2><p><a href="http://127.0.0.1:4326/sitemap.xml">Yerel sitemap.xml</a> · Yayından sonra kullanılacak adres: <a href="https://ultraclipart.com/sitemap.xml">https://ultraclipart.com/sitemap.xml</a></p><div class="scroll"><table><thead><tr><th>Dosya</th><th>İçerik</th><th>URL</th><th>Bayt</th></tr></thead><tbody>${audit.sitemaps.map((sitemap) => `<tr><td>${esc(new URL(sitemap.url).pathname)}</td><td>${sitemap.image ? 'Asıl görseller' : 'Canonical sayfalar'}</td><td>${count(sitemap.urls)}</td><td>${count(sitemap.bytes)}</td></tr>`).join('')}</tbody></table></div><p>Görsel haritası asıl dosyaları gösterir. Küçük ekran kopyaları asıl indirme dosyasının yerine geçirilmedi.</p></section>
<section><h2>Sayfa bazında sonuçlar</h2><div class="controls"><input id="query" aria-label="Sayfa veya başlık ara" placeholder="Sayfa veya başlık ara"><select id="policy" aria-label="İndeksleme"><option value="">Tüm sayfalar</option><option value="index">İndekslenebilir</option><option value="noindex">Noindex</option></select><button id="previous">Önceki</button><button id="next">Sonraki</button></div><p id="status">Sayfa kaydı yükleniyor.</p><div class="scroll"><table><thead><tr><th>Sayfa</th><th>Başlık / Açıklama</th><th>İndeksleme</th><th>Hata</th></tr></thead><tbody id="rows"></tbody></table></div></section>
<section><h2>Yayın ve içerik sınırları</h2><p>Teknik yerel denetim, Google'ın sıralama veya indeksleme kararı değildir. Canlı Rich Results ve Search Console URL Inspection testleri bu yerel aşamada yapılmadı.</p><p>Yerel katalog, daha önce canlıda saptanan 752 yeni görseli içermiyor. Kullanıcı uzak katalog eşleştirmesini erteledi. İleride yayın yapılmadan önce güncel envanter korunarak eşleştirme gerekir. Hazırlanmış assets robots.txt dosyası bu çalışmada R2'ye yayımlanmadı.</p><p>Mevcut görsel kimlikleri korunmuştur; otomatik teknik kontrol, bütün kataloğun yeni bir görsel incelemesi değildir. Marka/model içeren yeni görseller kaynak görüntü ve resmî kaynak doğrulaması gerektirir.</p></section></main>
<script>let data=[],offset=0;const size=100,$=id=>document.getElementById(id);const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));function paint(){const query=$('query').value.toLocaleLowerCase('en-US'),policy=$('policy').value;const rows=data.filter(p=>(!query||(p.page+' '+p.title).toLocaleLowerCase('en-US').includes(query))&&(!policy||(p.noindex?'noindex':'index')===policy));offset=Math.min(offset,Math.max(0,Math.floor((rows.length-1)/size)*size));$('status').textContent=rows.length+' kayıttan '+(rows.length?offset+1:0)+'–'+Math.min(offset+size,rows.length);$('previous').disabled=offset===0;$('next').disabled=offset+size>=rows.length;$('rows').innerHTML=rows.slice(offset,offset+size).map(p=>'<tr><td>'+esc(p.page)+'<small>'+esc(p.canonical)+'</small></td><td>'+esc(p.title)+'<small>'+esc(p.description)+'</small></td><td>'+(p.noindex?'noindex':'index')+'</td><td>'+p.errors+'</td></tr>').join('');}for(const id of ['query','policy'])$(id).addEventListener('input',()=>{offset=0;paint()});$('previous').onclick=()=>{offset=Math.max(0,offset-size);paint()};$('next').onclick=()=>{offset+=size;paint()};fetch('/__seo-evidence/pages.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(rows=>{data=rows;paint()}).catch(e=>$('status').textContent='Kayıt açılamadı: '+e.message);</script></html>`;
writeFileSync(join(out, 'rapor.html'), body);
console.log(join(out, 'rapor.html'));
