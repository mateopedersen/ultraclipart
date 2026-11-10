// Node 24 strips erasable TS; preserve the site's extensionless local imports.
// This resolves one requested module at a time. It never compiles site pages.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      const r = nextResolve(specifier, context);
      return r.url.endsWith('.json')
        ? { ...r, importAttributes: { ...context.importAttributes, type: 'json' } }
        : r;
    } catch (error) {
      if (
        error.code !== 'ERR_MODULE_NOT_FOUND' ||
        !/^\.{1,2}\//.test(specifier) ||
        !context.parentURL?.startsWith('file:')
      )
        throw error;
      const url = new URL(specifier, context.parentURL);
      for (const suffix of ['.ts', '.mjs', '.js', '/index.ts']) {
        const candidate = new URL(url.href + suffix);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
      throw error;
    }
  },
});
