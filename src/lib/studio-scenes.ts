export const studioSceneCategories = [
  ['technology', 'Technology & Games'],
  ['school', 'School & Reading'],
  ['music-film', 'Music & Film'],
  ['sports', 'Sports'],
  ['celebrations', 'Cards & Family'],
  ['nature-travel', 'Nature & Travel'],
  ['animals-food', 'Animals & Food'],
] as const;
export type StudioSceneCategory = (typeof studioSceneCategories)[number][0];

export interface StudioScene {
  id: string;
  title: string;
  caption: string;
  category: StudioSceneCategory;
  description: string;
  background: string;
  color: string;
  items: { id: string; x: number; y: number; width: number }[];
}
export const studioScenes: StudioScene[] = [
  {
    id: 'study-desk',
    title: 'Study Desk',
    caption: 'Study Time',
    category: 'technology',
    description:
      'Start a study-planner cover with a laptop, notebook and coffee illustration. Add your own heading.',
    background: '#edf4ff',
    color: '#254e7e',
    items: [
      {
        id: 'laptop-study-laptop-with-notebook-and-coffee',
        x: 300,
        y: 230,
        width: 800,
      },
    ],
  },
  {
    id: 'music-practice',
    title: 'Music Practice',
    caption: 'Music Notes',
    category: 'music-film',
    description:
      'Make a music notebook or lesson card with a guitar and retro microphone. Move each picture separately.',
    background: '#f5f0fc',
    color: '#584778',
    items: [
      {
        id: 'music-acoustic-guitar-watercolor-clipart',
        x: 130,
        y: 210,
        width: 650,
      },
      {
        id: 'microphone-bronze-retro-desktop-microphone',
        x: 800,
        y: 300,
        width: 450,
      },
    ],
  },
  {
    id: 'back-to-school',
    title: 'Back to School',
    caption: 'Back to School',
    category: 'school',
    description:
      'Create a classroom welcome card with a school bag and open book. Replace the text with a class name.',
    background: '#fff6e8',
    color: '#79522e',
    items: [
      {
        id: 'school-backpack-filled-with-pencils-playful-clipart',
        x: 120,
        y: 260,
        width: 580,
      },
      {
        id: 'book-and-feather-quill-classic-clipart',
        x: 740,
        y: 350,
        width: 530,
      },
    ],
  },
  {
    id: 'robot-lab',
    title: 'Robot Lab',
    caption: 'Explore & Invent',
    category: 'technology',
    description:
      'Start an invention activity or science-club poster with an imaginary robot and a classroom globe.',
    background: '#eaf4fb',
    color: '#285c80',
    items: [
      {
        id: 'robot-friendly-robot-reaching-out-to-say-hello',
        x: 180,
        y: 220,
        width: 490,
      },
      {
        id: 'earth-clipart-classroom-globe-wooden-stand',
        x: 820,
        y: 330,
        width: 400,
      },
    ],
  },
  {
    id: 'basketball-practice',
    title: 'Basketball Practice',
    caption: 'Team Practice',
    category: 'sports',
    description:
      'Make a practice notice with a basketball player, ball and whistle. Add your team name as the heading.',
    background: '#fff1e7',
    color: '#8d4b28',
    items: [
      {
        id: 'girl-basketball-player-retro-comic-clipart',
        x: 170,
        y: 200,
        width: 700,
      },
      {
        id: 'basketball-and-whistle-classic-clipart',
        x: 850,
        y: 420,
        width: 400,
      },
    ],
  },
  {
    id: 'thank-you-dad',
    title: 'A Card for Dad',
    caption: 'Thank You, Dad',
    category: 'celebrations',
    description:
      'Personalize a family card with a tie, glasses, handprint heart and heart balloons. Write your own greeting.',
    background: '#f0f3fd',
    color: '#394f7e',
    items: [
      {
        id: 'dad-clipart-dad-hobby-still-life',
        x: 80,
        y: 260,
        width: 720,
      },
      {
        id: 'heart-balloon-bouquet-watercolor-clipart',
        x: 825,
        y: 250,
        width: 480,
      },
    ],
  },
  {
    id: 'movie-night',
    title: 'Movie Night',
    caption: 'Movie Night',
    category: 'music-film',
    description:
      'Build a screening invitation with popcorn and a clapperboard. Change the heading to your film or event.',
    background: '#fff3e9',
    color: '#7a423b',
    items: [
      {
        id: 'movie-popcorn-in-striped-carton-clean-illustration-clipart',
        x: 150,
        y: 250,
        width: 600,
      },
      {
        id: 'movie-open-clapperboard-colored-pencil-clipart',
        x: 770,
        y: 350,
        width: 500,
      },
    ],
  },
  {
    id: 'earth-day',
    title: 'Earth Day',
    caption: 'Our Blue Planet',
    category: 'nature-travel',
    description:
      'Make an Earth Day activity cover with a globe and fern. Adjust the background and write a topic title.',
    background: '#eef6f0',
    color: '#346557',
    items: [
      {
        id: 'earth-clipart-classroom-globe-wooden-stand',
        x: 150,
        y: 240,
        width: 650,
      },
      {
        id: 'leaf-arching-fern-frond-botanical-illustration-clipart',
        x: 830,
        y: 350,
        width: 440,
      },
    ],
  },
  {
    id: 'seaside-postcard',
    title: 'Seaside Postcard',
    caption: 'Seaside Memories',
    category: 'nature-travel',
    description:
      'Design a holiday journal cover with a palm-tree island and seashell. Replace the words with a place name.',
    background: '#eaf7fb',
    color: '#30677f',
    items: [
      {
        id: 'beach-palm-tree-island-flat-graphic-clipart',
        x: 100,
        y: 230,
        width: 750,
      },
      {
        id: 'beach-blue-floral-porcelain-seashell-clipart',
        x: 880,
        y: 420,
        width: 380,
      },
    ],
  },
  {
    id: 'arcade-game-night',
    title: 'Arcade Game Night',
    caption: 'Game Night',
    category: 'technology',
    description:
      'Create a game-night invitation with a retro arcade joystick and popcorn. Change the message and colors.',
    background: '#f1effc',
    color: '#594480',
    items: [
      {
        id: 'game-controller-retro-arcade-joystick-and-spare-ball-tops',
        x: 100,
        y: 310,
        width: 720,
      },
      {
        id: 'movie-popcorn-in-striped-carton-clean-illustration-clipart',
        x: 850,
        y: 280,
        width: 420,
      },
    ],
  },
  {
    id: 'reading-corner',
    title: 'Reading Corner',
    caption: 'Reading Corner',
    category: 'school',
    description:
      'Make a reading journal cover with children reading and an open book. Add a reader name or class title.',
    background: '#f6f2e9',
    color: '#66553a',
    items: [
      {
        id: 'book-children-reading-together-classic-clipart',
        x: 100,
        y: 300,
        width: 700,
      },
      {
        id: 'book-and-feather-quill-playful-clipart',
        x: 850,
        y: 360,
        width: 410,
      },
    ],
  },
  {
    id: 'floral-greeting',
    title: 'Floral Greeting',
    caption: 'Made With Love',
    category: 'celebrations',
    description:
      'Start a thank-you or celebration card with a rose-heart wreath and heart balloons. Add a personal greeting.',
    background: '#fff1f5',
    color: '#83475f',
    items: [
      {
        id: 'floral-heart-roses-wreath-clipart',
        x: 100,
        y: 220,
        width: 700,
      },
      {
        id: 'heart-balloon-bouquet-watercolor-clipart',
        x: 850,
        y: 300,
        width: 430,
      },
    ],
  },
  {
    id: 'fresh-strawberries',
    category: 'animals-food',
    description: 'Make a recipe cover or kitchen label with strawberries and your own heading.',
    title: 'Freshly picked',
    caption: 'Freshly picked',
    background: '#fff8ed',
    color: '#823745',
    items: [{ id: 'strawberry-fruit-trio-realistic-clipart', x: 360, y: 230, width: 700 }],
  },
  {
    id: 'little-explorer',
    category: 'animals-food',
    description: 'Arrange an elephant and giraffe on a nursery print or animal activity card.',
    title: 'Little explorer',
    caption: 'A little adventure',
    background: '#eff5f2',
    color: '#355a52',
    items: [
      { id: 'baby-elephant-standing-realistic-clipart', x: 100, y: 260, width: 650 },
      { id: 'giraffe-standing-realistic-clipart', x: 600, y: 138, width: 760 },
    ],
  },
  {
    id: 'woodland-welcome',
    category: 'animals-food',
    description: 'Create a baby greeting with two separate rabbit pictures and a personal message.',
    title: 'Woodland welcome',
    caption: 'Hello, little one',
    background: '#faf3ed',
    color: '#815b48',
    items: [
      { id: 'holland-lop-rabbit-standing-realistic-clipart', x: 180, y: 210, width: 660 },
      { id: 'english-spot-rabbit-baby-nursery-clipart', x: 780, y: 455, width: 390 },
    ],
  },
  {
    id: 'citrus-notes',
    category: 'animals-food',
    description:
      'Start a kitchen journal with orange and kiwi illustrations. Replace the heading with a recipe name.',
    title: 'Citrus notes',
    caption: 'Fresh ideas',
    background: '#fffbe8',
    color: '#5d703d',
    items: [
      { id: 'orange-pair-and-half-realistic-clipart', x: 120, y: 260, width: 620 },
      { id: 'kiwi-whole-and-half-realistic-clipart', x: 720, y: 320, width: 550 },
    ],
  },
  {
    id: 'wildlife-collection',
    category: 'animals-food',
    description:
      'Build an animal comparison card with an elephant, giraffe and zebra on separate layers.',
    title: 'Wild & wonderful',
    caption: 'Wild & wonderful',
    background: '#f6f4e9',
    color: '#536340',
    items: [
      { id: 'elephant-standing-realistic-clipart', x: 50, y: 240, width: 530 },
      { id: 'giraffe-standing-realistic-clipart', x: 420, y: 180, width: 630 },
      { id: 'zebra-standing-realistic-clipart', x: 850, y: 320, width: 510 },
    ],
  },
  {
    id: 'best-friends',
    category: 'animals-food',
    description: 'Make a pet greeting or care label with a dog, cat and editable heading.',
    title: 'Best friends',
    caption: 'Best friends',
    background: '#edf4fc',
    color: '#35587f',
    items: [
      { id: 'dog-golden-retriever-standing-realistic-clipart', x: 200, y: 250, width: 590 },
      { id: 'cat-ginger-tabby-standing-realistic-clipart', x: 770, y: 360, width: 420 },
    ],
  },
];
