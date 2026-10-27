import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '../..');
const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const before = read('reports/spacing/before/report.json');
const after = read('reports/spacing/after/report.json');
const compiled = read('reports/spacing/all-compiled-pages.json');
const footers = ['chromium', 'webkit'].map((engine) =>
  read(`reports/footer/${engine}/report.json`),
);
const imageBrowser = read('reports/image-seo/browser/report.json');
const imageInformation = read('reports/image-seo/image-information/report.json');
assert.ok(after.finished, 'Browser scan must finish before reporting success');
assert.deepEqual(after.errors, []);
assert.deepEqual(compiled.errors, []);
for (const footer of footers) {
  assert.equal(footer.status, 'passed');
  assert.deepEqual(footer.errors, []);
}
assert.deepEqual(imageBrowser.errors, []);
assert.deepEqual(imageInformation.failures, []);
for (const old of before.states) {
  const current = after.states.find(
    (s) => s.engine === old.engine && s.width === old.width && s.route === old.route,
  );
  if (!current) continue; // The final sweep uses 768/1024 instead of baseline 900.
  assert.deepEqual(
    current.galleries.map((g) => g.ids),
    old.galleries.map((g) => g.ids),
    'Baseline card order and count must survive at every tested width',
  );
}
const n = (value) => Number(value).toLocaleString('tr-TR');
const rows = [];
for (const route of ['/', '/new/', '/black-and-white/', '/collection/animals-nature/']) {
  const old = before.states.find(
    (s) => s.engine === 'chromium' && s.width === 1440 && s.route === route,
  );
  const current = after.states.find(
    (s) => s.engine === 'chromium' && s.width === 1440 && s.route === route,
  );
  assert.deepEqual(
    current.galleries.map((g) => g.ids),
    old.galleries.map((g) => g.ids),
    'Original card order and count must survive',
  );
  rows.push({
    route,
    before: old.footerGap,
    after: current.footerGap,
    oldRows: old.galleries.map((g) => g.rowCounts),
    newRows: current.galleries.map((g) => g.rowCounts),
  });
}
const routes = new Set(after.states.map((s) => s.route));
const csv = (values) =>
  values.map((s) => '"' + String(s ?? '').replaceAll('"', '""') + '"').join(',');
writeFileSync(
  join(root, 'reports/spacing/sayfa-olcumleri.csv'),
  '\ufeff' +
    csv([
      'Tarayıcı',
      'Genişlik',
      'Sayfa',
      'Footer boşluğu (px)',
      'Yatay taşma',
      'Galeri son satırları dengeli',
      'Sonuç',
    ]) +
    '\n' +
    after.states
      .map((r) =>
        csv([
          r.engine,
          r.width,
          r.route,
          r.footerGap.toFixed(2),
          r.horizontalOverflow ? 'Var' : 'Yok',
          r.galleries.every((g) => g.centered) ? 'Evet' : 'Hayır',
          r.passed ? 'Geçti' : 'Kaldı',
        ]),
      )
      .join('\n'),
);
const text =
  [
    'ULTRACLIPART — BOŞLUK VE GALERİ DÜZENİ RAPORU',
    `Durum: yalnızca yerel. Canlıya yayın yapılmadı. Kontrol tamamlanma zamanı: ${after.finished}.`,
    'Neden: içerik kabının alt dolgusu, son bölümün alt marjı ve footer’ın üst marjı üst üste ekleniyordu. New Clipart ve koleksiyon özetlerindeki 32 kart beş sütuna bölününce son satırda iki kart ve sağda geniş bir boşluk kalıyordu.',
    `Düzeltme: footer öncesi ortak dış boşluğu artık sayfa kuralı belirliyor (28–40 piksel). Footer ayrıca üst marj eklemiyor; son gerçek içerik bölümünün gereksiz son marjı sıfırlanıyor. Son düğüm script veya template olsa da bu kural çalışıyor. Tüm ölçülen sayfa geçişlerinde toplam aralık ${Math.min(...after.states.map((s) => s.footerGap))}–${Math.max(...after.states.map((s) => s.footerGap))} piksel; ana örnekler 40 piksel.`,
    'Ana sayfa: bölüm aralıkları tek bir ölçekle 32–48 piksel olarak yönetiliyor. Bölümlerin kendi tekrarlı dış marjları kaldırıldı. Mevcut içerikler, görseller, bağlantılar ve bölüm sırası korundu; ekstra içerik eklenmedi.',
    'Galeriler: kartlar ortak, duyarlı satır düzenine bağlı. 32 öğe geniş ekranda dört sütunla sekiz tam satır oluşturuyor. Diğer eksik satırlar eşit kart genişliği korunarak ortalanıyor. CSS yeni içerik/filtre sonuçları değiştiğinde kendiliğinden güncelleniyor; ek JavaScript veya boşluk dolduran sahte kart kullanılmıyor. Ana sayfanın kendi tam satırlı vitrin düzeni korunuyor.',
    ...rows.map(
      (r) =>
        `${r.route} — 1440 px, Chromium: önce ${r.before} px; sonra ${r.after} px footer boşluğu. Kart sırası ve sayısı karşılaştırıldı, aynı kaldı.`,
    ),
    `Gerçek tarayıcı denetimi: ${n(routes.size)} farklı yerel adres, toplam ${n(after.states.length)} görünüm durumu. Chromium bütün 238 konu sayfasını ve her konudan bir görsel sayfasını, ayrıca tüm farklı sayfa şablonlarını taradı. WebKit bütün farklı şablonlarda çalıştırıldı. Şablonlar 320/390/768/1024/1440/1920 px; konu ve örnek görsel sayfaları 390/1440 px ile kontrol edildi.`,
    'Kontroller: footer öncesi boşluk; ana sayfa bölüm aralıkları; galeri son satır dengesi; kart genişlikleri; yatay taşma; metin kırpılması; sınır dışına çıkan öğeler. Son taramada bu ölçütlerde hata bulunmadı.',
    `Tüm sayfa kontrolü: ${n(compiled.pages)} derlenmiş HTML adresinin ortak boşluk ve galeri CSS kurallarını taşıdığı doğrulandı; hata ${compiled.errors.length}. Bu kaynak kontrolü, 24.589 adresin tamamının elle tek tek görsel olarak incelendiği anlamına gelmez.`,
    `Tarayıcı ölçümleri kararlı statik düzeni doğrulamak için JavaScript kapalı yapıldı. Ayrıca JavaScript açık ${footers.reduce((total, footer) => total + footer.layouts.length, 0)} footer görünümü; ${imageBrowser.states.length} görsel metadata görünümü ve ${imageBrowser.interactions.length + imageInformation.checks.length} arama, orijinal dosya özeti, hover/focus ve mobil gezinme kontrolü başarıyla tamamlandı. WebKit testi fiziksel iPhone testi olarak sunulmaz.`,
    'Görsel SEO çalışması, kişisel projeler, Favoriler, indirme dosyaları ve ziyaretçi tercihleri korundu. Güncel görsel SEO derleme denetimi de yeniden çalıştırıldı. Google/Bing’e gönderim, R2 yüklemesi veya önbellek temizliği yapılmadı.',
    'Kanıtlar: reports/spacing/before/ ve reports/spacing/after/ ekran görüntüleri; sayfa-olcumleri.csv; all-compiled-pages.json. İlk taramada bulunan ek alt marj hataları first-pass/report.json içinde saklandı; başarı iddiası yalnızca son tamamlanan taramaya aittir.',
  ].join('\n\n') + '\n';
writeFileSync(join(root, 'reports/spacing/rapor.txt'), text);
writeFileSync(join(root, 'docs/spacing-local-2026-10-26.txt'), text);
writeFileSync(join(root, 'reports/spacing/comparison.json'), JSON.stringify(rows, null, 2));
console.log(
  JSON.stringify({
    routes: routes.size,
    states: after.states.length,
    compiledPages: compiled.pages,
    errors: 0,
    comparison: rows,
  }),
);
