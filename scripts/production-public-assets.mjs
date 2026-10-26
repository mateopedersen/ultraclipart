import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Copy interface assets without traversing the R2-backed catalog, including drafts. */
export function copyPublicInterfaceAssets(publicDir, outDir) {
  const source = resolve(publicDir),
    output = resolve(outDir);
  const nested = relative(source, output);
  if (!nested || (!isAbsolute(nested) && nested !== '..' && !nested.startsWith(`..${sep}`)))
    throw Error('Build output must stay outside public assets');
  let files = 0,
    bytes = 0;
  function copy(directory, destination, topLevel = false) {
    mkdirSync(destination, { recursive: true });
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      // Skip before inspecting or following anything inside the catalog. Source
      // originals remain available to local editors and build-time image audits.
      if (topLevel && entry.name === 'catalog') continue;
      const from = join(directory, entry.name),
        to = join(destination, entry.name);
      if (entry.isSymbolicLink()) throw Error('Public interface assets must not be symlinks');
      if (entry.isDirectory()) copy(from, to);
      else if (entry.isFile()) {
        copyFileSync(from, to);
        files++;
        bytes += statSync(from).size;
      } else throw Error('Unsupported public interface asset');
    }
  }
  copy(source, output, true);
  return { files, bytes };
}

/** Astro 7 copies public/ in its client environment, after the server build. */
export function productionPublicAssets(enabled) {
  let publicDir;
  return {
    name: 'ultraclipart:production-public-assets',
    hooks: {
      'astro:config:done': ({ config }) => {
        publicDir = fileURLToPath(config.publicDir);
      },
      'astro:build:setup': ({ vite, updateConfig }) => {
        if (!enabled) return;
        const outDir = vite.environments?.client?.build?.outDir;
        if (!publicDir || typeof outDir !== 'string')
          throw Error('Production public assets require the Astro client output directory');
        updateConfig({
          environments: {
            client: {
              build: {
                copyPublicDir: false,
                emptyOutDir: false,
              },
            },
          },
        });
        // Copy before rendering, preserving Astro's normal generated-file precedence.
        const copied = copyPublicInterfaceAssets(publicDir, outDir);
        console.log(
          `Production interface assets: ${copied.files} files, ${copied.bytes} bytes; catalog stays in R2.`,
        );
      },
    },
  };
}
