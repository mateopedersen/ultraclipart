import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8').match(
  /Content-Security-Policy:\s*([^\n]+)/,
)[1];
/** Controlled local browser fixture using the same policy and inline-hash rules
 * as the production generator. It does not verify deployed response headers. */
export async function installProductionCsp(page) {
  await page.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.resourceType() !== 'document' || !['127.0.0.1', 'localhost'].includes(url.hostname))
      return route.fallback();
    const response = await route.fetch(),
      body = await response.text(),
      hashes = new Set();
    for (const match of body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (
        /\bsrc\s*=/.test(match[1]) ||
        /type="application\/(?:ld\+)?json"/.test(match[1]) ||
        !match[2].trim()
      )
        continue;
      hashes.add(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
    }
    let policy = base.replace(
      "script-src 'self' 'wasm-unsafe-eval';",
      `script-src 'self' 'wasm-unsafe-eval' ${[...hashes].join(' ')};`,
    );
    if (
      url.pathname === '/create/' ||
      url.pathname.startsWith('/edit/') ||
      url.pathname === '/ai-clipart-generator/'
    )
      policy =
        policy
          .replace("script-src 'self'", "script-src 'self' https://challenges.cloudflare.com")
          .replace("connect-src 'self'", "connect-src 'self' https://challenges.cloudflare.com") +
        "; frame-src https://challenges.cloudflare.com; worker-src 'self'";
    await route.fulfill({
      status: response.status(),
      contentType: 'text/html; charset=utf-8',
      headers: { 'Content-Security-Policy': policy },
      body,
    });
  });
}
