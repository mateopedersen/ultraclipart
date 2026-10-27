import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
const directory = resolve(process.env.LINK_BUILD_DIR || 'work/performance-build');
const report = { directory, subjects: 0, artwork: 0, failures: [] };
for (const section of ['clipart', 'art']) {
  for (const entry of readdirSync(join(directory, section), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const route = `/${section}/${entry.name}/`;
    const html = readFileSync(join(directory, section, entry.name, 'index.html'), 'utf8');
    if (section === 'clipart') {
      if (
        html.includes('class="gallery"') &&
        (!html.includes('Choose a design for your next idea') ||
          !html.includes('class="collection-gallery-count"'))
      )
        report.failures.push({
          route,
          error: 'Missing gallery heading or live illustration count.',
        });
      const related = html.indexOf('data-related-collections');
      if (related < 0) continue;
      report.subjects++;
      if (related < html.lastIndexOf('class="art-card') || !html.includes('class="gallery"'))
        report.failures.push({ route, error: 'Related collections precede artwork.' });
    } else {
      report.artwork++;
      if (
        !html.includes('src="/illustrations/actions/arrow-right-collection.svg"') ||
        html.includes('src="/illustrations/actions/arrow-right-dimensional.svg"')
      )
        report.failures.push({ route, error: 'Incorrect collection arrow.' });
      if (!html.includes('data-collection-discovery') || !html.includes('Explore this collection'))
        report.failures.push({ route, error: 'Missing permanent collection discovery section.' });
      if (!html.includes('data-collection-preview-id'))
        report.failures.push({ route, error: 'Missing real collection preview artwork.' });
    }
  }
}
mkdirSync('reports/collection-navigation', { recursive: true });
writeFileSync('reports/collection-navigation/built-layout.json', JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    subjects: report.subjects,
    artwork: report.artwork,
    failures: report.failures.length,
  }),
);
if (report.failures.length || !report.subjects || !report.artwork) process.exitCode = 1;
