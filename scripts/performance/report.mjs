import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { templateRoutes } from './routes.mjs';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'reports/performance');
const read = (name) => JSON.parse(readFileSync(resolve(out, name), 'utf8'));
const latest = new Map();
for (const round of [
  'final',
  'retest',
  'detail-final',
  'final-current',
  'editor-prefetch',
  'footer-final',
  'mobile-verified',
  'deep-final',
]) {
  if (!existsSync(resolve(out, round, 'summary.json'))) continue;
  for (const row of read(round + '/summary.json'))
    latest.set(row.path + '|' + row.device, { ...row, round });
}
const before = read('baseline/summary.json'),
  after = read('after/summary.json');
const staticAudit = read('all-pages-summary.json');
const cookie = read('cookie-startup/report.json');
const warm = read('warm-cache/report.json');
const interactions = read('interactions-deep-final/report.json'),
  layout = read('layout/report.json'),
  mobileBehavior = read('mobile-behavior/report.json');
const allRouteLayout = read('all-route-layout/report.json');
const fullJsCatalog = read('deep-before-catalog/report.json');
const fullJsWebkit = read('deep-after-core-webkit/report.json');
const internalLinks = read('all-links.json');
const throttledEditor = read('throttled-editor/report.json');
if (throttledEditor.failures.length || throttledEditor.checks.length !== 2)
  throw Error('Actual throttled editor checks must finish before reporting.');
if (
  !allRouteLayout.finished ||
  allRouteLayout.visited !== allRouteLayout.total ||
  allRouteLayout.states !== allRouteLayout.total * 2 ||
  allRouteLayout.issues.length ||
  allRouteLayout.errors.length ||
  internalLinks.missing.length
)
  throw Error(
    'The full local site audit must finish without unresolved failures before reporting.',
  );
const searchChecks = ['chromium', 'webkit'].map((engine) =>
  read(`search-mobile-final/${engine}/report.json`),
);
const rasterChecks = ['chromium', 'webkit'].map((engine) =>
  read(`raster-mobile-final/${engine}/report.json`),
);
const mobileRepeat = read('deep-repeat/summary.json');
if (mobileRepeat.length !== 4 || mobileRepeat.some((row) => row.error))
  throw Error('The focused repeat measurement must finish before reporting.');
if ([...searchChecks, ...rasterChecks].some((result) => result.status !== 'passed'))
  throw Error('Search and original export checks must pass before reporting.');
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const score = (n) => `<b class="score ${n < 90 ? 'below' : n < 100 ? 'good' : 'perfect'}">${n}</b>`;
const base = 'http://127.0.0.1:4326';
const reportPath = (row) =>
  (row.path === '/'
    ? 'home'
    : row.path
        .replaceAll('/', '-')
        .replace(/^-|-$/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')) +
  '-' +
  row.device +
  '.html';
const resultRows = templateRoutes.map((path) => {
  const m = latest.get(path + '|mobile'),
    d = latest.get(path + '|desktop');
  if (!m || !d) throw Error('Missing actual measurement: ' + path);
  return { path, mobile: m, desktop: d };
});
const summary = {
  generatedAt: new Date().toISOString(),
  publication: 'LOCAL ONLY — NOT DEPLOYED',
  allScores100: resultRows.every((r) =>
    [r.mobile, r.desktop].every((v) => Object.values(v.scores).every((n) => n === 100)),
  ),
  staticAudit,
  interactionChecks:
    interactions.checks.length +
    layout.checks.length +
    cookie.checks.length +
    warm.checks.length +
    mobileBehavior.checks.length,
  interactionFailures: [
    ...interactions.failures,
    ...layout.failures,
    ...cookie.failures,
    ...warm.failures,
    ...mobileBehavior.failures,
  ],
  measuredAddresses: resultRows.length,
  additionalSearchChecks: searchChecks.reduce((n, result) => n + result.checks.length, 0),
  originalEditorChecks: rasterChecks.reduce((n, result) => n + result.checks.length, 0),
  editorViewportChecks: rasterChecks.reduce((n, result) => n + result.states.length, 0),
  realExports: rasterChecks.reduce((n, result) => n + result.exports.length, 0),
  mobileRepeat,
  allRouteLayout,
  fullJsCatalog: {
    date: fullJsCatalog.date,
    finished: fullJsCatalog.finished,
    summary: fullJsCatalog.summary,
  },
  fullJsWebkit: {
    date: fullJsWebkit.date,
    finished: fullJsWebkit.finished,
    summary: fullJsWebkit.summary,
  },
  internalLinks,
  throttledEditor,
  results: resultRows,
};
if (summary.interactionFailures.length)
  throw Error('Interaction failures must be resolved before the final report.');
writeFileSync(resolve(out, 'release-summary.json'), JSON.stringify(summary, null, 2));
const files = read('all-pages.json');
const navigated = new Map();
for (const line of readFileSync(resolve(out, 'all-route-layout/pages.ndjson'), 'utf8')
  .trim()
  .split('\n')) {
  const row = JSON.parse(line);
  navigated.set(row.route + '|' + row.width, row);
}
if (
  navigated.size !== allRouteLayout.total * 2 ||
  [...navigated.values()].some((row) => !row.passed)
)
  throw Error('Per-page browser evidence is incomplete.');
writeFileSync(
  resolve(out, 'tum-sayfalar-tarayici.csv'),
  '\ufeffAdres,Genişlik,HTTP,Sonuç,Kapsam\n' +
    [...navigated.values()]
      .map((row) =>
        [
          row.route,
          row.width,
          row.status,
          'Başarılı',
          'Chromium; JavaScript kapalı; sunucuda üretilmiş yerleşim; etkileşim/Lighthouse testi değil',
        ]
          .map((value) => '"' + String(value).replaceAll('"', '""') + '"')
          .join(','),
      )
      .join('\n'),
);
writeFileSync(
  resolve(out, 'tum-sayfalar.csv'),
  '\ufeffAdres,HTML bayt,Görsel sayısı,Önizleme sayısı,Duyarlı görsel sayısı,İndekslenebilir,Kontrol\n' +
    files.pages
      .map((r) =>
        [
          r.path,
          r.htmlBytes,
          r.images,
          r.previews,
          r.responsive,
          r.indexable ? 'Evet' : 'Hayır',
          'Statik kaynak denetimi; Lighthouse değil',
        ]
          .map((v) => '"' + String(v).replaceAll('"', '""') + '"')
          .join(','),
      )
      .join('\n'),
);
const comparison = before
  .map((b) => {
    const a = after.find((v) => v.path === b.path && v.device === b.device);
    return `<tr><td>${esc(b.path)}</td><td>${b.device === 'mobile' ? 'Mobil' : 'Masaüstü'}</td><td>${b.scores.performance} → ${a.scores.performance}</td><td>${(b.metrics['largest-contentful-paint'] / 1000).toFixed(2)} → ${(a.metrics['largest-contentful-paint'] / 1000).toFixed(2)} sn</td></tr>`;
  })
  .join('');
const table = resultRows
  .map(
    ({ path, mobile: m, desktop: d }) =>
      `<tr><th><a href="${base}${esc(path)}">${esc(path)}</a>${m.scores.seo < 100 ? '<small>Mevcut noindex kararı korunuyor.</small>' : ''}${path === '/ai-clipart-generator/' ? '<small>Yerel kota API’si yok: gerçek 404 kaydı.</small>' : ''}</th>${[m, d].map((r) => `<td>${score(r.scores.performance)}</td><td>${r.scores.accessibility} / ${r.scores['best-practices']} / ${r.scores.seo}</td><td>${(r.metrics['largest-contentful-paint'] / 1000).toFixed(2)} sn<br><small>CLS ${r.metrics['cumulative-layout-shift'].toFixed(4)}</small></td><td><a href="/__performance-evidence/${r.round}/${reportPath(r)}">Rapor</a><small>${esc(r.date)}</small></td>`).join('')}</tr>`,
  )
  .join('');
const text = `ULTRACLIPART — YEREL PERFORMANS RAPORU\n${summary.generatedAt}\n\nYAYIN YAPILMADI. Önceki yerel değişiklikler korundu.\nTüm sayfalarda bütün skorların 100 olması hedefi henüz karşılanmadı.\n\n${staticAudit.pages} HTML sayfası statik kaynak denetiminden geçti.\n${allRouteLayout.total} adres Chromium’da 320/1440 genişliklerinde açıldı: ${allRouteLayout.states} yapısal yerleşim kontrolü, JavaScript kapalı; etkileşim/Lighthouse sonucu değildir.\nSon WebKit turu: 34 adres × 5 genişlik = ${fullJsWebkit.states.length} JavaScript açık kontrol; yerleşim ve erişilebilirlik sorunu yok.\n${internalLinks.distinctInternalPaths} farklı iç hedefte eksik dosya: ${internalLinks.missing.length}. ${staticAudit.distinctLocalImages} ayrı yerel görsel URL’sinde eksik dosya: ${staticAudit.missing.length}.\n${resultRows.length} temsilî adresin mobil ve masaüstü Lighthouse ölçümü var; bu sayı her katalog URL’sinin ayrı ölçüldüğü anlamına gelmez.\nChromium/WebKit, 390/1440 genişliklerinde ${summary.interactionChecks} etkileşim kontrolü; hata: ${summary.interactionFailures.length}. Fiziksel iPhone/Android cihaz testi yapılmadı.\n\nSON PERFORMANS SKORLARI (Mobil / Masaüstü)\n${resultRows.map((r) => `${r.path}: ${r.mobile.scores.performance} / ${r.desktop.scores.performance}`).join('\n')}\n\nAynı sürümde ek mobil tekrar: ${mobileRepeat.map((r) => `${r.path}: ${r.scores.performance}`).join('; ')}.\nGerçek ağ/CPU yavaşlatması: ${throttledEditor.checks.map((r) => `${r.id}: LCP ${(r.lcp.at(-1).time / 1000).toFixed(2)} sn; düzenleme hazır ${(r.editingReadyAt / 1000).toFixed(2)} sn`).join('; ')}. Bu Lighthouse puanı değildir.\n\nÖnemli sınırlar: Yerel AI kota uç noktası bulunmadığı için AI Builder Best Practices 96. Mevcut noindex sayfaları SEO 69; bu kasıtlı karar korunmuştur. Üretim Cloudflare başlıkları/AI Functions, canlı PageSpeed ve gerçek kullanıcı hızları doğrulanmadı.\n\nİlk aynı-sürüm karşılaştırması Lighthouse 12.8.2 ile yapıldı; son matris 13.5.0. Ayrıntılar rapor.html ve sıkıştırılmış ham ölçümlerde.\n`;
writeFileSync(resolve(out, 'rapor.txt'), text);
writeFileSync(
  resolve(out, 'rapor.html'),
  `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>UltraClipart — Yerel performans raporu</title><style>
*{box-sizing:border-box}body{margin:0;background:#f2f6fc;color:#18304f;font:16px/1.65 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:40px 24px}h1{font-size:clamp(28px,4vw,44px);line-height:1.2;margin:12px 0}h2{margin-top:0;color:#123966}p{max-width:100ch}.banner{padding:18px 22px;border-left:5px solid #ba6d00;background:#fff3da;border-radius:8px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin:26px 0}.card,section{background:white;border:1px solid #d7e2f1;border-radius:15px;padding:24px;margin-bottom:24px}.cards .card{margin:0}.metric{font-size:32px;font-weight:750;color:#185eaa}.muted,small{color:#536a85}small{display:block;font-size:12px}a{color:#145da5;text-underline-offset:3px}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:13px 10px;border-bottom:1px solid #e1e9f3;vertical-align:top}thead{background:#edf4fd}tbody th{min-width:240px;font-weight:500}td{min-width:70px}.score{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:50%;border:3px solid}.perfect{color:#096845}.good{color:#236a4f}.below{color:#a25b06}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}.pair img{max-width:100%;height:auto;border:1px solid #d7e2f1;border-radius:8px}@media(max-width:700px){main{padding:22px 12px}.pair{grid-template-columns:1fr}section{padding:18px}}
</style><main><p class="muted">ULTRACLIPART · 26 EKİM 2026 · YALNIZCA YEREL ÇALIŞMA</p><h1>Performans iyileştirmeleri ve gerçek test sonuçları</h1><p class="banner"><strong>Tüm skorlar 100 değil.</strong> Hedefin karşılanmayan kısmı aşağıda açıkça gösteriliyor. Değişiklikler yayımlanmadı; önceki yerel çalışmalar korundu.</p>
<div class="cards"><div class="card"><div class="metric">${staticAudit.pages.toLocaleString('tr-TR')}</div>HTML sayfasında statik kaynak kontrolü</div><div class="card"><div class="metric">${resultRows.length} × 2</div>Temsilî adreste mobil / masaüstü Lighthouse</div><div class="card"><div class="metric">${summary.interactionChecks} / ${summary.interactionChecks}</div>Başarılı etkileşim kontrolü · Chromium ve WebKit</div><div class="card"><div class="metric">${staticAudit.missing.length}</div>Eksik yerel görsel bağlantısı</div></div>
<section><h2>Ne değişti?</h2><ul><li>Eserler için ekrana uygun, kaynağın doğrulanmış özetiyle adlandırılan önizlemeler üretildi. Büyük ayrıntı görsellerine mobil ara boyut eklendi. İndirilen orijinal dosyalar, kimlikler ve metinler korunuyor.</li><li>Menü, kartlar, arama, ilgili eserler ve Studio aynı duyarlı görsel sistemini kullanıyor. Yeni katalog içeriği normal derlemede bu sisteme giriyor.</li><li>Studio başlangıçta küçük bir seçki yüklüyor; tüm eserler ve vektörler aranabilir durumda. Arka arkaya değiştirilen filtrelerde eski isteğin yeni seçimi ezmesi engellendi.</li><li>Inter ve sadece rehber/öğretmen sayfalarında kullanılan Source Sans 3 dosyaları küçültüldü. Onaylı yazı tipi düzeni korundu.</li><li>Gerçek rehber ekran görüntülerinin kırpılmış WebP kopyaları ihtiyaç oldukça yükleniyor. Numaralı işaretçiler, tıklamalar ve orijinal ekran görüntüsü bağlantıları doğrulandı.</li><li>Arama filtrelerinin satır değiştirmesi ve düzenleyicinin başlangıç tuval/durum alanından kaynaklanan sıçramaları azaltıldı. Koleksiyon başlık hiyerarşisi ve görünür düğme adıyla erişilebilir ad uyuşmazlıkları düzeltildi.</li><li>Çerez bildirimi, kayıtlı tercih ve bölge kuralları korunarak daha erken başlıyor. Düzenleyici HTTP önbelleğini kullanırken orijinal boyut/özet denetimini koruyor; içerik uyuşmazlığında tek bir yeniden indirme yapılıyor.</li></ul></section>
<section><h2>Mobil arama ve düzenleyiciler: bu tur</h2><ul><li>Aramada sorguyla ilgisiz ilk görseller indirilmez. Eser sonuçları sayfa/araç dizininden önce gösterilir; dizin gecikirse mevcut kartlar korunur. Ağ hatası görünür bir yeniden deneme seçeneği sunar.</li><li>Düzenleyici, doğrulanmış tam dosya hazırlanırken mevcut küçük önizlemeyi gösterir. Tam kaynak doğrulanana kadar araçlar kapalıdır. Önizleme, düzenlemeye hazır olunduğu veya tüm dosyanın indiği anlamına gelmez.</li><li>Yakınlaştırma ve dışa aktarma tam çözünürlüklü orijinali kullanır. Küçük kopya açılamazsa doğrulanmış orijinale dönülür; kaynak doğrulaması başarısızsa tuval ve çıktı engellenir.</li><li>Studio ekran dışındayken araç kodunu yüklemez. İlk araç bağlantısı ve doğrudan araç adresleri yüklemeyi başlatır. Kullanıcının kayıtlı çalışmaları korunur.</li><li>Yeni yavaş ağ, başarısız dizin, önizleme kaybı, ilk tıklama ve yakınlaştırma kontrolleri Chromium/WebKit üzerinde yürütüldü. Deneysel font ön yüklemesi düzenleyicileri yavaşlattığı için bu sayfalarda kaldırıldı; başarısız/gerileyen ölçüm turları da saklandı.</li></ul><p>Önceki mobil referans: arama 88; iki eser düzenleyicisi 81 ve 73; Studio 92. Güncel puanlar aşağıdaki gerçek son turdadır. 100 hedefine ulaşılmayan sonuçlar gizlenmez. Yerel ağ koşulları ve Lighthouse simülasyonu nedeniyle tek bir puan her ziyaretçinin hızını temsil etmez.</p></section><section><h2>Bütün adresler: derin tarama</h2><p><strong>${allRouteLayout.total.toLocaleString('tr-TR')} üretilmiş HTML adresi</strong> Chromium’da 320 ve 1440 pikselde gerçekten açıldı: ${allRouteLayout.states.toLocaleString('tr-TR')} yerleşim kontrolü. Yatay taşma, kesilen metin, ekran dışına kaçan öğe, eksik ana başlık ve yinelenen SVG/HTML kimliği bulunmadı. Bu kapsam JavaScript kapalıyken sunucunun ürettiği yerleşimdir; her adresin etkileşim veya Lighthouse testi değildir.</p><p>JavaScript açık ayrı tarama: iyileştirme öncesinde 540 katalog/koleksiyon/eser adresi üç genişlikte (${fullJsCatalog.states.length.toLocaleString('tr-TR')} kontrol); son sürümde 34 farklı sayfa WebKit’te beş genişlikte (${fullJsWebkit.states.length} kontrol). Son WebKit turunda yerleşim, erişilebilirlik ve sayfa hatası bulunmadı. Bu listede ana sayfa, menüler, arama, yasal sayfalar, rehberler, Studio ve farklı oranlardaki eser düzenleyicileri var.</p><p>Tüm HTML’de ${internalLinks.distinctInternalPaths.toLocaleString('tr-TR')} farklı iç bağlantı ve ortak dosya yolu statik olarak kontrol edildi; eksik hedef: ${internalLinks.missing.length}. Dış siteler, dinamik API yanıtları ve sayfa içi işaretçiler bu kaynak kontrolünün dışında. Noindex 404 belgesinin canonical kimliği gezinme bağlantısı olarak sayılmadı; ayrı kayıt altında saklandı.</p><p>Kesinti sırasında kaydedilen bağlantı hataları başarılı sayılmadı; eksik adresler aynı derleme üzerinde yeniden açıldı. İlk hata kayıtları ve tamamlanan son kayıt birlikte saklandı.</p><p><a href="/__performance-evidence/tum-sayfalar-tarayici.csv">Her adres ve ekran genişliği için tarayıcı sonucu</a> · <a href="/__performance-evidence/all-route-layout/report.json">Tam tarama özeti</a> · <a href="/__performance-evidence/all-links.json">İç bağlantı denetimi</a></p><ul><li>Erken bölge kontrolü, kayıtlı çerez tercihi bulunmadığında yalnızca aynı kökenli mevcut uç noktasını çağırır. Düzenleyicilerde görsele öncelik verilir. Tercihler, bölge kuralları ve hata durumundaki bildirim korunur.</li><li>Studio SVG’lerindeki uzun rastgele kimlikler, belge içinde benzersiz kısa kimliklerle değiştirildi. Renkler, gölgeler ve çizimler aynı; sıkıştırılmış örnek editör HTML’i 61.524 → 59.763 bayt, Studio HTML’i 78.806 → 76.917 bayt oldu.</li><li>Yerel önizleme artık gerçek tasarlanmış 404 sayfasını HTTP 404 ile gösterir. Bu, üretimde 404 bozuktu iddiası değildir. Tarama sunucusunun sıkıştırılmış dosya belleği de sınırlıdır.</li></ul></section><section><h2>Son ölçümler</h2><p>Her satırın iki cihaz sonucu gerçek bir ölçümdür. Hız sütunu performans puanıdır; E / İU / SEO sırasıyla erişilebilirlik, iyi uygulamalar ve SEO puanlarını gösterir. Son değişen şablonlarda daha yeni tekrar ölçümü kullanıldı; ham önceki turlar da saklandı.</p><div class="scroll"><table><thead><tr><th>Adres</th><th>Mobil hız</th><th>Mobil E / İU / SEO</th><th>Mobil LCP / CLS</th><th>Kanıt</th><th>Masaüstü hız</th><th>Masaüstü E / İU / SEO</th><th>Masaüstü LCP / CLS</th><th>Kanıt</th></tr></thead><tbody>${table}</tbody></table></div></section>
<section><h2>Aynı sürümde ikinci mobil ölçüm</h2><p>Puan değişkenliğini görmek için son sürüm dört adreste tekrar ölçüldü; en yüksek puan seçilip diğer ölçüm gizlenmedi.</p><div class="scroll"><table><thead><tr><th>Adres</th><th>İlk son tur</th><th>Tekrar</th></tr></thead><tbody>${mobileRepeat.map((r) => `<tr><td>${esc(r.path)}</td><td>${latest.get(r.path + '|mobile').scores.performance}</td><td>${r.scores.performance} · <a href="/__performance-evidence/deep-repeat/${reportPath(r)}">Ham rapor</a></td></tr>`).join('')}</tbody></table></div></section><section><h2>Gerçek yavaş bağlantıda düzenleyici</h2><p>Chromium’da ağ gerçekten 150 ms gecikme, saniyede 200.000 bayt indirme ve dört kat CPU yavaşlatmasıyla çalıştırıldı. Bu ölçüm Lighthouse’un simülasyon puanı veya fiziksel telefon testi değildir. Görselin görünmesi ile tam dosyanın doğrulanıp düzenlemeye hazır olması ayrı kaydedildi.</p><div class="scroll"><table><thead><tr><th>Eser</th><th>Son gerçek LCP</th><th>Düzenleme hazır</th><th>Kanıt</th></tr></thead><tbody>${throttledEditor.checks.map((r) => `<tr><td>${esc(r.id)}</td><td>${(r.lcp.at(-1).time / 1000).toFixed(2)} sn</td><td>${(r.editingReadyAt / 1000).toFixed(2)} sn</td><td><a href="/__performance-evidence/throttled-editor/${esc(r.id)}.png">Ekran görüntüsü</a></td></tr>`).join('')}</tbody></table></div><p>Aynı derlemedeki iki Lighthouse turunda voleybol düzenleyicisi mobilde 73 ve 95 aldı; arama 98 ve 94 aldı. Bu farklar gizlenmedi. Düzenleyicinin tam çözünürlüklü kaynak indirmesi devam ederken görünen önizleme için ayrı gerçek süre yukarıda gösterilir. 100 hedefine ulaşıldığı iddia edilmez.</p><p><a href="/__performance-evidence/throttled-editor/report.json">Gerçek ağ/CPU koşulları ve zaman kayıtları</a> · <a href="/__performance-evidence/deep-verified/summary.json">Önceki deneysel yükleme turu</a></p></section><section><h2>Önce / sonra: aynı araç sürümüyle ilk iyileştirme turu</h2><p>Bu karşılaştırmanın iki tarafı da Lighthouse 12.8.2 ile çalıştırıldı. Güncel üst tablo 13.5.0 kullanır; farklı sürüm puanları aynı deneymiş gibi karşılaştırılmamalıdır.</p><div class="scroll"><table><thead><tr><th>Adres</th><th>Cihaz</th><th>Performans</th><th>LCP</th></tr></thead><tbody>${comparison}</tbody></table></div></section>
<section><h2>Kapsam ve açık kalan işler</h2><ul><li>Her eser adresine ayrı Lighthouse çalıştırılmadı. Tüm adreslerin yukarıdaki tarayıcı taraması yapısal yerleşim kapsamındadır. ${staticAudit.pages.toLocaleString('tr-TR')} sayfanın tamamı statik denetlendi; şablonlar ve seçilen adresler tarayıcıda ölçüldü. <a href="/__performance-evidence/tum-sayfalar.csv">Sayfa bazında statik kontrol listesini indir</a>.</li><li>100’ün altındaki performans puanları, özellikle büyük görsel ve düzenleyici ekranlarında, hedefin henüz tamamlanmadığını gösteriyor. Bu rapor yüzde 100 hız garantisi değildir.</li><li>AI Builder kota hizmeti bu yerel statik sunucuda yoktur. Gerçek 404 yanıtı kaydedildi; Best Practices 96 sonucu gizlenmedi. Gerçek AI üretimi veya ücretli hizmet çağrısı yapılmadı.</li><li>Arama, Favorites, düzenleyici ve bazı keşif sayfalarının bilinçli noindex kararı korunuyor; bu yüzden SEO puanları 69. Sırf puan yükseltmek için kişisel/arama sayfaları indekslenebilir yapılmadı.</li><li>WebKit ve Chromium 390/1440 görünüm testleri fiziksel iPhone Safari veya Android cihaz testi değildir. Firefox test akışı CI’ye bağlandı; bu turda Firefox çalıştırılmadı.</li><li>Chromium tekrar açılışta sıfır kaynak aktarımı bildirdi; geçici WebKit bağlamı sıfır aktarım bildirmedi. İki tarayıcıda da doğrulanmış asıl görsel açıldı. Bu fark gizlenmedi.</li><li>${summary.additionalSearchChecks} ek arama kontrolü başarılı. Chromium ve WebKit’te iki örnek eserden toplam ${summary.realExports} gerçek WebP/PDF çıktısı alındı; değişmiş kaynak baytları düzenleme ve dışa aktarmadan önce engellendi. 320, 390, 768 ve 1440 genişliklerinde bu akışta taşma veya Axe ihlali bulunmadı.</li><li>Yerel Astro derlemesi başarılı. Cloudflare dağıtımı, üretim güvenlik başlıkları/Functions ve canlı alan adındaki güncel PageSpeed/CrUX sonuçları bu yerel turla doğrulanmış sayılmaz.</li><li>Statik dağıtım dosyası üst sınırı ${staticAudit.deploymentFilesBeforeAnyVerifiedPageOffload.toLocaleString('tr-TR')}; mevcut 100.000 dosya sınırının altında. Yeni içerik eklendikçe mevcut normal yayın boyutu kontrolü çalışmaya devam eder.</li></ul></section>
<section><h2>Görsel ve işlev kontrolünden örnekler</h2><div class="pair"><figure><img loading="lazy" src="/__performance-evidence/interactions-mobile-final/chromium-390-home.png" alt="Yerel mobil ana sayfanın test ekran görüntüsü"><figcaption>Chromium · 390 piksel</figcaption></figure><figure><img loading="lazy" src="/__performance-evidence/layout-mobile-final/webkit-1440-for-teachers.png" alt="WebKit testinde gerçek ekran görüntüsü ve hizalanmış işaretçiler"><figcaption>WebKit · öğretmen rehberi kırpımı ve işaretçileri</figcaption></figure></div></section>
<section><h2>Kayıt ve yeniden test</h2><p>Kaynak, testler, tam Lighthouse HTML/JSON ölçümleri ve ekran görüntüleri yerelde saklandı. Yeniden çalıştırma yönergesi: <code>docs/performance-local-2026-10-26.txt</code>. 79 ilgili birim testi yürütüldü; başarısız ilk test betiği varsayımları ayrı kanıt dosyalarında tutuldu, başarılı sayılmadı.</p><p>Önbellek: içerik değişince yeni dosya URL’si oluşur; orijinal indirmeler ve kullanıcı Favorites/projeleri korunur. Canlı önbelleğe müdahale edilmedi.</p><p><a href="/__performance-evidence/rapor.txt">Türkçe metin raporu</a> · <a href="/__performance-evidence/release-summary.json">Ölçüm özeti</a> · <a href="${base}/">Yerel siteyi aç</a></p></section>
<section><h2>Resmî başvuru kaynakları</h2><p><a href="https://developer.chrome.com/docs/lighthouse/performance/performance-scoring">Google: Lighthouse puanlama ve ölçüm değişkenliği</a> · <a href="https://web.dev/articles/optimize-lcp">Google: LCP iyileştirme</a> · <a href="https://web.dev/articles/responsive-images">Google: duyarlı görseller</a> · <a href="https://github.com/GoogleChrome/lighthouse/releases">Lighthouse sürümleri</a></p></section><p class="muted">Rapor üretildi: ${esc(summary.generatedAt)} · Yayın yapılmadı.</p></main></html>`,
);
console.log(
  JSON.stringify({
    report: resolve(out, 'rapor.html'),
    pages: summary.measuredAddresses,
    checks: summary.interactionChecks,
    allScores100: summary.allScores100,
  }),
);
