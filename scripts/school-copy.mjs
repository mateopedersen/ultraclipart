const subjectLabel = (id) =>
  id
    .replace(/^school-/, '')
    .replace(/-(black-and-white|classic|decorative|ornate|playful)-clipart$/, '')
    .replaceAll('-', ' ');
const heading = (text) => text.replace(/\b\w/g, (letter) => letter.toUpperCase());
const useCases = {
  'backpack filled with pencils':
    'school supply labels, a first-day card or a classroom packing list',
  'elementary school building': 'a school welcome page, classroom map or first-day memory',
  'playground recess': 'a recess story prompt, school calendar or activity page',
  'science class': 'a classroom science card, lesson header or experiment journal',
  'students graduation day': 'a graduation card, class memory book or celebration page',
  'students reading in library': 'a reading log, library sign or story-time page',
  'students walking to school': 'a school-route picture card or first-day story',
  'teacher in classroom': 'a teacher appreciation card, classroom note or lesson page',
  'teacher teaching students': 'a school activity sheet, classroom newsletter or thank-you card',
  'yellow school bus': 'a school transport card, class calendar or first-day page',
};
const styleWords = {
  'black-and-white': 'black-and-white line illustration',
  classic: 'classic illustration',
  decorative: 'decorative illustration',
  ornate: 'detailed ornate illustration',
  playful: 'playful illustration',
};

export function schoolMetadata(id) {
  const match = /^school-(.+)-(black-and-white|classic|decorative|ornate|playful)-clipart$/.exec(
    id,
  );
  if (!match) throw Error('Unexpected school artwork identity: ' + id);
  const subject = subjectLabel(id),
    style = match[2],
    use = useCases[subject];
  if (!use) throw Error('Unreviewed school subject: ' + id);
  const styleLabel = style === 'black-and-white' ? 'Black-and-white' : heading(style);
  const title = `${heading(subject)} (${style === 'black-and-white' ? 'Black & White' : heading(style)}) School Clipart`;
  const alt = `${styleLabel} illustration of ${subject} on a transparent background.`;
  const description = `${heading(subject)} in a ${styleWords[style]} for ${use}. Download a transparent WebP image or a matching CMYK PDF.`;
  return {
    title,
    alt,
    description,
    style: style === 'black-and-white' ? 'Black & White' : 'Color',
  };
}

export function schoolCollectionCopy(items) {
  if (items.length !== 50) throw Error('Incomplete school collection');
  const feature = [
    'school-backpack-filled-with-pencils-playful-clipart',
    'school-students-reading-in-library-classic-clipart',
    'school-science-class-decorative-clipart',
    'school-yellow-school-bus-ornate-clipart',
    'school-playground-recess-playful-clipart',
    'school-teacher-in-classroom-black-and-white-clipart',
  ];
  if (feature.some((id) => !items.some((item) => item.id === id)))
    throw Error('Missing school feature');
  return {
    description:
      'Explore 50 school clipart illustrations of classrooms, students, teachers, books, playgrounds and a yellow bus. Download transparent WebP images and matching printable CMYK PDFs.',
    lead: 'A little color for the school day.',
    intro:
      'Choose from 10 school scenes and subjects, each drawn in five looks: classic, decorative, ornate, playful and black-and-white. Make a welcome card, classroom handout, reading log or personal school memory page.',
    featured: feature,
    chips: [
      { label: 'Classroom scenes', query: 'school classroom' },
      { label: 'Reading & library', query: 'school reading library' },
      { label: 'Black & white', query: 'school black and white' },
    ],
    heading: 'Choose a school scene for your page',
    paragraphs: [
      'A backpack, yellow bus or school building reads clearly on a label or invitation. Let larger scenes such as playground recess or a classroom activity occupy more space so the people and objects remain visible.',
      'Pair reading and library artwork with a short book title or reading goal. Science-class and teacher scenes suit classroom newsletters and lesson headings. Keep separate captions outside the detailed illustration.',
      'The black-and-white versions are useful when color printing is unavailable or children will add their own marks. Preview each design at its final size, then arrange it with editable text and shapes in Clipart Studio.',
    ],
    print:
      'Every school design includes a transparent 1,500 × 1,500 WebP and a matching 2-inch-square CMYK PDF containing a 1,500 × 1,500 image. That gives 750 pixels per inch at the supplied page size. Print at actual size to keep this scale, or resize with the effective resolution in mind. Six WebPs in the supplied ZIP were empty or had mismatched transparency; the published copies were reconstructed from their matching PDFs and checked against the PDF renders.',
    related: ['baby', 'heart', 'volleyball'],
  };
}
