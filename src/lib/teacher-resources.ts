import { publishedArt as art } from './catalog';
import { catalogStatistics } from './catalog-statistics';
import { guideLessons, type GuideScreen } from './guide-walkthroughs';
import type { GuideSymbolKind } from '../components/GuideSymbol.astro';

const picture = (id: string, label: string) => {
  const item = art.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Teacher example is missing from the catalog: ${id}`);
  return {
    id: item.id,
    thumb: item.thumb,
    thumbSrcSet: item.thumbSrcSet,
    title: item.title,
    alt: item.alt,
    label,
    width: item.width,
    height: item.height,
  };
};
export const teacherPictures = {
  globe: picture('earth-clipart-classroom-globe-wooden-stand', 'Classroom globe'),
  earth: picture('earth-clipart-atlantic-globe-natural-color', 'Earth'),
  reading: picture('book-children-reading-together-classic-clipart', 'Reading together'),
  bag: picture('school-backpack-filled-with-pencils-classic-clipart', 'School supplies'),
  geometry: picture('tablet-tablet-with-geometry-study-supplies', 'Geometry study supplies'),
  trumpet: picture('music-brass-trumpet-detailed-metallic-illustration-clipart', 'Brass trumpet'),
  coins: picture('money-balance-scale-with-coins-colored-engraving-clipart', 'Coins and balance'),
};
type Picture = (typeof teacherPictures)[keyof typeof teacherPictures];
interface TeacherPath {
  id: string;
  label: string;
  icon: GuideSymbolKind;
  title: string;
  intro: string;
  output: string;
  steps: { title: string; text: string }[];
  adapt: string;
  check: string;
  action: { href: string; label: string };
  guide: { href: string; label: string };
  pictures: Picture[];
}
export const teacherPaths: TeacherPath[] = [
  {
    id: 'worksheets',
    label: 'Worksheets',
    icon: 'files',
    title: 'Prepare a worksheet or handout',
    intro:
      'Start with the question and the space students need to respond. Add illustrations where they help explain or complete the task.',
    output: 'A worksheet made in your document app or the studio',
    steps: [
      {
        title: 'Set the task',
        text: 'Write one clear instruction. Decide whether students will label, compare, explain, sort or draw, then reserve enough answer space.',
      },
      {
        title: 'Choose the illustration',
        text: 'Browse a subject and open the artwork page. Check the image dimensions and background, then choose Download Image.',
      },
      {
        title: 'Build the page',
        text: 'Place the image in a compatible document app, or arrange it with text in the studio. Keep the instructions as editable text in your source document.',
      },
      {
        title: 'Check a printed copy',
        text: 'Confirm the paper size, margins and image size. Read the smallest text on one printed copy before printing copies for the class.',
      },
    ],
    adapt:
      'Offer a word bank, fewer items or a larger answer area. Keep the same learning goal while changing the amount of reading or writing required.',
    check: 'The question, image and answer space all fit on the intended page.',
    action: { href: '/categories/', label: 'Find worksheet illustrations' },
    guide: { href: '/guides/#guide-print', label: 'See the print walkthrough' },
    pictures: [teacherPictures.earth, teacherPictures.coins],
  },
  {
    id: 'slides',
    label: 'Teaching slides',
    icon: 'slides',
    title: 'Make a clear teaching slide',
    intro:
      'Use an illustration to introduce a question, explain an idea or model an example. Give the important detail enough room on screen.',
    output: 'An image placed in your presentation app',
    steps: [
      {
        title: 'Choose what to show',
        text: 'Choose a picture that helps explain the idea. Leave enough space for the heading and labels.',
      },
      {
        title: 'Download the image',
        text: 'Choose Download Image on the artwork page, then save the file from the download window on the same page. Check that your presentation app supports WebP.',
      },
      {
        title: 'Add the explanation',
        text: 'Add a short heading and labels as real text in your presentation. Use your app’s alternative-text field to describe the information the image adds.',
      },
      {
        title: 'View it as students will',
        text: 'View the slide in full-screen mode. Check the contrast, text size, and image details from the back of the room.',
      },
    ],
    adapt:
      'Reveal one step at a time, provide the explanation in writing, or give students a separate enlarged image when needed.',
    check: 'The slide is understandable without relying on color alone.',
    action: { href: '/clipart/earth/', label: 'Explore an example subject' },
    guide: { href: '/guides/#guide-download', label: 'See the download walkthrough' },
    pictures: [teacherPictures.globe, teacherPictures.trumpet],
  },
  {
    id: 'labels',
    label: 'Classroom labels',
    icon: 'label',
    title: 'Label a space, tray or folder',
    intro:
      'Make the words easy to recognize and keep the picture consistent across a set. Use the same approach for subject folders and classroom displays.',
    output: 'An editable label design and a finished image or PDF',
    steps: [
      {
        title: 'Decide the wording',
        text: 'Choose a brief label, such as Reading corner or Paper scraps, and measure where it will go.',
      },
      {
        title: 'Open a starting point',
        text: 'Open Create and scroll to the starters. Choose Learning label or start with a blank canvas. Save your current work before choosing a new starter.',
      },
      {
        title: 'Arrange words and artwork',
        text: 'Add your caption with Text and select objects in Layers. Leave clear space around the words; remove decoration that crowds them.',
      },
      {
        title: 'Save both versions',
        text: 'Choose Save project to keep an editable copy. Export an image or PDF, then check the printed size against the tray or folder.',
      },
    ],
    adapt:
      'Pair a clear word with a relevant image. Keep the layout consistent, and change the language or text size for the class using it.',
    check: 'The label is legible at its actual display size.',
    action: { href: '/create/#studio-starters', label: 'Open the studio starters' },
    guide: { href: '/guides/make-a-classroom-label/', label: 'Follow the full label guide' },
    pictures: [teacherPictures.reading, teacherPictures.bag],
  },
  {
    id: 'routines',
    label: 'Visual steps',
    icon: 'steps',
    title: 'Show a routine or sequence',
    intro:
      'Break a familiar classroom process into a few visible steps. Use the pictures alongside spoken or written instructions.',
    output: 'A sequence strip, task card or classroom display',
    steps: [
      {
        title: 'Write the sequence first',
        text: 'List what students should do in order. Keep each instruction short and choose only the steps the class needs.',
      },
      {
        title: 'Choose recognizable pictures',
        text: 'Find illustrations that relate to each action or object. Check the meaning with your students rather than assuming a picture explains itself.',
      },
      {
        title: 'Number and label the steps',
        text: 'Use the studio or your document app to place pictures beside numbers and words. Keep the text and image positions consistent.',
      },
      {
        title: 'Introduce it in class',
        text: 'Explain and model the routine, then place the finished sequence where students will use it. Revise any confusing wording or picture.',
      },
    ],
    adapt:
      'Use fewer steps, larger spacing or a separate card for each step. Offer a written or spoken explanation alongside the visual version.',
    check: 'Students can connect each picture with the action you have taught.',
    action: { href: '/clipart/school/', label: 'Find classroom illustrations' },
    guide: { href: '/guides/#guide-edit', label: 'See the editing walkthrough' },
    pictures: [teacherPictures.bag, teacherPictures.reading],
  },
  {
    id: 'discussion',
    label: 'Discussion and writing',
    icon: 'book',
    title: 'Start a discussion or writing task',
    intro:
      'Give students something specific to observe, describe or question. The same illustration can support different subjects and levels of response.',
    output: 'A discussion slide, picture prompt or writing page',
    steps: [
      {
        title: 'Choose the focus',
        text: 'Decide whether students will describe what they see, explain a choice, compare details or imagine what might happen next.',
      },
      {
        title: 'Select the picture',
        text: 'Choose a setting, object or scene that supports the focus. Use an image that leaves room for the question and response.',
      },
      {
        title: 'Add a useful prompt',
        text: 'Try “What do you notice?” followed by a subject-specific question. Supply vocabulary or sentence starters if the task needs them.',
      },
      {
        title: 'Choose a response',
        text: 'Invite spoken, written or drawn responses as appropriate to the lesson. Keep an editable copy so you can change the prompt for another class.',
      },
    ],
    adapt:
      'Offer a word bank or sentence starter for support. For a further challenge, ask students to compare details or explain their answer.',
    check: 'The prompt gives students a clear starting point and a useful way to respond.',
    action: { href: '/categories/', label: 'Choose a subject for your prompt' },
    guide: { href: '/guides/#guide-edit', label: 'See how to add text' },
    pictures: [teacherPictures.reading, teacherPictures.globe],
  },
  {
    id: 'reuse',
    label: 'Save for next time',
    icon: 'boards',
    title: 'Organize a reusable teaching set',
    intro:
      'Keep your chosen artwork together and save the editable material separately. A board can collect images for a topic, class or term.',
    output: 'A named Favorites board, a board backup, and an editable project file',
    steps: [
      {
        title: 'Collect the artwork',
        text: 'Use the heart button on artwork you want to keep. Open Favorites to see the collection saved in this browser.',
      },
      {
        title: 'Name the board',
        text: 'Create a board with a clear name, such as Geography: maps or Term 2: reading. Choose Organize on a saved illustration to add it to a board.',
      },
      {
        title: 'Keep an editable source',
        text: 'Choose Save project in the studio to download an editable copy. Give each version a clear filename so you can find and adapt it later.',
      },
      {
        title: 'Make a backup',
        text: 'Use Export backup in Favorites and keep the downloaded file. Boards are stored in the current browser; a backup lets you restore them elsewhere.',
      },
    ],
    adapt:
      'Keep a common source project, then save separate versions with different wording, spacing or support. Update the finished export after each change.',
    check: 'Both the artwork collection and the editable design have a separate saved copy.',
    action: { href: '/favorites/', label: 'Open Favorites boards' },
    guide: { href: '/guides/#guide-boards', label: 'See the boards walkthrough' },
    pictures: [teacherPictures.geometry, teacherPictures.reading],
  },
];

export const teacherCollections = [
  {
    topic: 'school',
    label: 'Classroom and school',
    use: 'Routines, supply labels and classroom spaces',
    picture: teacherPictures.bag,
  },
  {
    topic: 'book',
    label: 'Reading and language',
    use: 'Reading corners, picture prompts and book tasks',
    picture: teacherPictures.reading,
  },
  {
    topic: 'earth',
    label: 'Earth and geography',
    use: 'Discussion starters and topic displays',
    picture: teacherPictures.globe,
  },
  {
    topic: 'tablet',
    label: 'Technology and study',
    use: 'Digital literacy and study-themed materials',
    picture: teacherPictures.geometry,
  },
  {
    topic: 'music',
    label: 'Music and sound',
    use: 'Instrument vocabulary and listening prompts',
    picture: teacherPictures.trumpet,
  },
  {
    topic: 'money',
    label: 'Money and everyday life',
    use: 'Financial vocabulary and discussion examples',
    picture: teacherPictures.coins,
  },
].map((collection) => ({
  ...collection,
  count: catalogStatistics.topics[collection.topic] ?? 0,
}));

// Reuse unchanged screenshots of the actual site, with teacher-specific explanations.
const studio = guideLessons.find((lesson) => lesson.id === 'edit')!.screens[0];
const boards = guideLessons.find((lesson) => lesson.id === 'boards')!.screens[0];
export const teacherScreens: GuideScreen[] = [
  {
    ...studio,
    id: 'teacher-studio',
    title: 'Add your wording and arrange the page',
    caption:
      'The studio with a sample design. Use these controls to add text and arrange artwork for any subject.',
    steps: studio.steps.map((step, index) => ({
      ...step,
      title: ['Add a heading or instruction', 'Select an object in Layers', 'Arrange the material'][
        index
      ],
      text: [
        'Open Text, type your wording and choose Add / update caption. Keep the instruction short and leave room for students to work.',
        'Select a named row to work with that object. Imported clipart may be one image layer; text you add in the studio remains a separate editable layer in the project.',
        'Move or resize the selected object while keeping its proportions. Choose Save project to keep an editable copy, then export the finished image or PDF.',
      ][index],
    })),
  },
  {
    ...boards,
    id: 'teacher-boards',
    title: 'Keep a board for a lesson or topic',
    caption:
      'Favorites with sample boards. Give your own boards names that match your lessons or projects.',
  },
];
