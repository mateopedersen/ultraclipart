export const SEO_SITE = 'https://ultraclipart.com/';
export const ORGANIZATION_ID = SEO_SITE + '#organization';
export const WEBSITE_ID = SEO_SITE + '#website';

type PageOptions = {
  canonical: string;
  title: string;
  description: string;
  noindex?: boolean;
  primaryImage?: string;
};

/** Public page facts only. No private project, search query or user information. */
export function pageGraph(options: PageOptions) {
  const canonical = new URL(options.canonical);
  if (canonical.origin !== new URL(SEO_SITE).origin || canonical.search || canonical.hash)
    throw Error('Page metadata requires a clean canonical site URL');
  const organization = {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'UltraClipart',
    url: SEO_SITE,
    logo: new URL('favicon-192.png', SEO_SITE).href,
    email: 'ultraclipart@gmail.com',
  };
  const website = {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: 'UltraClipart',
    url: SEO_SITE,
    inLanguage: 'en-US',
    publisher: { '@id': ORGANIZATION_ID },
  };
  const page = {
    '@type': 'WebPage',
    '@id': canonical.href + '#webpage',
    url: canonical.href,
    name: options.title,
    description: options.description,
    inLanguage: 'en-US',
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORGANIZATION_ID },
    ...(options.primaryImage
      ? { primaryImageOfPage: new URL(options.primaryImage, SEO_SITE).href }
      : {}),
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [organization, website, ...(!options.noindex ? [page] : [])],
  };
}
