import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Catalog media is served only by the checked R2 release in production. Local
// imports may contain an unfinished next wave, so none may hitchhike in dist.
export function pruneCatalogOutput(dist) {
  rmSync(join(resolve(dist), 'catalog'), { recursive: true, force: true });
}
