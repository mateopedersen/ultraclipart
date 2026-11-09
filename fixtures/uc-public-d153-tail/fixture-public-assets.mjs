import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  realpathSync,
  linkSync,
  copyFileSync,
  chmodSync,
} from 'node:fs';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function linkFixtureCatalog(publicDir, outDir, entries) {
  const source = resolve(publicDir, 'catalog');
  const output = resolve(outDir, 'catalog');
  const relation = relative(source, output);
  if (!relation || (!isAbsolute(relation) && relation !== '..' && !relation.startsWith('..' + sep)))
    throw Error('Fixture output must be outside source originals');
  const expected = new Map(entries.map((file) => [file.path.replace(/^\/+/, ''), file]));
  if (
    expected.size !== entries.length ||
    [...expected.keys()].some((p) => !p.startsWith('catalog/'))
  )
    throw Error('Require the complete, collision-free catalog media manifest');
  let linkedFiles = 0,
    linkedBytes = 0,
    otherFiles = 0;
  function copy(directory, destination) {
    mkdirSync(destination, { recursive: true });
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      if (item.isSymbolicLink()) throw Error('Fixture assets must not be symlinks');
      const from = join(directory, item.name),
        to = join(destination, item.name);
      if (item.isDirectory()) copy(from, to);
      else if (item.isFile()) {
        const key = 'catalog/' + relative(source, from).split(sep).join('/');
        const record = expected.get(key);
        if (record) {
          if (statSync(from).size !== record.bytes) throw Error('Original media size mismatch');
          linkSync(from, to);
          chmodSync(from, 0o444);
          const a = statSync(from),
            b = statSync(to);
          if (a.dev !== b.dev || a.ino !== b.ino)
            throw Error('Immutable fixture link not established');
          linkedFiles++;
          linkedBytes += a.size;
        } else {
          copyFileSync(from, to);
          otherFiles++;
        }
      } else throw Error('Unsupported fixture asset');
    }
  }
  copy(source, output);
  if (linkedFiles !== expected.size) throw Error('Incomplete immutable media fixture');
  return {
    linkedFiles,
    linkedBytes,
    otherFiles,
    storage: 'Same bytes/inode, not an independent backup',
  };
}

export function fixturePublicAssets() {
  let publicDir, root;
  return {
    name: 'private-test-fixture:shared-immutable-public-media',
    hooks: {
      'astro:config:done': ({ config }) => {
        publicDir = fileURLToPath(config.publicDir);
        root = fileURLToPath(config.root);
      },
      'astro:build:setup': async ({ vite, updateConfig }) => {
        const outDir = vite.environments?.client?.build?.outDir;
        if (!publicDir || !root || typeof outDir !== 'string')
          throw Error('Missing fixture output');
        updateConfig({
          environments: { client: { build: { copyPublicDir: false, emptyOutDir: false } } },
        });
        const { copyPublicInterfaceAssets } = await import(
          pathToFileURL(join(root, 'scripts/production-public-assets.mjs')).href
        );
        const { validateManifest } = await import(
          pathToFileURL(join(root, 'scripts/publication-policy.mjs')).href
        );
        const manifest = JSON.parse(readFileSync(join(root, 'data/publication.json'), 'utf8'));
        validateManifest(manifest);
        const ui = copyPublicInterfaceAssets(publicDir, outDir);
        const media = linkFixtureCatalog(publicDir, outDir, manifest.files);
        const reportDir = join(root, 'reports/private-tail');
        mkdirSync(reportDir, { recursive: true });
        writeFileSync(
          join(reportDir, 'fixture-copy.json'),
          JSON.stringify(
            {
              publicRoot: realpathSync(publicDir),
              outputRoot: realpathSync(outDir),
              ui,
              media,
              allOriginalMediaRetained: true,
              applicationTransformsChanged: false,
              note: 'Only immutable file-copy storage is adapted. Every normal SEO, link, header and build gate remains enabled. Full source/output bytes are verified after build and after tests.',
            },
            null,
            2,
          ) + '\n',
        );
        console.log(JSON.stringify({ privateFixtureImmutableMedia: media, interfaceAssets: ui }));
      },
    },
  };
}
