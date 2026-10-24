const subjects = {
  'and-feather-quill': {
    name: 'Open Book and Feather Quill',
    use: 'a reading journal, literature lesson or writing invitation',
  },
  'child-at-bookshelf': {
    name: 'Child Choosing a Book from a Bookshelf',
    use: 'a library sign, reading challenge or classroom poster',
  },
  'children-reading-together': {
    name: 'Two Children Reading Together',
    use: 'a shared-reading activity, school handout or book club notice',
  },
  'girl-reading-books': {
    name: 'Girl Reading on a Stack of Books',
    use: 'a reading-corner sign, library card or story-time invitation',
  },
  'library-books': {
    name: 'Books on a Library Shelf',
    use: 'a library label, book list or classroom reading display',
  },
  'open-book': {
    name: 'Open Book',
    use: 'a reading worksheet, story prompt or literature project',
  },
  'stack-of-books': {
    name: 'Stack of Books',
    use: 'a reading tracker, book fair sign or study planner',
  },
  'storybook-with-stars': {
    name: 'Storybook with Stars',
    use: 'a bedtime-story card, creative-writing prompt or reading poster',
  },
  'with-glasses': {
    name: 'Book with Reading Glasses',
    use: 'a book review, reading list or library handout',
  },
  worm: {
    name: 'Bookworm Reading a Book',
    use: 'a cheerful reading reward, library bookmark or classroom display',
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

export function bookMetadata(id) {
  const match =
    /^(book|bookworm)-(.+)-(black-and-white|classic|decorative|ornate|playful)-clipart$/.exec(id);
  if (!match) throw Error('Unreviewed book artwork: ' + id);
  const subject = match[1] === 'bookworm' ? 'worm' : match[2];
  if (!subjects[subject] || (match[1] === 'bookworm' && match[2] !== 'reading'))
    throw Error('Unreviewed book subject: ' + id);
  const { name, use } = subjects[subject],
    style = match[3];
  const label = style === 'black-and-white' ? 'Black & White' : heading(style);
  return {
    title: `${name} (${label}) Clipart`,
    alt: `${name}, ${styles[style]} illustration on a transparent background.`,
    description: `${name} in a ${styles[style]} illustration for ${use}. Download a transparent WebP image or its matching CMYK PDF.`,
    style: style === 'black-and-white' ? 'Black & White' : 'Color',
  };
}

export function bookCollectionCopy(items) {
  if (items.length !== 50) throw Error('Incomplete book collection');
  const featured = [
    'book-children-reading-together-classic-clipart',
    'book-open-book-decorative-clipart',
    'bookworm-reading-playful-clipart',
    'book-girl-reading-books-ornate-clipart',
    'book-library-books-classic-clipart',
    'book-storybook-with-stars-decorative-clipart',
  ];
  if (featured.some((id) => !items.some((item) => item.id === id)))
    throw Error('Missing book feature');
  return {
    description:
      'Explore 50 book and reading clipart illustrations: open books, bookshelves, children reading, storybooks and a cheerful bookworm. Download transparent WebP images and matching printable CMYK PDFs.',
    lead: 'A story starts here.',
    intro:
      'Choose a quiet reading moment, a shelf of books or a storybook full of stars. Each of the 10 subjects comes in classic, decorative, ornate, playful and black-and-white styles.',
    featured,
    chips: [
      { label: 'Reading together', query: 'children reading' },
      { label: 'Books & shelves', query: 'bookshelf' },
      { label: 'Storybook magic', query: 'storybook stars' },
    ],
    heading: 'Find the right reading moment',
    paragraphs: [
      'Children reading together suit a book club notice or classroom display. A single open book leaves room for your own title, dates and lesson details.',
      'Use a bookshelf or stack of books on reading trackers, library signs and book lists. The bookworm adds a warm character to a bookmark or reading reward.',
      'Black-and-white versions work for coloring activities and low-ink printing. Keep added text separate so it stays editable in Clipart Studio.',
    ],
    print:
      'Each design includes a transparent 1,500 × 1,500 WebP and a matching 2-inch-square CMYK PDF containing a 1,500 × 1,500 image. That is 750 pixels per inch at the supplied page size. Four WebPs in the supplied ZIP had transparency that differed from their PDFs; the published copies were reconstructed from the matching PDFs and independently checked.',
    related: ['school'],
  };
}
