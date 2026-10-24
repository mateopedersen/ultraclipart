const words = (s) => s.replaceAll('-', ' ');
const titleCase = (s) =>
  words(s)
    .replace(/\b\w/g, (x) => x.toUpperCase())
    .replace(/\b3d\b/i, '3D');
const techniques = [
  ['painted-ceramic-cartoon', 'Ceramic Character', 'a painted ceramic appearance'],
  ['colored-pencil-cartoon', 'Colored Pencil Character', 'a colored-pencil texture'],
  ['watercolor-cartoon', 'Watercolor Character', 'a watercolor texture'],
  ['retro-rubber-hose-cartoon', 'Retro Cartoon', 'a retro rubber-hose cartoon style'],
  ['cel-shaded-cartoon', 'Cel-shaded Character', 'a cel-shaded cartoon style'],
  ['lineless-cartoon', 'Lineless Character', 'a lineless cartoon style'],
  ['storybook-cartoon', 'Storybook Character', 'a storybook illustration style'],
  ['nursery-cartoon', 'Nursery Character', 'a soft nursery illustration style'],
  ['mascot-cartoon', 'Mascot', 'a colorful mascot style'],
  ['kawaii-cartoon', 'Kawaii Character', 'a kawaii cartoon style'],
  ['papercut-cartoon', 'Paper-cut Character', 'a paper-cut character appearance'],
  ['knitted-cartoon', 'Knitted Character', 'a knitted character appearance'],
  ['enamel-cartoon', 'Enamel Character', 'an enamel character appearance'],
  ['plush-cartoon', 'Plush Characters', 'a soft plush character appearance'],
  ['clay-cartoon', 'Clay Character', 'a sculpted clay character appearance'],
  ['chalk-cartoon', 'Chalk Character', 'a chalk illustration style'],
  ['comic-cartoon', 'Comic Character', 'a comic illustration style'],
  ['3d-cartoon', '3D Character', 'a three-dimensional cartoon style'],
  ['botanical-engraving', 'Botanical Engraving', 'a botanical engraving style'],
  ['geometric-line', 'Geometric Line Art', 'a geometric line-art style'],
  ['layered-papercut', 'Paper-cut Illustration', 'a layered paper-cut appearance'],
  ['felt-embroidery', 'Felt Illustration', 'a felt and embroidered appearance'],
  ['botanical-pencil', 'Botanical Pencil', 'a botanical pencil illustration style'],
  ['ceramic-mosaic', 'Mosaic Illustration', 'a ceramic mosaic appearance'],
  ['stained-glass', 'Stained Glass', 'a stained-glass appearance'],
  ['hand-carved-wood', 'Wooden Illustration', 'a carved wooden appearance'],
  ['carved-wood', 'Wooden Illustration', 'a carved wooden appearance'],
  ['crochet-amigurumi', 'Crochet Illustration', 'a crocheted appearance'],
  ['amigurumi', 'Amigurumi', 'a crocheted appearance'],
  ['digital-graphic', 'Digital Illustration', 'a digital illustration style'],
  ['digital-painting', 'Digital Painting', 'a digital painting style'],
  ['vintage-lithograph', 'Vintage Illustration', 'a vintage lithograph style'],
  ['color-woodcut', 'Color Woodcut', 'a color woodcut style'],
  ['paper-quilling', 'Paper Quilling', 'a paper-quilling appearance'],
  ['soft-pastel', 'Pastel', 'a soft pastel illustration style'],
  ['wax-crayon', 'Crayon', 'a wax-crayon illustration style'],
  ['oil-painting', 'Oil-style Illustration', 'an oil-painting style'],
  ['ink-drawing', 'Ink Drawing', 'an ink-drawing style'],
  ['coloring', 'Coloring Design', 'an open coloring-page style'],
  ['engraving', 'Engraving', 'an engraved illustration style'],
  ['stippling', 'Stipple Illustration', 'a stippled illustration style'],
  ['silhouette', 'Silhouette', 'a silhouette illustration style'],
  ['linocut', 'Linocut', 'a linocut illustration style'],
  ['woodcut', 'Woodcut', 'a woodcut illustration style'],
  ['watercolor', 'Watercolor', 'a watercolor illustration style'],
  ['realistic', 'Realistic Illustration', 'a realistic illustration style'],
  ['airbrush', 'Airbrush Illustration', 'an airbrush illustration style'],
  ['origami', 'Origami Illustration', 'a folded-paper appearance'],
  ['low-poly', 'Low-poly Illustration', 'a low-poly geometric style'],
  ['gouache', 'Gouache', 'a gouache illustration style'],
  ['ink-wash', 'Ink Wash', 'an ink-wash illustration style'],
  ['folk-art', 'Folk Art', 'a folk-art illustration style'],
  ['outline', 'Outline', 'an open outline style'],
  ['cartoon', 'Cartoon', 'a cartoon illustration style'],
  ['3d', '3D Illustration', 'a three-dimensional illustration style'],
  ['flat', 'Flat Illustration', 'a flat illustration style'],
];
const characterNames = [
  [/^astronaut-fruit$/, 'Astronaut'],
  [/^birthday-fruit$/, 'Birthday Character'],
  [/^bouncing-fruit$/, 'Bouncing Character'],
  [/^chef(?:-fruit)?$/, 'Chef'],
  [/^explorer-fruit$/, 'Explorer'],
  [/^friends-high-five$/, 'Friends High Five'],
  [/^gardener-fruit$/, 'Gardener'],
  [/^musician-fruit$/, 'Musician'],
  [/^parent-and-baby$/, 'Parent and Baby'],
  [/^reading-fruit$/, 'Reading Character'],
  [/^roller-skating-fruit$/, 'Roller-skating Character'],
  [/^running-fruit$/, 'Running Character'],
  [/^sleeping-fruit$/, 'Sleeping Character'],
  [/^smiling-fruit$/, 'Smiling Character'],
  [/^superhero-fruit$/, 'Superhero'],
  [/^surprised-fruit$/, 'Surprised Character'],
  [/^waving(?:-fruit)?$/, 'Waving Character'],
  [/^winter-scarf-fruit$/, 'Winter Scarf Character'],
];

export function expansionMetadata(topic, id) {
  if (!id.startsWith(topic + '-') || !id.endsWith('-clipart'))
    throw Error('Mismatched fruit identity');
  const label = topic === 'date' ? 'Date Fruit' : titleCase(topic);
  const monochrome = /-black-and-white-clipart$/.test(id);
  let body = id.slice(topic.length + 1, -8).replace(/-black-and-white$/, '');
  if (body === 'hand-carved-wooden-fruit') body = 'fruit-hand-carved-wood';
  const technique = techniques.find(([suffix]) => body.endsWith('-' + suffix));
  let medium = technique?.[1] ?? 'Illustration';
  const appearance = technique?.[2] ?? 'an illustrated style';
  if (technique) body = body.slice(0, -technique[0].length - 1);
  if (body === 'crocheted-fruit') body = 'Crocheted Fruit';
  if (body === 'chef-cartoon') body = 'chef';
  const character = characterNames.find(([pattern]) => pattern.test(body))?.[1];
  const subject =
    character ??
    titleCase(body)
      .replace(/\bFruit Fruit\b/g, 'Fruit')
      .replace(/^Honeydew /, topic === 'melon' ? 'Honeydew ' : '');
  const title = `${label} ${subject} (${medium}${monochrome ? ', Black & White' : ''})`;
  const alt = `${label} ${subject.toLowerCase()}, shown with ${appearance}${monochrome ? ' in black and white' : ''}. Transparent background.`;
  const use = /coloring|outline/.test(id)
    ? 'Use the open areas for a classroom coloring activity.'
    : /cartoon|amigurumi/.test(id)
      ? 'Add it to a personal greeting, fruit story or classroom picture card.'
      : /branch|vine|palm|botanical|floral/.test(id)
        ? 'Use it in a personal garden journal or classroom fruit display.'
        : 'Arrange it on a personal recipe page or classroom fruit-matching card.';
  const description = `${label} ${subject.toLowerCase()} with ${appearance}${monochrome ? ' in black and white' : ''}. ${use} Download transparent WebP or matching printable PDF.`;
  const style = /coloring|outline|geometric-line/.test(id)
    ? 'Outline'
    : monochrome
      ? 'Black & White'
      : /watercolor/.test(id)
        ? 'Watercolor'
        : 'Color';
  if (alt.length > 420 || title.length > 160 || description.length > 500)
    throw Error('Unreviewed metadata length');
  return { title, alt, description, style };
}
