import { readFileSync, writeFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Summarize executed measurements only. Missing runs are never implicit passes.
const root = resolve(import.meta.dirname, '../..');
const directory = resolve(root, process.env.PERFORMANCE_OUT || 'reports/performance/catalog-final');
const reportsRoot = resolve(root, 'reports/performance');
if (!directory.startsWith(reportsRoot + '/')) throw Error('Local performance evidence required');
const read = (name) => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const plan = read('plan.json');
const rows = read('summary.json');
const closed = existsSync(join(directory, 'closed.json')) ? read('closed.json') : null;
if (closed && closed.release !== plan.release)
  throw Error('Scope closure belongs to another release');
const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
const expected = new Set();
const key = (row) => `${row.path}|${row.device}|${row.repeat}`;
for (const target of plan.targets)
  for (const device of plan.devices)
    for (let repeat = 1; repeat <= plan.repeats; repeat++)
      expected.add(key({ path: target.path, device, repeat }));
const seen = new Set();
for (const row of rows) {
  if (!expected.has(key(row)) || seen.has(key(row)))
    throw Error('Unexpected or duplicate measurement');
  if (row.release !== plan.release || (row.version && row.version !== plan.lighthouse))
    throw Error('Mixed-release or mixed-version evidence');
  const target = plan.targets.find((target) => target.path === row.path);
  if (row.htmlSha256 !== target.sha256) throw Error('Measurement HTML checksum differs from plan');
  if (!row.error && categories.some((category) => !Number.isFinite(row.scores?.[category])))
    throw Error('Incomplete measurement scores');
  seen.add(key(row));
}
const successful = rows.filter((row) => !row.error);
const errors = rows.filter((row) => row.error);
const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length
    ? (sorted[middle] + sorted[sorted.length % 2 ? middle : middle - 1]) / 2
    : null;
};
const range = (values) =>
  values.length
    ? { minimum: Math.min(...values), median: median(values), maximum: Math.max(...values) }
    : { minimum: null, median: null, maximum: null };
const byDevice = Object.fromEntries(
  plan.devices.map((device) => {
    const measured = successful.filter((row) => row.device === device);
    return [
      device,
      {
        measured: measured.length,
        expected: plan.targets.length * plan.repeats,
        categories: Object.fromEntries(
          categories.map((category) => [
            category,
            {
              ...range(measured.map((row) => row.scores[category])),
              perfect: measured.filter((row) => row.scores[category] === 100).length,
            },
          ]),
        ),
        lcpMs: range(
          measured.map((row) => row.metrics['largest-contentful-paint']).filter(Number.isFinite),
        ),
        tbtMs: range(
          measured.map((row) => row.metrics['total-blocking-time']).filter(Number.isFinite),
        ),
        cls: range(
          measured.map((row) => row.metrics['cumulative-layout-shift']).filter(Number.isFinite),
        ),
      },
    ];
  }),
);
const complete = successful.length === expected.size && errors.length === 0;
const result = {
  generatedAt: new Date().toISOString(),
  publication: 'LOCAL_ONLY',
  status: closed
    ? 'scope-closed-by-owner'
    : complete
      ? 'measurements-complete'
      : errors.length
        ? 'execution-errors-or-incomplete'
        : 'in-progress',
  closedByOwner: closed,
  release: realpathSync(plan.release),
  lighthouse: plan.lighthouse,
  routes: plan.targets.length,
  subjectAndCollectionRoutes: plan.subjects,
  expectedMeasurements: expected.size,
  executedMeasurements: rows.length,
  successfulMeasurements: successful.length,
  errors: errors.map(({ path, device, repeat, error }) => ({ path, device, repeat, error })),
  unmeasured: [...expected].filter((id) => !seen.has(id)),
  performance100TargetMet: complete && successful.every((row) => row.scores.performance === 100),
  allFourCategories100: successful.filter((row) =>
    categories.every((category) => row.scores[category] === 100),
  ).length,
  belowPerformance100: successful
    .filter((row) => row.scores.performance < 100)
    .map((row) => ({
      path: row.path,
      device: row.device,
      repeat: row.repeat,
      performance: row.scores.performance,
      lcpMs: row.metrics['largest-contentful-paint'],
      tbtMs: row.metrics['total-blocking-time'],
      evidence: row.evidence,
    })),
  byDevice,
  scope:
    'Fresh local Chromium and Lighthouse default mobile/desktop simulations. Not live PageSpeed, CrUX or physical-device evidence. Intentional noindex pages remain excluded from search indexing.',
};
writeFileSync(join(directory, 'statistics.json'), JSON.stringify(result, null, 2));
const csvCell = (value) => {
  let text = String(value ?? '');
  if (/^[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};
const csv = [
  [
    'Adres',
    'Cihaz',
    'Tekrar',
    'Performans',
    'Erişilebilirlik',
    'İyi Uygulamalar',
    'SEO',
    'LCP (ms)',
    'TBT (ms)',
    'CLS',
    'Tarih',
    'Lighthouse',
    'Sürüm',
    'Kanıt',
    'Çalıştırma Hatası',
  ],
  ...rows.map((row) => [
    row.path,
    row.device === 'mobile' ? 'Mobil' : 'Masaüstü',
    row.repeat,
    ...categories.map((category) => row.scores?.[category]),
    row.metrics?.['largest-contentful-paint'],
    row.metrics?.['total-blocking-time'],
    row.metrics?.['cumulative-layout-shift'],
    row.date,
    row.version,
    row.release.split('/').pop(),
    row.evidence,
    row.error,
  ]),
]
  .map((row) => row.map(csvCell).join(','))
  .join('\r\n');
writeFileSync(join(directory, 'sayfa-sonuclari.csv'), '\uFEFF' + csv + '\r\n');
const label = {
  performance: 'Performans',
  accessibility: 'Erişilebilirlik',
  'best-practices': 'İyi Uygulamalar',
  seo: 'SEO',
};
const lines = [
  'ULTRACLIPART — YEREL PERFORMANS ÖLÇÜM ÖZETİ',
  '',
  'Yayın yapılmadı. Bu belge yalnızca gerçekten çalıştırılan yerel ölçümleri içerir.',
  `Sürüm: ${plan.release.split('/').pop()} · Lighthouse ${plan.lighthouse}`,
  `Kapsam: ${plan.routes} ayrı adres, mobil ve masaüstü. Konu/koleksiyon sayfası: ${plan.subjects}.`,
  `Tamamlanan: ${successful.length}/${expected.size}. Çalıştırma hatası: ${errors.length}.`,
  ...(closed
    ? [
        `Kullanıcı yeterli örnekleme ulaşıldığını belirterek taramayı kapattı. Gerçek kapsam: ${new Set(successful.map((row) => row.path)).size} ayrı adres. Kalan adresler ölçülmüş veya başarılı sayılmadı.`,
      ]
    : []),
  `100 performans hedefi: ${result.performance100TargetMet ? 'Ölçülen tüm adreslerde karşılandı.' : complete || closed ? 'Tüm adreslerde karşılanmadı; düşük sonuçlar CSV ve HTML raporunda açıkça listelenmiştir.' : 'Tarama devam ediyor; tamamlandı olarak raporlanmadı.'}`,
  '',
];
for (const [device, data] of Object.entries(byDevice)) {
  lines.push(device === 'mobile' ? 'MOBİL' : 'MASAÜSTÜ');
  for (const [category, stats] of Object.entries(data.categories))
    lines.push(
      `${label[category]}: ${stats.minimum ?? '—'}–${stats.maximum ?? '—'}, ortanca ${stats.median ?? '—'}; 100 alan ${stats.perfect}/${data.measured}.`,
    );
  lines.push(
    `LCP ortanca: ${data.lcpMs.median === null ? '—' : (data.lcpMs.median / 1000).toFixed(2)} sn. TBT ortanca: ${data.tbtMs.median ?? '—'} ms. CLS ortanca: ${data.cls.median ?? '—'}.`,
    '',
  );
}
lines.push(
  'Kapsam açıklaması: Her URL için yeni Chrome işlemi kullanıldı. Bu sonuçlar canlı PageSpeed/CrUX veya fiziksel iPhone/Android ölçümü değildir. Kasıtlı noindex sayfaları arama motorlarına açılmadı. Statik denetim, etkileşim ve dosya çıktı testleri ayrı kanıtlardır. Tekrarlar varsa tümü korunur; en yüksek puan seçilmez.',
  '',
);
writeFileSync(join(directory, 'ozet.txt'), lines.join('\n'));
console.log(
  JSON.stringify({
    completed: successful.length,
    expected: expected.size,
    complete,
    targetMet: result.performance100TargetMet,
    byDevice,
  }),
);
