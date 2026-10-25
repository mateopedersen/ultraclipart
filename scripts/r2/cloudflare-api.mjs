import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseEndpoint } from './inventory.mjs';
import { setTimeout as delay } from 'node:timers/promises';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
/** Credentials stay in memory; neither configuration nor API errors print them. */
export function configuredToken(env = process.env, now = Date.now()) {
  if (env.CLOUDFLARE_API_TOKEN) return env.CLOUDFLARE_API_TOKEN;
  if (!env.WRANGLER_AUTH_FILE)
    throw new Error(
      'Set CLOUDFLARE_API_TOKEN or WRANGLER_AUTH_FILE; never pass tokens as CLI arguments',
    );
  const config = readFileSync(env.WRANGLER_AUTH_FILE, 'utf8');
  const expiry = config.match(/^expiration_time\s*=\s*"([^"]+)"/m)?.[1];
  const token = config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
  if (
    !token ||
    !expiry ||
    !Number.isFinite(Date.parse(expiry)) ||
    Date.parse(expiry) <= now + 60_000
  )
    throw new Error(
      'Existing Wrangler login is missing or expires soon; refresh it with Wrangler before ingestion',
    );
  return token;
}

/** Official Cloudflare REST transport for small, serial production waves.
 * The same account-wide planner/checksum journal governs both CLI transports.
 * No delete, bucket mutation, billing change or arbitrary API path is exposed. */
export function cloudflareTransport({
  accountId,
  token,
  writeBucket,
  fetcher = fetch,
  now = Date.now,
  requestIntervalMs = 0,
}) {
  if (!/^[a-f0-9]{32}$/.test(accountId) || !token)
    throw new Error('Invalid Cloudflare authentication configuration');
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
  if (!Number.isSafeInteger(requestIntervalMs) || requestIntervalMs < 0)
    throw new Error('Invalid REST request interval');
  let nextRequestAt = 0;
  // A SHA is reusable only for an exact version seen in a fresh object list.
  // Never trust a filename or user-supplied SHA metadata as content verification.
  const listedVersions = new Map(),
    verifiedVersions = new Map(),
    startAfterTokens = new Map();
  let cachedBytes = 0;
  const etag = (value) => (typeof value === 'string' ? value.replace(/^"|"$/g, '') : '');
  const version = (tag, size) => (tag && Number.isSafeInteger(size) ? `${tag}:${size}` : null);
  const value = (args, name) => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args[i + 1];
  };
  async function request(path, jurisdiction, options = {}) {
    const readOnly = !options.method || ['GET', 'HEAD'].includes(options.method);
    for (let attempt = 0; attempt < 8; attempt++) {
      // Reserve a slot synchronously before yielding so concurrent format transfers
      // share one conservative REST pace, including retry attempts and inventory.
      const slot = Math.max(Date.now(), nextRequestAt);
      nextRequestAt = slot + requestIntervalMs;
      if (slot > Date.now()) await delay(slot - Date.now());
      let response;
      try {
        response = await fetcher(base + path, {
          ...options,
          headers: {
            Authorization: `Bearer ${token}`,
            'cf-r2-jurisdiction': jurisdiction,
            ...options.headers,
          },
          redirect: 'error',
          signal: AbortSignal.timeout(30000),
        });
      } catch {
        if (readOnly && attempt < 2) {
          await delay(250 * 4 ** attempt);
          continue;
        }
        throw new Error('Cloudflare R2 request failed; credential-bearing output suppressed');
      }
      if (
        (response.status === 429 ||
          (readOnly && (response.status === 408 || response.status >= 500))) &&
        attempt < 7
      ) {
        await response.body?.cancel();
        const retryAfter = response.headers.get('retry-after');
        const seconds = Number(retryAfter);
        const requestedDelay = retryAfter
          ? Number.isFinite(seconds)
            ? seconds * 1000
            : Date.parse(retryAfter) - Date.now()
          : 0;
        // A 429 explicitly rejects the operation: replay the same conditional request.
        // Other write failures remain non-retriable because their outcome is unknown.
        await delay(Math.min(120000, Math.max(1000 * 2 ** attempt, requestedDelay || 0)));
        continue;
      }
      if (!response.ok)
        throw new Error(
          `Cloudflare R2 request failed (HTTP ${response.status}); occupancy or upload is unverified`,
        );
      return response;
    }
  }
  async function json(path, jurisdiction, options) {
    const response = await request(path, jurisdiction, options);
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Invalid Cloudflare R2 JSON response');
    }
    if (data.success !== true || !Array.isArray(data.errors) || data.errors.length)
      throw new Error('Cloudflare R2 did not confirm a successful operation');
    return data;
  }
  async function disabledProof(requestedAccount, jurisdiction) {
    if (requestedAccount !== accountId || !['fedramp', 'fedramp-high'].includes(jurisdiction))
      throw new Error('An inaccessible enabled jurisdiction must block ingestion');
    // A 403/400 is not absence evidence. Independently require the account's
    // explicit, current parent FedRAMP feature allocation to be boolean false.
    const data = await json('/entitlements', 'default');
    if (!Array.isArray(data.result)) throw new Error('Unknown account entitlement response');
    const features = data.result.filter((row) => row.feature?.key === 'r2.fedramp');
    if (
      features.length !== 1 ||
      features[0].allocation?.type !== 'bool' ||
      features[0].allocation.value !== false ||
      features[0].deleted_date
    )
      throw new Error('FedRAMP is enabled or unknown; its bucket inventory must be measured');
    return {
      source: 'cloudflare-entitlement-disabled',
      accountId,
      jurisdiction,
      entitlementKey: 'r2.fedramp',
      allocated: false,
      endpoint: base + '/entitlements',
      observedAt: now(),
    };
  }
  async function aws(command, args, endpoint) {
    const target = parseEndpoint(endpoint);
    if (target.accountId !== accountId) throw new Error('Account mismatch');
    const jurisdiction = target.jurisdiction;
    const query = new URLSearchParams({ per_page: '1000' });
    const cursor = value(args, '--continuation-token');
    if (cursor) query.set('cursor', cursor);
    if (command === 'list-buckets') {
      const page = await json('/r2/buckets?' + query, jurisdiction);
      if (
        !Array.isArray(page.result?.buckets) ||
        !Number.isSafeInteger(page.result_info?.total_count)
      )
        throw new Error('Missing bucket enumeration count');
      const next = page.result_info.cursor;
      if (!next && page.result.buckets.length >= 1000 && page.result_info.total_count > 1000)
        throw new Error('Incomplete bucket pagination');
      if (page.result.buckets.some((b) => b.jurisdiction && b.jurisdiction !== jurisdiction))
        throw new Error('Bucket jurisdiction mismatch');
      return {
        Buckets: page.result.buckets.map((bucket) => ({ Name: bucket.name })),
        NextContinuationToken: next,
        TotalCount: page.result_info.total_count,
      };
    }
    const bucket = value(args, '--bucket');
    if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(bucket ?? ''))
      throw new Error('Invalid R2 bucket name');
    const objectsPath = `/r2/buckets/${bucket}/objects`;
    if (command === 'list-objects-v2') {
      const fallback = startAfterTokens.get(cursor);
      if (fallback) {
        if (fallback.bucket !== bucket || fallback.jurisdiction !== jurisdiction)
          throw new Error('Object continuation scope mismatch');
        query.delete('cursor');
        query.set('start_after', fallback.key);
      }
      if (!cursor)
        for (const identity of listedVersions.keys())
          if (identity.startsWith(`${jurisdiction}/${bucket}/`)) listedVersions.delete(identity);
      const page = await json(objectsPath + '?' + query, jurisdiction);
      if (!Array.isArray(page.result) || page.result_info?.delimited?.length)
        throw new Error('Invalid or grouped object enumeration');
      let next = page.result_info?.cursor;
      if (page.result_info?.is_truncated === true && !next)
        throw new Error('Incomplete object pagination');
      if (fallback || (!next && page.result.length >= 1000)) {
        let previous = fallback?.key;
        for (const object of page.result) {
          if (
            typeof object.key !== 'string' ||
            !object.key ||
            (previous && Buffer.compare(Buffer.from(object.key), Buffer.from(previous)) <= 0)
          )
            throw new Error('Object pagination did not advance in key order');
          previous = object.key;
        }
      }
      // R2 can omit result_info on an exactly full terminal page. Never infer
      // completion from that ambiguity: probe after the last key using the
      // documented start_after parameter, and enumerate any remaining objects.
      if (!next && page.result.length >= 1000 && page.result_info?.is_truncated !== false) {
        const key = page.result.at(-1).key;
        next = `uc-start-after:${digest(Buffer.from(`${jurisdiction}/${bucket}/${key}`))}`;
        startAfterTokens.set(next, { key, bucket, jurisdiction });
      }
      for (const object of page.result)
        listedVersions.set(
          `${jurisdiction}/${bucket}/${object.key}`,
          version(etag(object.etag), object.size),
        );
      return {
        IsTruncated: !!next,
        NextContinuationToken: next,
        Contents: page.result.map((object) => ({ Key: object.key, Size: object.size })),
      };
    }
    const key = value(args, '--key');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]+$/.test(key ?? '') || key.includes('..'))
      throw new Error('Invalid R2 object key');
    // API contract requires literal slashes, not %2F, in object keys.
    const path = objectsPath + '/' + key.split('/').map(encodeURIComponent).join('/');
    if (command === 'get-object' || command === 'head-object') {
      const identity = `${jurisdiction}/${bucket}/${key}`;
      const listed = listedVersions.get(identity),
        verified = verifiedVersions.get(identity);
      if (listed && verified?.version === listed) {
        if (command === 'head-object') return { Metadata: { sha256: verified.sha256 } };
        if (verified.bytes) {
          const destination = args[args.indexOf('--key') + 2];
          if (!destination || destination.startsWith('--'))
            throw new Error('Missing verification destination');
          writeFileSync(destination, verified.bytes, { mode: 0o600 });
          return {};
        }
      }
      let response, bytes;
      for (let attempt = 0; attempt < 3; attempt++) {
        response = await request(path, jurisdiction);
        if (!response.body || Number(response.headers.get('Content-Length')) > 16_000_000)
          throw new Error('R2 verification object exceeds the allowed bound or is empty');
        const reader = response.body.getReader(),
          chunks = [];
        let size = 0;
        try {
          while (true) {
            const { value: chunk, done } = await reader.read();
            if (done) break;
            size += chunk.byteLength;
            if (size > 16_000_000) {
              await reader.cancel();
              throw new Error('R2 verification object exceeds the allowed bound');
            }
            chunks.push(Buffer.from(chunk));
          }
        } catch (error) {
          if (
            (error instanceof TypeError || ['TimeoutError', 'AbortError'].includes(error?.name)) &&
            attempt < 2
          ) {
            await delay(250 * 4 ** attempt);
            continue;
          }
          throw error;
        } finally {
          reader.releaseLock();
        }
        bytes = Buffer.concat(chunks, size);
        break;
      }
      const sha256 = digest(bytes),
        observedVersion = version(etag(response.headers.get('ETag')), bytes.length);
      if (observedVersion) {
        cachedBytes -= verifiedVersions.get(identity)?.bytes?.length ?? 0;
        const reusable = cachedBytes + bytes.length <= 64_000_000 ? bytes : null;
        cachedBytes += reusable?.length ?? 0;
        verifiedVersions.set(identity, { version: observedVersion, sha256, bytes: reusable });
      }
      if (command === 'head-object') return { Metadata: { sha256 } };
      const destination = args[args.indexOf('--key') + 2];
      if (!destination || destination.startsWith('--'))
        throw new Error('Missing verification destination');
      writeFileSync(destination, bytes, { mode: 0o600 });
      return {};
    }
    if (command !== 'put-object') throw new Error('Unsupported R2 operation');
    if (
      !writeBucket ||
      bucket !== writeBucket ||
      value(args, '--if-none-match') !== '*' ||
      value(args, '--storage-class') !== 'STANDARD'
    )
      throw new Error(
        'Only conditional Standard uploads to the explicitly configured project bucket are allowed',
      );
    const bytes = readFileSync(value(args, '--body'));
    const metadata = JSON.parse(value(args, '--metadata') ?? '{}');
    if (metadata.sha256 !== digest(bytes) || !key.includes(metadata.sha256.slice(0, 12)))
      throw new Error('Upload snapshot checksum mismatch');
    const identity = `${jurisdiction}/${bucket}/${key}`;
    listedVersions.delete(identity);
    cachedBytes -= verifiedVersions.get(identity)?.bytes?.length ?? 0;
    verifiedVersions.delete(identity);
    const headers = {
      'Content-Type': value(args, '--content-type'),
      'Cache-Control': value(args, '--cache-control'),
      'If-None-Match': '*',
      'cf-r2-storage-class': 'Standard',
    };
    if (value(args, '--content-disposition'))
      headers['Content-Disposition'] = value(args, '--content-disposition');
    const result = await json(path, jurisdiction, { method: 'PUT', headers, body: bytes });
    if (
      result.result?.key !== key ||
      Number(result.result?.size) !== bytes.length ||
      result.result?.storage_class !== 'Standard'
    )
      throw new Error('Upload response differs from the immutable snapshot');
    return result.result;
  }
  return { aws, proveAbsent: disabledProof, enumerationSource: 'cloudflare-api-list-buckets' };
}
