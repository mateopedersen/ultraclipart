import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.UC_BROWSER_PATH ? { executablePath: process.env.UC_BROWSER_PATH } : {}),
});
const page = await browser.newPage({ acceptDownloads: true });
const root = new URL('../work/editor-evidence/catalog/', import.meta.url);
await fs.mkdir(root, { recursive: true });
const art = JSON.parse(await fs.readFile(new URL('../data/art.json', import.meta.url), 'utf8'));
const report = [];
try {
  await page.route('**/__editor-export-test.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html lang=\"en\"><body></body></html>',
    }),
  );
  await page.goto('http://127.0.0.1:4321/__editor-export-test.html');
  for (const item of art) {
    for (const format of ['pdf', 'webp']) {
      console.log('export', item.id, format);
      const result = await page.evaluate(
        async ({ item, format }) => {
          const { fromSvg, preset, renderWebp } = await import('/src/editor/svg.ts');
          const { exportPdf } = await import('/src/editor/pdf.ts');
          const d = fromSvg(await (await fetch(item.svg)).text(), item.id);
          d.layers[0].x = 12;
          d.layers[0].angle = 4;
          d.layers[0].opacity = 0.65;
          d.layers.at(-1).visible = false;
          preset(d.layers[0], 'pastel');
          const blob = format === 'pdf' ? await exportPdf(d) : await renderWebp(d, 1024, 0.95);
          return {
            data: Array.from(new Uint8Array(await blob.arrayBuffer())),
            id: item.id,
            format,
            bytes: blob.size,
            layers: d.layers.length,
            transformed: true,
            opacity: 0.65,
            hiddenLayer: d.layers.at(-1).id,
          };
        },
        { item, format },
      );
      const { data, ...metadata } = result;
      await fs.writeFile(new URL(`${item.id}-edited.${format}`, root), Buffer.from(data));
      report.push(metadata);
    }
  }
  await fs.writeFile(
    new URL('report.json', root),
    JSON.stringify({ status: 'PASS', items: report }, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: report.length,
      subjects: art.length,
      maxPdfBytes: Math.max(...report.filter((r) => r.format === 'pdf').map((r) => r.bytes)),
    }),
  );
} finally {
  await browser.close();
}
