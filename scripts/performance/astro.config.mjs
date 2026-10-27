// Build the real production templates without copying 19 GB of unchanged originals.
// The loopback audit server serves those exact source bytes from public/.
import config from '../../astro.config.mjs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export default {
  ...config,
  publicDir: fileURLToPath(new URL('../../work/performance-public/', import.meta.url)),
  // Even direct Astro invocations must never erase the currently served release.
  outDir: process.env.UC_PERFORMANCE_OUT_DIR
    ? resolve(process.env.UC_PERFORMANCE_OUT_DIR)
    : fileURLToPath(new URL('../../work/performance-staging/', import.meta.url)),
};
