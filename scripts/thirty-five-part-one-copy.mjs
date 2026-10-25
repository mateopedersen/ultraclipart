export const packageContexts = {
  earth: {
    label: 'Earth',
    cluster: 'Nature & elements',
    secondary: ['School & learning'],
    lead: 'One planet, fifty ways to tell its story.',
    intro:
      'Explore globes, oceans, orbit scenes and imaginative environmental illustrations. Find Earth held in caring hands, surrounded by plants or paired with recycling and clean-energy symbols for personal projects and classroom displays.',
    use: 'Earth Day posters, classroom planet displays and personal environmental journals',
    chips: ['earth globe', 'earth recycling', 'earth watercolor'],
    related: ['leaves', 'beach', 'school', 'book'],
    featured: [
      'atlantic-globe-natural-color',
      'earth-held-cupped-hands',
      'earth-watercolor-splash',
      'earth-layers-cutaway',
      'earth-wind-turbines',
      'earth-line-art-map-projection',
    ],
    note: 'These are decorative illustrations, including stylized globes and imagined scenes. Use an authoritative map or scientific diagram when geographic or scientific precision is required.',
  },
  'question-mark': {
    label: 'Question mark',
    cluster: 'School & learning',
    secondary: ['Arts & entertainment'],
    lead: 'Give every good question a little presence.',
    intro:
      'Choose question marks made from balloons, glass, plants, paper, building blocks and other imaginative materials. The collection also includes simple serif, sans-serif and outline symbols for personal quiz cards, classroom prompts and mystery-themed activities.',
    use: 'classroom question prompts, personal quiz cards and mystery-themed activities',
    chips: ['question mark balloon', 'question mark glass', 'question mark outline'],
    related: ['school', 'book', 'music', 'movie'],
    featured: ['glossy-3d', 'botanical', 'balloon', 'glass', 'cut-paper', 'bold-serif'],
    note: 'These question marks are downloadable illustrations rather than an installable font. Place and resize the image beside your own editable text in Clipart Studio.',
  },
  hat: {
    label: 'Hat',
    cluster: 'People & activities',
    lead: 'A different hat for every kind of story.',
    intro:
      'Browse baseball caps, sunhats, berets, party hats, seasonal headwear and familiar costume and occupation hats. Compare colorful illustrations with open outline designs for personal dress-up invitations, classroom vocabulary and coloring activities.',
    use: 'classroom clothing vocabulary, personal dress-up invitations and coloring activities',
    chips: ['hat sunhat', 'hat cowboy', 'hat outline'],
    related: ['boy', 'girl', 'school'],
    featured: [
      'straw-sunhat-ribbon',
      'western-cowboy-hat',
      'french-beret',
      'chef-toque',
      'starry-wizard-hat',
      'construction-hardhat-outline',
    ],
    note: 'Choose an open outline for a coloring activity or a colored hat as a ready-to-place accent. Each design is one image layer, so individual stitches, ribbons and other details are not separate editable objects.',
  },
  dad: {
    label: 'Dad',
    cluster: 'Family & celebrations',
    secondary: ['People & activities'],
    lead: 'Everyday moments worth keeping.',
    intro:
      'Find fathers caring for newborns, reading, making breakfast, building, playing and spending time with children of different ages. The collection includes a father using a wheelchair while playing chess, alongside outline and silhouette designs for family stories and personal keepsakes.',
    use: "personal Father's Day cards, family scrapbook pages and classroom family stories",
    chips: ['dad newborn', 'dad daughter', 'dad reading'],
    related: ['baby', 'boy', 'girl', 'heart'],
    featured: [
      'father-newborn-cradle',
      'father-daughter-kite',
      'father-son-pancakes',
      'father-wheelchair-chess',
      'father-child-reading-outline',
      'father-adult-son-walk-silhouette',
    ],
    note: 'Leave room beside the illustration for a name, date or personal message. Outline designs can also become a family coloring activity, while silhouettes work well as a simple accent.',
  },
};

const titleCase = (text) =>
  text
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b3d\b/gi, '3D');

const subjectCorrections = {
  'atlantic-globe-natural-color': 'Atlantic-facing Earth Globe in Natural Color',
  'pacific-cloud-swirls-orbit': 'Earth from Orbit with Pacific Cloud Swirls',
  'earth-recycle-arrows': 'Earth with Recycling Arrows',
  'earth-held-cupped-hands': 'Earth Held in Cupped Hands',
  'earth-line-art-map-projection': 'Earth Map Projection Line Art',
  'earth-black-silhouette-branches': 'Earth Silhouette with Branches',
  'earth-mosaic-black-white': 'Black and White Earth Mosaic',
  'earth-tote-reusable': 'Reusable Earth Tote Bag',
  'earth-vial-preservation': 'Earth Preservation Vial',
  'earth-plug-line-art': 'Earth with Electric Plug Line Art',
  'earth-balloon-basket': 'Earth Balloon with Basket',
  'earth-thermometer-line-art': 'Earth with Thermometer Line Art',
  'earth-ribbon-bow-line-art': 'Earth with Ribbon Bow Line Art',
  'earth-embroidered-patch': 'Earth Embroidered Patch',
  'earth-botanicals-wreath': 'Earth with Botanical Wreath',
  'yellow-rain-souwester': "Yellow Rain Sou'wester Hat",
  'tartan-tam-o-shanter': "Tartan Tam o' Shanter Hat",
  'father-child-shoulder-outline': "Child on Father's Shoulders Outline",
  'father-wheelchair-chess': 'Father Using a Wheelchair Playing Chess',
  'father-daughter-school-dropoff': 'Father and Daughter at School Drop-off',
  'father-teen-fistbump-outline': 'Father and Teen Fist Bump Outline',
  'father-child-dentist-roleplay': 'Father and Child Playing Dentist',
  'father-twins-cuddle-outline': 'Father Cuddling Twins Outline',
  'father-family-photographer': 'Father Taking a Family Photograph',
  'vintage-nurse-cap': 'White Sailor Cap with Navy Band',
  'dad-hobby-still-life': "Father's Day Tie, Glasses and Handprint Heart",
  'father-newborn-cradle': 'Father Cradling a Newborn',
  'father-adult-daughter-hug': 'Father Hugging His Adult Daughter',
  'father-adult-son-walk-silhouette': 'Father Walking with His Adult Son in Black and White',
  'father-baby-bottle': 'Father Bottle-feeding a Baby',
  'father-baby-sleep-chair': 'Father Resting beside a Sleeping Baby',
  'father-baby-stroller-jog': 'Father Jogging with a Baby Stroller',
  'father-child-cookie-cutters': 'Father and Child Making Cookies',
  'father-child-guitar-lesson': 'Father Teaching a Child Guitar',
  'father-child-heart-gift': 'Child Giving a Heart Card to Dad',
  'father-child-high-five': 'Father and Child Sharing a High Five',
  'father-child-homework': 'Father Helping a Child with Homework',
  'father-child-paper-plane': 'Father and Child Making a Paper Plane',
  'father-child-pet-care': 'Father and Child Caring for a Dog',
  'father-child-rain-walk': 'Father and Child Walking in the Rain',
  'father-child-reading-outline': 'Father Reading with Children Outline',
  'father-child-repair-outline': 'Father and Child Repairing a Wagon Outline',
  'father-child-sandcastle': 'Father and Child Building a Sandcastle',
  'father-child-science-volcano': 'Father and Child Making a Science Volcano',
  'father-child-snowman': 'Father and Child Building a Snowman',
  'father-child-soccer-outline': 'Father and Child Playing Soccer Outline',
  'father-child-telescope': 'Father and Child Looking through a Telescope',
  'father-child-treehouse': 'Father and Child Building a Treehouse',
  'father-daughter-ballet': 'Father and Daughter Dancing Ballet',
  'father-daughter-canoe': 'Father and Daughter Paddling a Canoe',
  'father-daughter-garden': 'Father and Daughter Planting a Flower',
  'father-daughter-handprint-outline': 'Father and Daughter Handprint Heart Outline',
  'father-daughter-kite': 'Father and Daughter Flying a Kite',
  'father-daughter-painting': 'Father and Daughter Painting Together',
  'father-daughter-piggyback': 'Father Giving His Daughter a Piggyback Ride',
  'father-daughter-shoelaces': "Father Tying His Daughter's Shoelaces",
  'father-kids-puppet-show': 'Father Performing a Puppet Show for Children',
  'father-newborn-profile-silhouette': 'Father Kissing a Newborn in Black and White',
  'father-son-basketball': 'Father Helping His Son Play Basketball',
  'father-son-bike-lesson': 'Father Teaching His Son to Ride a Bike',
  'father-son-camping': 'Father and Son Setting up a Tent',
  'father-son-fishing': 'Father and Son Fishing Together',
  'father-son-graduation': "Father Celebrating His Son's Graduation",
  'father-son-origami-outline': 'Father and Son Folding Origami Outline',
  'father-son-pancakes': 'Father and Son Making Pancakes',
  'father-son-robot-building': 'Father and Son Building a Robot',
  'father-son-train-set': 'Father and Son Playing with a Train Set',
  'father-twins-block-tower': 'Father and Twins Building a Block Tower',
};

export function packageMetadata(topic, id) {
  const context = packageContexts[topic];
  if (!context || !id.startsWith(topic + '-clipart-')) throw Error('Unexpected artwork ID');
  const body = id.slice((topic + '-clipart-').length);
  let subject = subjectCorrections[body] ?? titleCase(body);
  if (topic === 'question-mark') subject += ' Question Mark';
  if (topic === 'dad' && !subjectCorrections[body]) {
    subject = subject.replace(
      /^Father (Adult )?(Daughter|Son|Child|Kids|Twins|Baby|Newborn|Teen)\b/,
      (_, age, child) => `Father and ${age ?? ''}${child}`,
    );
  }
  const outline =
    /outline|line-art/.test(body) || (topic === 'question-mark' && body === 'doodle-rays');
  const monochrome = /black-|black-white|silhouette/.test(body);
  const style = outline
    ? 'Outline'
    : monochrome
      ? 'Black & White'
      : /watercolor/.test(body)
        ? 'Watercolor'
        : 'Color';
  const title = subject + ' Clipart';
  const alt = `${subject}, ${outline ? 'an outline illustration' : monochrome ? 'a monochrome illustration' : 'a color illustration'}, on a transparent background.`;
  const description = `${subject}. Add this ${context.label.toLowerCase()} illustration to ${context.use}. Choose a transparent WebP image for screen layouts or the matching single-page CMYK PDF for printing. Both original files are available separately.`;
  return { title, alt, description, style };
}

export function packageCollectionCopy(topic, items) {
  const context = packageContexts[topic];
  const featured = context.featured.map((suffix) => `${topic}-clipart-${suffix}`);
  if (featured.some((id) => !items.some((item) => item.id === id)))
    throw Error('Unknown featured artwork');
  return {
    description: `Explore ${items.length} ${context.label.toLowerCase()} clipart designs. Download transparent WebP images or matching printable CMYK PDFs for personal and classroom projects.`,
    lead: context.lead,
    intro: context.intro,
    featured,
    chips: context.chips.map((query) => ({
      label: titleCase(query.replace(new RegExp(`^${topic.replaceAll('-', ' ')}\\s+`, 'i'), '')),
      query,
    })),
    heading: `Choose ${context.label.toLowerCase()} clipart for your next project`,
    paragraphs: [
      context.note,
      `Use these designs for ${context.use}. Open an artwork to compare its original dimensions, preview the transparent edges on different backgrounds and check the size of each download before choosing a file.`,
      'In Clipart Studio, move, resize, rotate or crop the image layer, then add your own text and shapes. Internal illustration details are part of the image rather than separate vector objects. Save a project if you want to continue working on your arrangement later.',
    ],
    print:
      'Each design has two separate files: a transparent WebP image and a matching single-page CMYK PDF. The original 1,254 × 1,254 pixel illustration is placed at 300 pixels per inch in the PDF, giving a 4.18 × 4.18 inch page. Print at actual size to keep that scale. Enlarging reduces effective resolution; check one sample before printing multiple copies.',
    related: context.related,
  };
}
