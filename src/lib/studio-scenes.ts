export interface StudioScene {
  id: string;
  title: string;
  caption: string;
  background: string;
  color: string;
  items: { id: string; x: number; y: number; width: number }[];
}
export const studioScenes: StudioScene[] = [
  {
    id: 'fresh-strawberries',
    title: 'Freshly picked',
    caption: 'Freshly picked',
    background: '#fff8ed',
    color: '#823745',
    items: [{ id: 'strawberry-fruit-trio-realistic-clipart', x: 360, y: 230, width: 700 }],
  },
  {
    id: 'little-explorer',
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
