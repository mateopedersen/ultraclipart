// Public GETs only: no account cookies, forms, submissions or production writes.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { decodeHtml } from './image-seo.mjs';
const root = resolve(import.meta.dirname, '../..'),
  out = join(root, 'reports/linking');
const inventory = JSON.parse(readFileSync(join(out, 'external-inventory.json'), 'utf8'));
const manual = JSON.parse(
  readFileSync(join(root, 'data/external-link-reviews.json'), 'utf8'),
).reviews;
const report = { started: new Date().toISOString(), mode: 'read-only-public-GET', results: [] };
async function inspect(source) {
  const result = { ...source, checkedAt: new Date().toISOString(), redirects: [] };
  try {
    let url = source.url;
    for (let hop = 0; hop <= 7; hop++) {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(25000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; UltraClipartLinkAudit/1.0)',
          Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.5',
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.has('location')) {
        const target = new URL(response.headers.get('location'), url);
        if (target.protocol !== 'https:' || target.username || target.password)
          throw Error('Unsafe redirect target');
        result.redirects.push({ status: response.status, from: url, to: target.href });
        await response.body?.cancel();
        url = target.href;
        if (hop === 7) throw Error('Redirect limit exceeded');
        continue;
      }
      result.finalUrl = url;
      result.status = response.status;
      result.contentType = response.headers.get('content-type');
      const reader = response.body?.getReader(),
        chunks = [];
      let bytes = 0,
        complete = false;
      const fragment = decodeURIComponent(new URL(source.url).hash.slice(1));
      const limit = fragment ? 1048576 : 262144;
      if (reader) {
        while (bytes < limit) {
          const { done, value } = await reader.read();
          if (done) {
            complete = true;
            break;
          }
          chunks.push(value);
          bytes += value.byteLength;
        }
        await reader.cancel();
      }
      const body = Buffer.concat(chunks).toString('utf8');
      if (fragment && result.contentType?.includes('text/html')) {
        const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result.fragmentVerified = new RegExp(`\\b(?:id|name)=["']${escaped}["']`, 'i').test(body);
        result.fragmentBodyComplete = complete;
      }
      result.title = decodeHtml(body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);
      result.pdfSignature = result.contentType?.includes('application/pdf')
        ? body.startsWith('%PDF-')
        : undefined;
      const challenge =
        /just a moment|access denied|attention required|verify you are human|request rejected|403 forbidden/i.test(
          result.title,
        );
      const soft404 =
        /^404\b|page not found|page doesn.t exist|page can.t be found|error 404/i.test(
          result.title,
        );
      result.outcome =
        response.status === 404 || response.status === 410 || soft404
          ? 'broken'
          : challenge || [401, 403, 429].includes(response.status)
            ? 'verification-limited'
            : response.status === 200 && (result.title || result.pdfSignature)
              ? 'verified'
              : 'needs-review';
      if (
        fragment &&
        complete &&
        result.fragmentVerified === false &&
        result.outcome === 'verified'
      )
        result.outcome = 'broken';
      return result;
    }
  } catch (error) {
    result.outcome = 'verification-limited';
    result.error = error.message;
  }
  return result;
}
let cursor = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (cursor < inventory.length) {
      const source = inventory[cursor++];
      report.results.push(await inspect(source));
      console.log(
        `${report.results.length}/${inventory.length}: ${report.results.at(-1).outcome} ${source.url}`,
      );
    }
  }),
);
for (const result of report.results) {
  const review = manual[result.url];
  if (
    ['verification-limited', 'needs-review'].includes(result.outcome) &&
    review &&
    Date.now() - Date.parse(review.checkedAt) >= 0 &&
    Date.now() - Date.parse(review.checkedAt) < 30 * 86400000
  ) {
    result.sourceReview = review;
    result.resolution = 'official-content-reviewed';
  }
}
report.finished = new Date().toISOString();
report.results.sort((a, b) => a.url.localeCompare(b.url));
report.summary = Object.fromEntries(
  ['verified', 'broken', 'verification-limited', 'needs-review'].map((outcome) => [
    outcome,
    report.results.filter((r) => r.outcome === outcome).length,
  ]),
);
report.summary.officialContentReviewed = report.results.filter(
  (r) => r.resolution === 'official-content-reviewed',
).length;
report.summary.unresolved = report.results.filter(
  (r) => r.outcome !== 'verified' && !r.resolution,
).length;
writeFileSync(join(out, 'external-http.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary));
if (report.summary.broken) process.exitCode = 1;
