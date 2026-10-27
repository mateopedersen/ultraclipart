import content from '../../data/trust-pages.json';

export interface TrustLink {
  label: string;
  href: string;
}
export interface TrustQuestion {
  question: string;
  answer: string[];
}
export interface TrustSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
  questions?: TrustQuestion[];
  links?: TrustLink[];
}
export type TrustSymbol =
  'license' | 'privacy' | 'terms' | 'copyright' | 'accessibility' | 'faq' | 'editorial';
export interface TrustPage {
  title: string;
  description: string;
  intro: string;
  symbol: TrustSymbol;
  highlights: string[];
  sections: TrustSection[];
}
export const trustPages = content.pages as Record<string, TrustPage>;
export const trustReviewed = content.reviewed;
export const trustContact = content.contact;
export const trustNavigation: TrustLink[] = [
  { label: 'Artwork License', href: '/license/' },
  { label: 'Privacy & Your Data', href: '/privacy/' },
  { label: 'Terms of Use', href: '/terms/' },
  { label: 'Copyright & Corrections', href: '/copyright/' },
  { label: 'Frequently Asked Questions', href: '/faq/' },
  { label: 'Our Editorial Process', href: '/editorial-process/' },
  { label: 'Accessibility', href: '/accessibility/' },
];
export function trustSectionText(section: TrustSection) {
  return [
    ...section.paragraphs,
    ...(section.bullets || []),
    ...(section.table ? [...section.table.headers, ...section.table.rows.flat()] : []),
    ...(section.questions || []).flatMap((q) => [q.question, ...q.answer]),
    ...(section.links || []).map((link) => link.label),
  ].join(' ');
}
// Keep the same public-copy contract used by search and sitemap generation.
export const trustInfoPages: Record<
  string,
  { title: string; description: string; sections: [string, string][] }
> = Object.fromEntries(
  Object.entries(trustPages).map(([slug, page]) => [
    slug,
    {
      title: page.title,
      description: page.description,
      sections: page.sections.map(
        (section) => [section.title, trustSectionText(section)] as [string, string],
      ),
    },
  ]),
);
