const subjects = {
  'and-whistle': {
    name: 'Basketball and Referee Whistle',
    use: 'a game-day schedule, referee card or sports notice',
  },
  'championship-medal': {
    name: 'Basketball Championship Medal',
    use: 'a team award, tournament invitation or winner certificate',
  },
  'girl-dribbling': {
    name: 'Girl Dribbling a Basketball',
    use: 'a player profile, practice plan or youth sports poster',
  },
  jersey: {
    name: 'Basketball Jersey and Ball',
    use: 'a team roster, locker label or game-day invitation',
  },
  'kid-shooting': {
    name: 'Kid Shooting a Basketball',
    use: 'a skills activity, class sports page or practice reminder',
  },
  'kids-playing': {
    name: 'Kids Playing Basketball',
    use: 'a school game poster, team handout or activity sheet',
  },
  'through-hoop': {
    name: 'Basketball Through the Hoop',
    use: 'a scoring chart, tournament graphic or sports banner',
  },
  trophy: {
    name: 'Basketball Trophy',
    use: 'a championship certificate, award card or tournament program',
  },
  'with-flames': {
    name: 'Basketball with Flames',
    use: 'an energetic team poster, game-day banner or player card',
  },
  'with-sneakers': {
    name: 'Basketball and Sneakers',
    use: 'a practice checklist, sports camp flyer or team page',
  },
};
const styles = {
  'black-and-white': 'black-and-white',
  classic: 'classic',
  decorative: 'decorative',
  ornate: 'ornate',
  playful: 'playful',
};
const heading = (text) => text.replace(/\b\w/g, (letter) => letter.toUpperCase());

export function basketballMetadata(id) {
  const match =
    /^basketball-(.+)-(black-and-white|classic|decorative|ornate|playful)-clipart$/.exec(id);
  if (!match || !subjects[match[1]]) throw Error('Unreviewed basketball artwork: ' + id);
  const { name, use } = subjects[match[1]],
    style = match[2];
  const label = style === 'black-and-white' ? 'Black & White' : heading(style);
  return {
    title: `${name} (${label}) Clipart`,
    alt: `${name}, ${styles[style]} illustration on a transparent background.`,
    description: `${name} in a ${styles[style]} illustration for ${use}. Download a transparent WebP image or its matching CMYK PDF.`,
    style: style === 'black-and-white' ? 'Black & White' : 'Color',
  };
}

export function basketballCollectionCopy(items) {
  if (items.length !== 50) throw Error('Incomplete basketball collection');
  const featured = [
    'basketball-kids-playing-playful-clipart',
    'basketball-through-hoop-decorative-clipart',
    'basketball-girl-dribbling-classic-clipart',
    'basketball-trophy-ornate-clipart',
    'basketball-with-flames-playful-clipart',
    'basketball-jersey-black-and-white-clipart',
  ];
  if (featured.some((id) => !items.some((item) => item.id === id)))
    throw Error('Missing basketball feature');
  return {
    description:
      'Explore 50 basketball clipart illustrations featuring players, hoops, jerseys, trophies, sneakers and game-day details. Download transparent WebP images and matching printable CMYK PDFs.',
    lead: 'Bring the game to the page.',
    intro:
      'Pick a player in motion, a ball at the hoop or a detail from the sideline. Each of the 10 subjects comes in classic, decorative, ornate, playful and black-and-white styles.',
    featured,
    chips: [
      { label: 'Players in motion', query: 'basketball players' },
      { label: 'Hoops & scoring', query: 'basketball hoop' },
      { label: 'Awards & teams', query: 'basketball trophy' },
    ],
    heading: 'Choose a moment from the game',
    paragraphs: [
      'A dribbling player or a shot at the hoop suits a poster or practice handout. Use a jersey, whistle or sneakers when you need a smaller accent beside a schedule or team name.',
      'Medal and trophy designs work well on certificates and tournament programs. Keep names, dates and scores as separate editable text so the artwork remains clear at print size.',
      'The black-and-white designs can be used in a coloring activity or when color printing is unavailable. Preview a design at its final size before placing it in Clipart Studio.',
    ],
    print:
      'Each design includes a transparent 1,500 × 1,500 WebP and a matching 2-inch-square CMYK PDF containing a 1,500 × 1,500 image. That is 750 pixels per inch at the supplied page size. Two WebPs in the supplied ZIP had transparency that differed from their PDFs; the published copies were reconstructed from the corresponding PDFs and independently checked.',
    related: ['volleyball', 'school'],
  };
}
