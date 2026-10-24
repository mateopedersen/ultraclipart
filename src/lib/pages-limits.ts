// Cloudflare upload-token entitlement verified for UltraClipart on 2026-10-24.
export const PAGES_FILE_LIMIT = 100_000;

export function assertPagesFileCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error('Pages file count must be a non-negative safe integer.');
  if (count > PAGES_FILE_LIMIT)
    throw new Error(`Pages Pro file limit exceeded: ${count} files (limit ${PAGES_FILE_LIMIT}).`);
}
