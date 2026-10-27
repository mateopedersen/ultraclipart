import type { Layer, TextLayer } from '../editor/model';
import { identity } from '../editor/model';
import { typographyDefaults } from '../editor/text-styles';

type Scene = { id: string; title: string; items: { id: string }[] };
type AssetSize = { width: number; height: number };
type ArtworkPlacement = {
  kind: 'artwork';
  id: string;
  label: string;
  artworkId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type Composition = {
  width: number;
  height: number;
  background: string;
  layers: (Layer | ArtworkPlacement)[];
};

export const sceneUpgrades: Record<
  string,
  { title: string; caption: string; description: string }
> = {
  'study-desk': {
    title: 'Make Room for Ideas',
    caption: 'Make Room for Ideas',
    description:
      'A study planner with a bold editorial heading, a desk illustration, focus fields and a three-part weekly checklist.',
  },
  'music-practice': {
    title: 'Make Some Music',
    caption: 'Make Some Music',
    description:
      'A record-inspired music poster with oversized type, circular artwork frames and space for your practice details.',
  },
  'back-to-school': {
    title: 'A New Chapter',
    caption: 'A New Chapter',
    description:
      'A classroom welcome poster with colorful geometric blocks, school artwork and editable name, class and year fields.',
  },
  'robot-lab': {
    title: 'Ideas in Motion',
    caption: 'Ideas in Motion',
    description:
      'A science-club poster with a blueprint grid, robot artwork and three editable activity prompts.',
  },
  'basketball-practice': {
    title: 'Show Up. Step Up.',
    caption: 'Show Up. Step Up.',
    description:
      'A high-contrast team poster with diagonal court graphics, a player illustration and editable event details.',
  },
  'thank-you-dad': {
    title: 'For the One Who Shows Up',
    caption: 'For the One Who Shows Up',
    description:
      'A framed thank-you card with layered keepsake artwork, a warm greeting and a personal message area.',
  },
  'movie-night': {
    title: 'Your Movie Night Ticket',
    caption: 'Movie Night',
    description:
      'An oversized cinema ticket with perforation marks, popcorn, a clapperboard and editable admission details.',
  },
  'earth-day': {
    title: 'Our Blue Planet',
    caption: 'Our Blue Planet',
    description:
      'An illustrated activity poster with a globe, botanical artwork and three practical prompts for noticing the natural world.',
  },
  'seaside-postcard': {
    title: 'Seaside Days',
    caption: 'Seaside Days',
    description:
      'A travel postcard with a framed island scene, stamp-shaped accents, address lines and an editable greeting.',
  },
  'arcade-game-night': {
    title: 'Press Play',
    caption: 'Press Play',
    description:
      'A neon-inspired invitation with an arcade controller, layered frames and editable date and location fields.',
  },
  'reading-corner': {
    title: 'One More Chapter',
    caption: 'One More Chapter',
    description:
      'A reading-club poster with book illustrations, a large serif headline and three editable reading prompts.',
  },
  'floral-greeting': {
    title: 'With Love',
    caption: 'With Love',
    description:
      'A floral greeting card with a wreath-framed message, fine double borders and an editable personal note.',
  },
  'fresh-strawberries': {
    title: 'Freshly Picked Recipe Card',
    caption: 'Freshly Picked',
    description:
      'A kitchen recipe card with a large strawberry illustration, ingredient lines and editable preparation fields.',
  },
  'little-explorer': {
    title: 'A Little Adventure',
    caption: 'A Little Adventure',
    description:
      'A nursery keepsake with soft geometric scenery, animal illustrations and space for a name and personal details.',
  },
  'woodland-welcome': {
    title: 'Welcome, Little One',
    caption: 'Welcome, Little One',
    description:
      'A woodland greeting with a leafy oval frame, two rabbit illustrations and an editable dedication.',
  },
  'citrus-notes': {
    title: 'A Fresh Start',
    caption: 'A Fresh Start',
    description:
      'A citrus-themed planning sheet with an editorial title, fruit illustrations and three generous note fields.',
  },
  'wildlife-collection': {
    title: 'The Wild Files',
    caption: 'The Wild Files',
    description:
      'A three-panel wildlife observation sheet with separate animal artwork, labels and space to record what you notice.',
  },
  'best-friends': {
    title: 'Paws & Plans',
    caption: 'Paws & Plans',
    description:
      'A weekly pet-care planner with dog and cat artwork, seven day columns and editable activity rows.',
  },
};

/** Both the gallery and the editor consume these exact objects and coordinates. */
export function buildStudioComposition(
  scene: Scene,
  sizes: ReadonlyMap<string, AssetSize>,
): Composition {
  const plan: Composition = { width: 1400, height: 1000, background: '#f7f5ef', layers: [] };
  let index = 0;
  const base = (label: string) => ({
    id: `${scene.id}-${++index}`,
    label,
    ...identity(),
    visible: true,
    locked: false,
    opacity: 1,
  });
  const vector = (label: string, markup: string, opacity = 1) => {
    plan.layers.push({ ...base(label), kind: 'vector', markup, opacity });
  };
  const rect = (
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    radius = 0,
    stroke = 'none',
    sw = 0,
  ) =>
    vector(
      label,
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`,
    );
  const circle = (
    label: string,
    x: number,
    y: number,
    r: number,
    fill: string,
    stroke = 'none',
    sw = 0,
  ) =>
    vector(
      label,
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`,
    );
  const line = (
    label: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width = 2,
  ) =>
    vector(
      label,
      `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}"/>`,
    );
  const text = (
    label: string,
    value: string,
    x: number,
    y: number,
    size: number,
    color = '#183652',
    bold = false,
    font: 'sans' | 'serif' | 'mono' = 'sans',
    align: 'start' | 'middle' | 'end' = 'start',
  ) => {
    plan.layers.push({
      ...base(label),
      kind: 'text',
      text: value,
      x,
      y,
      size,
      color: /^#[0-9a-f]{3}$/i.test(color) ? '#' + [...color.slice(1)].map(c => c+c).join('') : color,
      bold,
      align,
      typography: { ...typographyDefaults, font, layout: 'straight', lineHeight: 1.1 },
    } as TextLayer);
  };
  const art = (n: number, x: number, y: number, w: number, h: number) => {
    const item = scene.items[n],
      size = item && sizes.get(item.id);
    if (!item || !size) throw new Error(`Missing composition artwork: ${scene.id}/${n}`);
    const scale = Math.min(w / size.width, h / size.height),
      width = size.width * scale,
      height = size.height * scale;
    plan.layers.push({
      kind: 'artwork',
      id: `${scene.id}-${++index}`,
      label: `Artwork ${n + 1}`,
      artworkId: item.id,
      x: x + (w - width) / 2,
      y: y + (h - height) / 2,
      width,
      height,
    });
  };
  const field = (label: string, x: number, y: number, w: number, color = '#b7c8d8') => {
    text(label, label, x, y, 20, '#36546e', true);
    line(`${label} line`, x, y + 38, x + w, y + 38, color);
  };
  const border = (color: string, inset = 45, width = 2) =>
    rect('Frame', inset, inset, 1400 - 2 * inset, 1000 - 2 * inset, 'none', 0, color, width);
  const chip = (label: string, x: number, y: number, w: number, color: string, ink = '#fff') => {
    rect(`${label} block`, x, y, w, 64, color, 12);
    text(label, label, x + w / 2, y + 42, 23, ink, true, 'sans', 'middle');
  };
  switch (scene.id) {
    case 'study-desk':
      plan.background = '#f5f3ec';
      rect('Blue page', 760, 0, 640, 1000, '#dbe9f6');
      rect('Notebook panel', 55, 50, 650, 900, '#fff', 20);
      text('Eyebrow', 'FOCUS NOTES', 95, 110, 23, '#3a6487', true);
      text('Main heading', 'MAKE ROOM\nFOR IDEAS', 95, 230, 92, '#163a60', true);
      line('Heading rule', 98, 390, 640, 390, '#163a60', 5);
      art(0, 715, 170, 670, 550);
      text('Subheading', 'A little focus. A fresh perspective.', 95, 460, 27);
      field('THIS WEEK', 95, 560, 520);
      for (let i = 0; i < 3; i++) {
        rect('Checklist box', 98, 655 + i * 72, 22, 22, 'none', 4, '#7090ad', 2);
        line('Checklist line', 145, 677 + i * 72, 615, 677 + i * 72, '#c4d3df');
      }
      text('Desk caption', 'YOUR SPACE TO THINK', 1080, 815, 25, '#345e87', true, 'sans', 'middle');
      break;
    case 'music-practice':
      plan.background = '#eee9dc';
      circle('Record edge', 420, 535, 310, '#28344b');
      circle('Record groove', 420, 535, 260, 'none', '#657087', 2);
      circle('Record label', 420, 535, 115, '#cfa273');
      circle('Record center', 420, 535, 22, '#eee9dc');
      art(0, 70, 150, 610, 730);
      text('Poster eyebrow', 'PRACTICE / PLAY / REPEAT', 760, 120, 22, '#765534', true);
      text('Poster title', 'MAKE\nSOME\nMUSIC', 745, 265, 104, '#26354e', true, 'serif');
      art(1, 1040, 510, 280, 320);
      field('YOUR NEXT SESSION', 760, 780, 540);
      text('Footer', 'Find your rhythm. Make it yours.', 760, 925, 25, '#70563a', false, 'serif');
      break;
    case 'back-to-school':
      plan.background = '#fff8e9';
      rect('Red corner', 0, 0, 1400, 30, '#d86858');
      rect('Blue corner', 1210, 30, 190, 230, '#8ebce7');
      circle('Yellow circle', 1210, 700, 170, '#f3c75f');
      text('Eyebrow', 'READY FOR A NEW CHAPTER', 75, 110, 23, '#a44d43', true);
      text('Heading', 'LET’S LEARN\nSOMETHING\nNEW.', 70, 260, 102, '#153959', true);
      art(0, 790, 100, 480, 480);
      art(1, 730, 500, 590, 260);
      rect('Details band', 65, 825, 1270, 120, '#fff', 16, '#dfd9c7', 2);
      field('NAME', 100, 866, 350);
      field('CLASS', 515, 866, 330);
      field('YEAR', 910, 866, 345);
      break;
    case 'robot-lab':
      plan.background = '#142e49';
      for (let x = 50; x < 1400; x += 80) line('Blueprint vertical', x, 0, x, 1000, '#22445f', 1);
      for (let y = 40; y < 1000; y += 80) line('Blueprint horizontal', 0, y, 1400, y, '#22445f', 1);
      circle('Robot halo', 1060, 475, 270, '#244f6b');
      text('Eyebrow', 'THE INVENTION CLUB', 80, 115, 24, '#89d8e8', true);
      text('Heading', 'IDEAS IN\nMOTION', 70, 280, 112, '#fff', true);
      text('Prompt', 'Curiosity is the starting point.', 80, 485, 30, '#c5deeb');
      art(0, 800, 180, 500, 590);
      art(1, 95, 565, 275, 290);
      chip('ASK', 430, 630, 260, '#56afc6');
      chip('BUILD', 430, 710, 260, '#496ac2');
      chip('TRY AGAIN', 430, 790, 260, '#7c64a8');
      text('Footer', 'YOUR PROJECT  /  YOUR TEAM  /  YOUR NEXT IDEA', 80, 940, 23, '#b8d6e7');
      break;
    case 'basketball-practice':
      plan.background = '#1b2531';
      vector('Court stripe', '<path d="M830 0H1400V1000H1130L600 0Z" fill="#e58a41"/>');
      line('Court edge', 1040, 0, 1330, 1000, '#f4b775', 7);
      text('Eyebrow', 'TEAM PRACTICE', 75, 110, 25, '#f6bd78', true);
      text('Heading', 'SHOW UP.\nSTEP UP.', 65, 285, 117, '#fff', true);
      text('Message', 'Bring your energy.', 80, 535, 38, '#f2bc80', false, 'serif');
      art(0, 730, 85, 620, 650);
      art(1, 280, 565, 400, 240);
      rect('Event panel', 65, 840, 1270, 115, '#f6eee2', 10);
      field('DATE', 100, 880, 330);
      field('TIME', 495, 880, 330);
      field('COURT', 900, 880, 340);
      break;
    case 'thank-you-dad':
      plan.background = '#f5eee2';
      border('#b48c51', 40, 3);
      border('#d7c4a4', 55, 1);
      circle('Warm circle', 445, 620, 270, '#eadac0');
      text('Eyebrow', 'A NOTE OF THANKS', 700, 125, 22, '#796139', true, 'sans', 'middle');
      text(
        'Greeting',
        'For the one\nwho shows up.',
        700,
        235,
        73,
        '#263e58',
        false,
        'serif',
        'middle',
      );
      art(0, 90, 435, 770, 420);
      art(1, 960, 365, 300, 410);
      text(
        'Message',
        'Thank you for the everyday things\nthat mean more than words can say.',
        760,
        850,
        28,
        '#5e5142',
        false,
        'serif',
        'middle',
      );
      line('Signature line', 610, 925, 1100, 925, '#ba9b6e', 2);
      text('Signature introduction', 'With love,', 465, 926, 25, '#796139', false, 'serif');
      break;
    case 'movie-night':
      plan.background = '#203249';
      rect('Ticket', 65, 85, 1270, 830, '#f7edd6', 25);
      rect('Title band', 65, 85, 1270, 180, '#d2a25e', 25);
      text('Title', 'MOVIE NIGHT', 125, 208, 96, '#203249', true, 'serif');
      for (let y = 295; y < 860; y += 36)
        line('Ticket perforation', 1040, y, 1040, y + 17, '#bca781', 3);
      art(0, 100, 305, 490, 450);
      art(1, 565, 350, 400, 350);
      text('Admission', 'ADMIT\nYOUR CREW', 1185, 410, 42, '#203249', true, 'sans', 'middle');
      for (let i = 0; i < 23; i++)
        rect('Ticket barcode', 1080 + i * 9, 680, 3 + (i % 3), 95, '#243951');
      text('Ticket number', 'Nº 0001', 1185, 820, 23, '#314b60', false, 'mono', 'middle');
      field('DATE & TIME', 125, 805, 370);
      field('PLACE', 580, 805, 370);
      break;
    case 'earth-day':
      plan.background = '#f2f6ee';
      text('Eyebrow', 'LOOK CLOSER', 70, 100, 23, '#517c60', true);
      text('Heading', 'OUR BLUE PLANET', 65, 205, 82, '#1f4960', true, 'serif');
      circle('Globe halo', 370, 570, 275, '#d9e8dc');
      art(0, 85, 300, 590, 600);
      art(1, 1060, 135, 240, 220);
      for (const [i, head, body] of [
        [0, 'EXPLORE', 'Look for something you have not noticed.'],
        [1, 'NOTICE', 'Draw a shape, a leaf or a changing color.'],
        [2, 'PROTECT', 'Choose one small thing to care for.'],
      ] as const) {
        circle('Step marker', 775, 350 + i * 175, 29, '#497b64');
        text('Step number', String(i + 1), 775, 359 + i * 175, 23, '#fff', true, 'sans', 'middle');
        text('Step title', head, 835, 355 + i * 175, 35, '#244e5e', true);
        text('Step prompt', body, 835, 405 + i * 175, 19, '#4c665e');
      }
      line('Footer rule', 75, 905, 1320, 905, '#a8c3ae');
      text(
        'Footer',
        'EVERY SMALL ACTION MATTERS.',
        700,
        960,
        25,
        '#49715a',
        true,
        'sans',
        'middle',
      );
      break;
    case 'seaside-postcard':
      plan.background = '#cfe5ed';
      rect('Postcard paper', 50, 45, 1300, 910, '#fffbf1', 16);
      rect('Photo frame', 85, 180, 720, 650, '#dceef2', 8);
      art(0, 100, 225, 690, 560);
      text('Heading', 'Seaside days.', 95, 130, 66, '#315c78', false, 'serif');
      line('Address divider', 855, 225, 855, 830, '#b1c4c9', 2);
      rect('Stamp', 1160, 85, 130, 150, 'none', 0, '#567993', 3);
      art(1, 1170, 100, 110, 120);
      text('Address label', 'A NOTE FROM SOMEWHERE NICE', 910, 320, 19, '#4e7386', true);
      for (let i = 0; i < 5; i++)
        line('Address line', 910, 400 + i * 80, 1280, 400 + i * 80, '#c5d3d5', 2);
      text('Footer', 'Wish you were here.', 110, 903, 37, '#456d80', false, 'serif');
      break;
    case 'arcade-game-night':
      plan.background = '#24233f';
      border('#bb8bed', 35, 4);
      border('#657fe1', 53, 2);
      for (let i = 0; i < 8; i++)
        rect('Pixel step', 104 + i * 36, 790 - (i % 2) * 24, 24, 24, i % 2 ? '#aa81d7' : '#6f97df');
      text('Eyebrow', 'YOU ARE INVITED', 95, 135, 24, '#d1baf3', true, 'mono');
      text('Heading', 'PRESS\nPLAY', 85, 300, 150, '#fff', true);
      art(0, 645, 160, 680, 510);
      art(1, 875, 645, 340, 245);
      chip('YOUR DATE', 100, 900, 340, '#6d65ac');
      chip('YOUR PLACE', 500, 900, 340, '#4360a8');
      chip('BRING A FRIEND', 900, 900, 400, '#8d5d9b');
      break;
    case 'reading-corner':
      plan.background = '#f4eddf';
      border('#a59678', 45, 2);
      text('Eyebrow', 'THE READING CORNER', 700, 125, 24, '#7d6846', true, 'sans', 'middle');
      text('Heading', 'One more chapter.', 700, 245, 86, '#344a53', false, 'serif', 'middle');
      line('Title rule', 170, 295, 1230, 295, '#bfab87', 2);
      art(0, 90, 365, 730, 390);
      art(1, 885, 395, 370, 350);
      chip('READ', 110, 825, 340, '#455e64');
      chip('THINK', 530, 825, 340, '#786a50');
      chip('SHARE', 950, 825, 340, '#65745b');
      break;
    case 'floral-greeting':
      plan.background = '#fbf5f0';
      border('#d7b6aa', 35, 2);
      border('#dfc5bc', 52, 1);
      art(0, 100, 150, 700, 700);
      text('Greeting', 'With\nLove', 450, 475, 83, '#7e4c57', false, 'serif', 'middle');
      line('Note divider', 855, 150, 855, 850, '#d7c1b4', 2);
      text(
        'Note heading',
        'A little note for you',
        1075,
        235,
        37,
        '#6c4e50',
        false,
        'serif',
        'middle',
      );
      text('Personal note', 'A little something,\njust for you.', 1075, 352, 28, '#6c4e50', false, 'serif', 'middle');
      for (let i = 0; i < 4; i++)
        line('Message line', 910, 330 + i * 65, 1250, 330 + i * 65, '#dbc9c0');
      art(1, 990, 610, 235, 270);
      break;
    case 'fresh-strawberries':
      plan.background = '#fff9ed';
      rect('Recipe sidebar', 760, 0, 640, 1000, '#efe5d5');
      text('Eyebrow', 'FROM THE KITCHEN', 80, 110, 22, '#a34f4a', true);
      text('Heading', 'FRESHLY\nPICKED', 70, 260, 103, '#943e46', true, 'serif');
      art(0, 75, 410, 650, 470);
      text('Recipe heading', 'Make something good.', 825, 150, 40, '#4f483c', false, 'serif');
      field('RECIPE NAME', 825, 250, 485);
      text('Ingredients label', 'INGREDIENTS', 825, 375, 23, '#675c49', true);
      for (let i = 0; i < 5; i++)
        line('Ingredient line', 825, 425 + i * 65, 1300, 425 + i * 65, '#c1b59f');
      field('PREP TIME', 825, 855, 210);
      field('SERVES', 1095, 855, 210);
      break;
    case 'little-explorer':
      plan.background = '#f0f4ec';
      circle('Soft sun', 1080, 225, 160, '#e9d5af');
      for (const [x, y, r] of [
        [100, 170, 8],
        [360, 90, 6],
        [1240, 440, 7],
        [890, 800, 5],
        [1300, 90, 5],
        [770, 275, 4],
      ])
        circle('Constellation dot', x, y, r, '#a5bca8');
      text('Heading', 'A little\nadventure', 610, 210, 95, '#536d64', false, 'serif', 'middle');
      art(0, 75, 450, 720, 390);
      text('Personal subtitle', 'A story of our own', 610, 420, 30, '#536d64', false, 'serif', 'middle');
      art(1, 855, 300, 390, 545);
      rect('Keepsake band', 65, 870, 1270, 85, '#dce6d8', 12);
      text(
        'Personal details',
        'NAME  /  DATE  /  A MEMORY TO KEEP',
        700,
        924,
        26,
        '#4f675f',
        false,
        'sans',
        'middle',
      );
      break;
    case 'woodland-welcome':
      plan.background = '#f6f0e6';
      vector(
        'Oval frame',
        '<ellipse cx="700" cy="490" rx="545" ry="385" fill="#e4e7d7"/><ellipse cx="700" cy="490" rx="512" ry="354" fill="#fffaf1" stroke="#b4bea4" stroke-width="2"/>',
      );
      for (const [x, y, a] of [
        [165, 245, -25],
        [1170, 640, 30],
        [175, 665, 35],
        [1165, 240, -35],
      ])
        vector(
          'Leaf accent',
          `<ellipse cx="${x}" cy="${y}" rx="22" ry="58" transform="rotate(${a} ${x} ${y})" fill="#a2b296"/>`,
        );
      text('Greeting', 'Welcome,\nlittle one.', 700, 340, 77, '#58634c', false, 'serif', 'middle');
      art(0, 150, 495, 480, 330);
      art(1, 860, 530, 300, 250);
      text('Personal dedication', 'A new story begins.', 700, 625, 31, '#697358', false, 'serif', 'middle');
      text('Dedication', 'WITH ALL OUR LOVE', 700, 914, 25, '#697358', true, 'sans', 'middle');
      break;
    case 'citrus-notes':
      plan.background = '#f7f2dd';
      rect('Citrus panel', 670, 0, 730, 1000, '#e8eccf');
      text('Eyebrow', 'KITCHEN NOTES', 75, 100, 23, '#667f47', true);
      text('Heading', 'A FRESH\nSTART', 65, 240, 110, '#345447', true);
      for (let i = 0; i < 3; i++) {
        text('Note label', ['PLAN', 'PREP', 'ENJOY'][i], 90, 560 + i * 135, 23, '#576e43', true);
        line('Note line', 90, 603 + i * 135, 570, 603 + i * 135, '#aebd92', 2);
      }
      art(0, 690, 150, 640, 430);
      art(1, 810, 585, 440, 290);
      circle('Corner accent', 1300, 80, 30, '#d6b349');
      break;
    case 'wildlife-collection':
      plan.background = '#eceade';
      rect('Header', 0, 0, 1400, 255, '#28474d');
      text('Eyebrow', 'A NATURE OBSERVATION SHEET', 70, 75, 22, '#b9d1c9', true);
      text('Heading', 'THE WILD FILES', 60, 193, 96, '#fff', true, 'serif');
      for (let i = 0; i < 3; i++) {
        const x = 55 + i * 450;
        rect('Animal card', x, 305, 390, 585, '#faf7ef', 12, '#c7cbb9', 2);
        art(i, x + 20, 350, 350, 335);
        text(
          'Animal label',
          ['ELEPHANT', 'GIRAFFE', 'ZEBRA'][i],
          x + 195,
          752,
          30,
          '#35574f',
          true,
          'sans',
          'middle',
        );
        text('Observation prompt', 'I notice…', x + 28, 811, 24, '#70826b', false, 'serif');
        line('Observation line', x + 28, 855, x + 360, 855, '#aebeaa');
      }
      text(
        'Footer',
        'Look closely. Draw carefully. Stay curious.',
        700,
        955,
        28,
        '#486956',
        false,
        'serif',
        'middle',
      );
      break;
    case 'best-friends':
      plan.background = '#f7f2e9';
      text('Eyebrow', 'A LITTLE ROUTINE. A LOT OF LOVE.', 70, 90, 23, '#6c8192', true);
      text('Heading', 'PAWS & PLANS', 65, 205, 89, '#2b4e6b', true, 'serif');
      art(0, 825, 70, 310, 280);
      art(1, 1110, 140, 235, 220);
      rect('Weekly planner', 65, 395, 1270, 510, '#fff', 15, '#c7d7df', 2);
      const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
      for (let i = 0; i < 7; i++) {
        const x = 350 + i * 138;
        text('Day', days[i], x, 460, 23, '#496b80', true, 'sans', 'middle');
        if (i < 6) line('Day divider', x + 69, 490, x + 69, 870, '#dce5e8');
        for (let row = 0; row < 3; row++)
          circle('Activity check', x, 560 + row * 120, 16, 'none', '#a8bfcb', 2);
      }
      for (let i = 0; i < 3; i++) {
        text('Activity', ['WALK', 'PLAY', 'CARE'][i], 100, 570 + i * 120, 26, '#4d6e7e', true);
        if (i < 2) line('Row divider', 90, 625 + i * 120, 1310, 625 + i * 120, '#dce5e8');
      }
      break;
    default:
      throw new Error(`Unknown studio composition: ${scene.id}`);
  }
  return plan;
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
export function studioCompositionSvg(plan: Composition, images: ReadonlyMap<string, string>) {
  const nodes = [`<rect width="1400" height="1000" fill="${plan.background}"/>`];
  for (const layer of plan.layers) {
    if (layer.kind === 'artwork') {
      const src = images.get(layer.artworkId);
      if (!src) throw new Error(`Missing preview: ${layer.artworkId}`);
      nodes.push(
        `<image href="${escape(src)}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}"/>`,
      );
    } else if (layer.kind === 'vector') nodes.push(layer.markup);
    else if (layer.kind === 'text') {
      const font =
        layer.typography?.font === 'serif'
          ? 'Georgia, Times New Roman, serif'
          : layer.typography?.font === 'mono'
            ? 'Courier New, monospace'
            : 'UltraEditorText, Arial, sans-serif';
      for (const [n, line] of layer.text.split('\n').entries())
        nodes.push(
          `<text x="${layer.x}" y="${layer.y + n * layer.size * 1.1}" font-family="${font}" font-size="${layer.size}" font-weight="${layer.bold ? '700' : '400'}" text-anchor="${layer.align}" fill="${layer.color}">${escape(line)}</text>`,
        );
    }
  }
  return nodes.join('');
}
