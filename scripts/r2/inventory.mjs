// Enumerate every currently documented R2 jurisdiction; one S3 endpoint is not an account inventory.
// Reviewed against the Cloudflare R2 bucket-list API schema on 2026-10-23.
export const JURISDICTIONS = Object.freeze(['default', 'eu', 'us', 'fedramp', 'fedramp-high']);
export const SCOPE_VERSION = 'cloudflare-r2-2026-10-23';
export const jurisdictionOf = (value) => value.jurisdiction ?? 'default';
export const bucketIdentity = (name, jurisdiction = 'default') => `${jurisdiction}/${name}`;
export const objectIdentity = (object) =>
  `${bucketIdentity(object.bucket, jurisdictionOf(object))}/${object.key}`;
export function endpointFor(accountId, jurisdiction) {
  if (!/^[a-f0-9]{32}$/.test(accountId) || !JURISDICTIONS.includes(jurisdiction))
    throw new Error('Invalid R2 account or jurisdiction');
  return `https://${accountId}${jurisdiction === 'default' ? '' : `.${jurisdiction}`}.r2.cloudflarestorage.com`;
}
export function parseEndpoint(endpoint) {
  const match =
    /^https:\/\/([a-f0-9]{32})(?:\.(eu|us|fedramp|fedramp-high))?\.r2\.cloudflarestorage\.com$/.exec(
      endpoint ?? '',
    );
  if (!match) throw new Error('Set R2_ENDPOINT to a supported account S3 endpoint');
  return { accountId: match[1], jurisdiction: match[2] ?? 'default' };
}
export function validateInventoryScope(inventory) {
  if (
    inventory?.schemaVersion !== 2 ||
    inventory.scopeVersion !== SCOPE_VERSION ||
    !Array.isArray(inventory.jurisdictions) ||
    !Array.isArray(inventory.buckets)
  )
    throw new Error('Unknown all-jurisdiction inventory scope');
  const required = new Set(JURISDICTIONS),
    roster = new Set();
  for (const scope of inventory.jurisdictions) {
    if (
      !required.delete(scope.jurisdiction) ||
      scope.complete !== true ||
      scope.endpoint !== endpointFor(inventory.accountId, scope.jurisdiction) ||
      !Array.isArray(scope.buckets)
    )
      throw new Error('Incomplete, duplicate or mismatched jurisdiction scope');
    if (
      ![
        's3-list-buckets',
        'cloudflare-api-list-buckets',
        'cloudflare-api-empty',
        'cloudflare-entitlement-disabled',
      ].includes(scope.proof?.source)
    )
      throw new Error('Missing jurisdiction enumeration proof');
    if (
      scope.proof.source === 'cloudflare-entitlement-disabled' &&
      (!['fedramp', 'fedramp-high'].includes(scope.jurisdiction) ||
        scope.buckets.length ||
        scope.proof.accountId !== inventory.accountId ||
        scope.proof.jurisdiction !== scope.jurisdiction ||
        scope.proof.entitlementKey !== 'r2.fedramp' ||
        scope.proof.allocated !== false ||
        scope.proof.endpoint !==
          `https://api.cloudflare.com/client/v4/accounts/${inventory.accountId}/entitlements` ||
        !Number.isFinite(scope.proof.observedAt) ||
        scope.proof.observedAt < inventory.observedAt ||
        scope.proof.observedAt - inventory.observedAt > 60000)
    )
      throw new Error('Invalid disabled-jurisdiction capability proof');
    if (
      scope.proof.source === 'cloudflare-api-empty' &&
      (scope.buckets.length ||
        scope.proof.totalCount !== 0 ||
        scope.proof.accountId !== inventory.accountId ||
        scope.proof.jurisdiction !== scope.jurisdiction)
    )
      throw new Error('Invalid empty-jurisdiction proof');
    for (const name of scope.buckets) {
      const id = bucketIdentity(name, scope.jurisdiction);
      if (!name || roster.has(id)) throw new Error('Duplicate or invalid scoped bucket');
      roster.add(id);
    }
  }
  if (required.size) throw new Error('Incomplete jurisdiction coverage');
  for (const bucket of inventory.buckets)
    if (!roster.delete(bucketIdentity(bucket.name, jurisdictionOf(bucket))))
      throw new Error('Bucket outside verified jurisdiction roster');
  if (roster.size) throw new Error('Missing bucket from verified jurisdiction roster');
}

export async function proveEmptyJurisdiction({ accountId, jurisdiction, token, fetcher = fetch }) {
  if (!token)
    throw new Error(
      `Cannot prove ${jurisdiction} absent: set R2_ACCOUNT_READ_TOKEN with account R2 Storage Read permission`,
    );
  endpointFor(accountId, jurisdiction);
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets?per_page=1000`;
  let response, data;
  try {
    response = await fetcher(url, {
      headers: { Authorization: `Bearer ${token}`, 'cf-r2-jurisdiction': jurisdiction },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    data = await response.json();
  } catch {
    throw new Error(
      `Read-only absence verification failed for ${jurisdiction}; credential-bearing output suppressed`,
    );
  }
  if (
    response.status !== 200 ||
    data.success !== true ||
    !Array.isArray(data.errors) ||
    data.errors.length ||
    !Array.isArray(data.result?.buckets) ||
    data.result.buckets.length ||
    data.result_info?.total_count !== 0 ||
    data.result_info?.cursor
  )
    throw new Error(
      `Cannot prove ${jurisdiction} empty; denied, partial, unknown or nonempty scopes block uploads`,
    );
  return {
    source: 'cloudflare-api-empty',
    accountId,
    jurisdiction,
    totalCount: 0,
    observedAt: Date.now(),
    endpoint: url,
  };
}

export async function measureAccount({
  endpoint,
  batch,
  aws,
  proveAbsent,
  now = Date.now,
  enumerationSource = 's3-list-buckets',
}) {
  if (!['s3-list-buckets', 'cloudflare-api-list-buckets'].includes(enumerationSource))
    throw new Error('Unknown bucket enumeration transport');
  const { accountId } = parseEndpoint(endpoint);
  const observedAt = now(),
    jurisdictions = [],
    buckets = [];
  for (const jurisdiction of JURISDICTIONS) {
    const scopeEndpoint = endpointFor(accountId, jurisdiction);
    const names = [],
      seenNames = new Set(),
      seenBucketTokens = new Set();
    let bucketToken,
      expectedBucketCount,
      proof = { source: enumerationSource };
    try {
      do {
        const page = await aws(
          'list-buckets',
          ['--no-paginate', ...(bucketToken ? ['--continuation-token', bucketToken] : [])],
          scopeEndpoint,
        );
        if (!Array.isArray(page.Buckets)) throw new Error('Missing bucket enumeration');
        if (page.TotalCount !== undefined) {
          if (
            !Number.isSafeInteger(page.TotalCount) ||
            page.TotalCount < 0 ||
            (expectedBucketCount !== undefined && expectedBucketCount !== page.TotalCount)
          )
            throw new Error('Bucket count changed or is invalid');
          expectedBucketCount = page.TotalCount;
        }
        for (const bucket of page.Buckets) {
          if (!bucket.Name || seenNames.has(bucket.Name))
            throw new Error('Duplicate or invalid bucket listing');
          seenNames.add(bucket.Name);
          names.push(bucket.Name);
        }
        bucketToken = page.ContinuationToken ?? page.NextContinuationToken;
        if (
          (page.IsTruncated === true && !bucketToken) ||
          (bucketToken && (typeof bucketToken !== 'string' || seenBucketTokens.has(bucketToken)))
        )
          throw new Error('Incomplete or looping bucket enumeration');
        if (bucketToken) seenBucketTokens.add(bucketToken);
      } while (bucketToken);
      if (expectedBucketCount !== undefined && names.length !== expectedBucketCount)
        throw new Error('Incomplete bucket roster');
    } catch {
      // A failure or permission denial is never evidence that a jurisdiction is empty.
      if (!proveAbsent || names.length)
        throw new Error(`Cannot inventory ${jurisdiction}; all-jurisdiction occupancy is unknown`);
      proof = await proveAbsent(accountId, jurisdiction);
      if (
        !['cloudflare-api-empty', 'cloudflare-entitlement-disabled'].includes(proof?.source) ||
        (proof.source === 'cloudflare-api-empty' && proof.totalCount !== 0) ||
        proof.accountId !== accountId ||
        proof.jurisdiction !== jurisdiction
      )
        throw new Error('Invalid live absence proof');
    }
    for (const name of names) {
      const objects = [],
        seenTokens = new Set();
      let token;
      do {
        const page = await aws(
          'list-objects-v2',
          [
            '--bucket',
            name,
            '--max-keys',
            '1000',
            '--no-paginate',
            ...(token ? ['--continuation-token', token] : []),
          ],
          scopeEndpoint,
        );
        if (page.IsTruncated !== true && page.IsTruncated !== false)
          throw new Error('Uncertain bucket pagination');
        if (page.Contents !== undefined && !Array.isArray(page.Contents))
          throw new Error('Invalid object inventory');
        const entries = page.Contents ?? [];
        // Read-only hash checks are independent. Bound concurrency to four so
        // resumed waves fit the freshness window without a request burst.
        for (let offset = 0; offset < entries.length; offset += 4) {
          const measured = await Promise.all(
            entries.slice(offset, offset + 4).map(async (entry) => {
              const object = { key: entry.Key, bytes: entry.Size };
              if (
                batch.some(
                  (candidate) =>
                    jurisdictionOf(candidate) === jurisdiction &&
                    candidate.bucket === name &&
                    candidate.key === entry.Key,
                )
              )
                object.sha256 = (
                  await aws('head-object', ['--bucket', name, '--key', entry.Key], scopeEndpoint)
                ).Metadata?.sha256;
              return object;
            }),
          );
          objects.push(...measured);
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
        if (page.IsTruncated && (!token || typeof token !== 'string' || seenTokens.has(token)))
          throw new Error('Incomplete or looping bucket pagination');
        if (token) seenTokens.add(token);
      } while (token);
      buckets.push({ name, jurisdiction, complete: true, objects });
    }
    jurisdictions.push({
      jurisdiction,
      endpoint: scopeEndpoint,
      complete: true,
      buckets: names,
      proof,
    });
  }
  const inventory = {
    schemaVersion: 2,
    scopeVersion: SCOPE_VERSION,
    accountId,
    complete: true,
    observedAt,
    jurisdictions,
    buckets,
  };
  validateInventoryScope(inventory);
  return inventory;
}
