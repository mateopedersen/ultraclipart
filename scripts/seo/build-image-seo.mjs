import { resolve } from 'node:path';
import { buildImageMetadata } from './image-seo.mjs';
import { auditImageSeo } from './audit-image-seo.mjs';
import { readPublication } from '../publication-policy.mjs';
import { auditLinkGraph } from './audit-link-graph.mjs';
import { auditCoreSeo } from './audit-core-seo.mjs';
import { readReviewedImportCatalog } from '../reviewed-imports.mjs';
const root = resolve(import.meta.dirname, '../..');
const options = {
  root,
  directory: resolve(process.argv[2] || 'dist'),
  catalog: readReviewedImportCatalog(root),
  publishedAssets: process.env.CF_PAGES === '1' ? readPublication(root).assetUrls : null,
};
buildImageMetadata(options);
auditImageSeo(options);
auditLinkGraph(options);
auditCoreSeo(options);
