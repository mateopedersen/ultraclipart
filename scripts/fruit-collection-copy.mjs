// Subject-specific context; all examples refer to inspected, included designs.
export const contexts = {
  apple: [
    'Orchard ideas for everyday projects.',
    'Build an orchard vocabulary card, harvest scrapbook or personal recipe page with whole apples, cut fruit, blossoms and playful characters. A cut apple makes the core easy to discuss; a branch composition gives an autumn page a natural frame.',
    'banana,orange,strawberry',
  ],
  banana: [
    'A bright start for fruit-themed activities.',
    'Use banana bunches, peeled fruit and slices for breakfast picture cards, classroom sequencing or a personal kitchen notebook. Long curved silhouettes work across headings, while small cut pieces suit counting and matching activities.',
    'apple,avocado,coconut',
  ],
  orange: [
    'Citrus color for cards and kitchen pages.',
    'Choose whole oranges, cut sections, juice and friendly characters for a personal recipe collection or classroom fruit activity. Round slices make clear circular accents; leafy branches give a wider arrangement more structure.',
    'mandarin,tangerine,apple',
  ],
  strawberry: [
    'Small berries with plenty of character.',
    'Make a summer scrapbook, personal dessert recipe page or fruit vocabulary card with strawberries, blossoms and berry characters. Keep the seeds and leafy tops visible when reducing a design, and leave space for a caption beside larger baskets.',
    'raspberry,blueberry,apple',
  ],
  raspberry: [
    'Berry details for summer projects.',
    'Choose raspberry clusters, leafy branches and playful fruit characters for personal recipe pages, garden journals and classroom sorting activities. The small rounded segments give each berry its texture; print detailed illustrations large enough to keep that shape clear.',
    'strawberry,blueberry,orange',
  ],
  blueberry: [
    'Little blue berries, varied creative uses.',
    'Use blueberry clusters, bowls and characters on a personal breakfast journal, summer card or classroom counting sheet. Compare single berries with grouped fruit when planning a matching game, and keep the star-shaped crowns visible in small layouts.',
    'raspberry,strawberry,banana',
  ],
  avocado: [
    'Fresh shapes for kitchen and classroom pages.',
    'Choose whole avocados, halves, slices and lively characters for personal recipe cards or classroom fruit vocabulary. A cut half shows the large stone clearly; a slice arrangement makes a compact accent beside a sandwich or breakfast heading.',
    'banana,kiwi-fruit,coconut',
  ],
  coconut: [
    'Tropical details for personal projects.',
    'Arrange whole coconuts, cut shells, drinks and characters on a personal travel scrapbook, summer invitation or fruit picture card. Cut shells show the contrast between the rough exterior and pale flesh; tall palm details need room above the subject.',
    'banana,kiwi-fruit,avocado',
  ],
  'kiwi-fruit': [
    'A green center for bright fruit projects.',
    'These illustrations show kiwifruit, including whole fruit, cut halves, slices and playful fruit characters. Use the radiating seeds and green flesh on personal recipe pages, fruit matching cards or classroom descriptive-writing prompts.',
    'avocado,coconut,strawberry',
  ],
  mandarin: [
    'Easy-to-recognize citrus shapes.',
    'Choose mandarins with loose peel, separated segments, leaves and cheerful characters for personal citrus recipe pages or classroom sorting activities. A peeled fruit helps show how the segments fit together; a leafy branch makes a more decorative arrangement.',
    'tangerine,orange,apple',
  ],
  tangerine: [
    'Warm citrus accents for creative pages.',
    'Build a personal winter fruit scrapbook, kitchen notebook or classroom picture card with tangerines, peeled sections and playful characters. Use open peel shapes for a larger focal point, and compact whole fruit for smaller labels and matching activities.',
    'mandarin,orange,banana',
  ],
};
export function collectionCopy(topic, items) {
  const [lead, intro, links] = contexts[topic];
  const label = topic === 'kiwi-fruit' ? 'kiwi fruit' : topic;
  const find = (pattern) => items.find((item) => pattern.test(item.id));
  const realistic = find(/realistic|botanical|whole.*watercolor|fresh/),
    decorative = find(/mosaic|stained-glass|garland|floral/),
    outline = find(/coloring|outline|line-art/),
    watercolor = find(/watercolor/);
  const feature = [
    ...new Set(
      [realistic, watercolor, decorative, outline, ...items].filter(Boolean).map((item) => item.id),
    ),
  ].slice(0, 6);
  return {
    description: `Explore ${items.length} ${label} clipart designs for personal and classroom projects. Edit online and download matching transparent WebP or CMYK PDF files.`,
    lead,
    intro,
    featured: feature,
    chips: [
      { label: 'Watercolor', query: `${label} watercolor` },
      { label: 'Coloring designs', query: `${label} coloring` },
      { label: 'Fruit characters', query: `${label} cartoon` },
    ],
    heading: `Choose ${/^[aeiou]/.test(label) ? 'an' : 'a'} ${label} design for your layout`,
    paragraphs: [
      `Start with the space available for the illustration. ${realistic ? `“${realistic.title}” offers a starting point for a fruit picture card.` : 'A whole-fruit illustration offers a clear starting point for a picture card.'} Keep the subject recognizable before adding a name or short question, and use a consistent scale across a set of matching cards.`,
      `${decorative ? `“${decorative.title}” brings decorative detail to a personal greeting or kitchen notebook.` : 'Patterned illustrations add detail to a personal greeting or kitchen notebook.'} Leave lettering outside textured areas. ${watercolor ? `Preview “${watercolor.title}” over your chosen background to check the soft edges.` : 'Preview your chosen design over the intended background to check contrast.'}`,
      `${outline ? `“${outline.title}” offers an option for a coloring or drawing activity.` : 'Monochrome designs offer options for a drawing activity.'} Open a design in the editor to move, resize, rotate or crop the image and add separate text and shape layers. Save the project to revise the arrangement later.`,
    ],
    print:
      'Each illustration includes a transparent WebP and a matching CMYK PDF. The supplied PDFs place their images at 300 pixels per inch; native dimensions vary by design and appear on the artwork page. Choose actual size when printing to preserve that scale. Enlarging an image reduces its effective resolution. Check a sample print before making multiple copies.',
    related: links.split(','),
  };
}
