import { availableTopics, availableClusters, slugify, topicArt, topicInCluster } from './catalog';
import { infoPages } from './info-pages';
import { guides } from './guides';
import { guidePaths } from './guide-paths';
import { guideLessons } from './guide-walkthroughs';
import { teacherPaths } from './teacher-resources';
import { studioTemplates } from './studio-templates';
import { studioScenes } from './studio-scenes';
import { proTools } from '../editor/smart/pro-catalog';
import { studioElements } from '../editor/elements';
import { textStyles } from '../editor/text-styles';
import { examples as publicAiIdeas, ideaCategories } from '../ai/ideas';
import { normalizeQuery } from './search-language';
import type { SiteSearchEntry, SiteSearchKind } from './site-search';
import ts from 'typescript';
// Automatically picks up new public static pages; no private project or generated-image data.
const sources = import.meta.glob('../pages/**/*.astro', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const studioCopy = import.meta.glob(
  '../components/{Editor,StudioPanels,StudioProTools,TextStudio,ElementLibrary}.astro',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;
/** Read only literal public copy fields. Never evaluate frontmatter or serialize variables. */
function literalCopy(source: string) {
  const frontmatter = source.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] || '';
  const tree = ts.createSourceFile(
    'public-page.ts',
    frontmatter,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const keys = new Set([
    'title',
    'description',
    'body',
    'text',
    'name',
    'story',
    'caption',
    'label',
    'intro',
    'question',
    'answer',
    'alt',
  ]);
  const values: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      keys.has(node.name.getText(tree).replace(/^['"]|['"]$/g, '')) &&
      (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
    )
      values.push(node.initializer.text);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return values.join(' ');
}
function publicText(source: string) {
  const markup = source
    .replace(/^---\s*\n[\s\S]*?\n---/, '')
    .replace(/<(?:script|style|svg|noscript)\b[^>]*\/\s*>/gi, '')
    .replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  let text = '',
    depth = 0,
    quote = '';
  for (let i = 0; i < markup.length; i++) {
    const c = markup[i];
    if (depth) {
      if (quote) {
        if (c === '\\') {
          i++;
          continue;
        }
        if (c === quote) quote = '';
      } else if (['"', "'", '`'].includes(c)) quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
    } else if (c === '{') depth = 1;
    else text += c;
  }
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|amp|quot|apos|rsquo|lsquo|ndash|mdash);/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function staticAttribute(source: string, name: string) {
  const value =
    source.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1] ||
    source.match(new RegExp(`\\bconst\\s+${name}\\s*=\\s*(['"])(.*?)\\1`))?.[2] ||
    '';
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|rsquo);/g, "'");
}
export function buildSiteSearch(): SiteSearchEntry[] {
  const entries = new Map<string, SiteSearchEntry>();
  const add = (
    kind: SiteSearchKind,
    id: string,
    title: string,
    description: string,
    href: string,
    text = '',
  ) => {
    entries.set(id, {
      kind,
      id,
      title,
      description,
      href,
      text: [...new Set(normalizeQuery(text))].join(' '),
    });
  };
  for (const [file, source] of Object.entries(sources)) {
    const path = file
      .replace('../pages/', '')
      .replace(/(^|\/)index\.astro$/, '$1')
      .replace(/\.astro$/, '/');
    if (path.includes('[') || path === '404/' || path === 'search/') continue;
    const href = '/' + path.replace(/^\//, '');
    const content = publicText(source);
    const metadata = guides.find((guide) => href === `/guides/${guide.slug}/`);
    const title =
      metadata?.title ||
      staticAttribute(source, 'title') ||
      publicText(source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '') ||
      content.match(/.{1,90}?[.!?](?:\s|$)/)?.[0]?.trim() ||
      href;
    const description =
      metadata?.description || staticAttribute(source, 'description') || content.slice(0, 180);
    const kind: SiteSearchKind = href.startsWith('/guides/')
      ? 'guide'
      : ['/create/', '/ai-clipart-generator/', '/print-size/', '/favorites/'].includes(href)
        ? 'tool'
        : 'page';
    const extra =
      href === '/create/'
        ? Object.values(studioCopy).map(publicText).join(' ') + ' HEX color code'
        : href === '/for-teachers/'
          ? teacherPaths
              .map(
                (path) =>
                  `${path.title} ${path.intro} ${path.steps.map((step) => step.title + ' ' + step.text).join(' ')} ${path.adapt} ${path.check}`,
              )
              .join(' ')
          : href === '/ai-clipart-generator/'
            ? ideaCategories.map(([, label]) => label).join(' ') +
              ' ' +
              publicAiIdeas.map((idea) => `${idea.label} ${idea.prompt} ${idea.style}`).join(' ')
            : '';
    add(
      kind,
      `page:${href}`,
      title,
      description,
      href,
      content + ' ' + literalCopy(source) + ' ' + extra,
    );
  }
  for (const [slug, page] of Object.entries(infoPages))
    add(
      'page',
      `info:${slug}`,
      slug === 'faq'
        ? 'Frequently Asked Questions'
        : slug.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      page.description,
      `/${slug}/`,
      `${page.title} ${page.sections.flat().join(' ')}`,
    );
  for (const topic of availableTopics)
    add(
      'topic',
      `topic:${topic.slug}`,
      topic.keyword,
      `Browse ${topicArt(topic.slug).length} illustrations of ${topic.keyword.replace(/ clipart$/i, '')}.`,
      `/clipart/${topic.slug}/`,
      `${topic.keyword} ${topic.cluster}`,
    );
  for (const cluster of availableClusters)
    add(
      'collection',
      `collection:${slugify(cluster)}`,
      cluster,
      `Browse the ${cluster} clipart collection.`,
      `/collection/${slugify(cluster)}/`,
      availableTopics
        .filter((topic) => topicInCluster(topic, cluster))
        .map((topic) => topic.keyword)
        .join(' '),
    );
  for (const guide of guidePaths)
    add(
      'guide',
      `help:${guide.id}`,
      guide.title,
      guide.intro,
      `/guides/#guide-${guide.id}`,
      `${guide.label} ${guide.short} ${guide.steps.map((step) => `${step.title} ${step.text}`).join(' ')} ${guide.noteTitle} ${guide.note} ${
        guideLessons
          .find((lesson) => lesson.id === guide.id)
          ?.screens.map(
            (screen) =>
              `${screen.title} ${screen.caption} ${screen.steps.map((step) => step.title + ' ' + step.text).join(' ')}`,
          )
          .join(' ') || ''
      }`,
    );
  for (const path of teacherPaths)
    add(
      'guide',
      `teacher:${path.id}`,
      path.title,
      path.intro,
      `/for-teachers/#teacher-plan-${path.id}`,
      `${path.label} ${path.output} ${path.steps.map((step) => step.title + ' ' + step.text).join(' ')} ${path.adapt} ${path.check}`,
    );
  for (const template of studioTemplates)
    add(
      'studio',
      `starter:${template.id}`,
      template.title,
      template.description,
      `/create/?starter=${encodeURIComponent(template.id)}#studio-starters`,
      `${template.title} ${template.description} editable starter template`,
    );
  for (const scene of studioScenes)
    add(
      'studio',
      `scene:${scene.id}`,
      scene.title,
      scene.description,
      `/create/?scene-view=${encodeURIComponent(scene.id)}#studio-starters`,
      `${scene.title} ${scene.caption} ${scene.description} ${scene.category} ${scene.items.map((item) => item.id.replaceAll('-', ' ')).join(' ')} editable starter composition`,
    );
  const editorTools = [
    [
      'region',
      'Select & Recolor',
      'Select image regions with Smart Select, Wand, Brush or Lasso. Recolor, erase, restore and enter a HEX color code.',
    ],
    [
      'create',
      'Shapes & Drawing',
      'Draw freehand paths and add shapes with fill and stroke controls.',
    ],
    [
      'text',
      'Text & Typography',
      'Add editable text, choose a style, change fonts, curves, outlines and shadows.',
    ],
    ['canvas', 'Canvas Size', 'Set the canvas width and height for your composition.'],
    [
      'color',
      'Element Colors',
      'Recolor editable vector elements using color pickers or a HEX color code.',
    ],
    [
      'background',
      'Background Color',
      'Choose a solid or transparent canvas background and enter a HEX color code.',
    ],
    ['print', 'Print Settings', 'Set paper size, orientation, margins and print scale.'],
    ['crop', 'Crop Artwork', 'Set the exported crop area or restore the complete canvas.'],
    [
      'transform',
      'Size & Position',
      'Resize, rotate, align, distribute, group and move selected layers.',
    ],
    [
      'layers',
      'Layers & Saved Projects',
      'Select, reorder, lock and hide layers. Save or open an editable project.',
    ],
  ];
  for (const [id, title, description] of editorTools)
    add(
      'tool',
      `editor:${id}`,
      title,
      description,
      `/create/?editor-tool=${id}#studio-workspace`,
      `${title} ${description} Studio editor`,
    );
  for (const tool of proTools)
    add(
      'tool',
      `pro:${tool.id}`,
      tool.name,
      tool.copy,
      `/create/?studio-tool=${encodeURIComponent(tool.id)}#studio-workspace`,
      `${tool.name} ${tool.category} ${tool.copy} Studio Pro`,
    );
  for (const element of studioElements)
    add(
      'studio',
      `vector:${element.id}`,
      element.name,
      `${element.category} · Editable vector element.`,
      `/create/?vector=${encodeURIComponent(element.id)}#studio-workspace`,
      `${element.name} ${element.category} ${element.tags} vector shape icon`,
    );
  for (const style of textStyles)
    add(
      'studio',
      `text:${style.id}`,
      `${style.name} Text Style`,
      `${style.category} · Editable lettering for your design.`,
      `/create/?text-style=${encodeURIComponent(style.id)}#studio-workspace`,
      `${style.name} ${style.category} ${style.type.font} ${style.type.layout} ${style.type.strokeWidth ? 'outline' : ''} ${style.type.shadow ? 'shadow' : ''} typography font text style`,
    );
  return [...entries.values()];
}
