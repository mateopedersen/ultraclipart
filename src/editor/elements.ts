/** Original, local vector elements. No network, bitmap previews, or untrusted markup. */
export interface StudioElement {
  id: string;
  name: string;
  category: string;
  tags: string;
  markup: string;
}
const ink = '#17274f',
  blue = '#1768e8',
  pink = '#f173a9',
  gold = '#ffc84b',
  green = '#36b78c',
  purple = '#9467e8';
const colors = [blue, pink, green, purple, gold, '#f28b51'];
const n = (v: number) => Number(v.toFixed(2));
const point = (a: number, r: number) => `${n(128 + Math.cos(a) * r)},${n(128 + Math.sin(a) * r)}`;
const path = (d: string, fill: string, stroke = 'none', width = 4) =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle = (x: number, y: number, r: number, fill: string) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, rx = 8) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
const polygon = (points: string, fill: string) => `<polygon points="${points}" fill="${fill}"/>`;
const ring = (r: number, c: string, width = 6) =>
  `<circle cx="128" cy="128" r="${r}" fill="none" stroke="${c}" stroke-width="${width}"/>`;
const rotate = (markup: string, a: number) => `<g transform="rotate(${a} 128 128)">${markup}</g>`;
const star = (points: number, inner: number, outer: number, fill: string, phase = -Math.PI / 2) =>
  polygon(
    Array.from({ length: points * 2 }, (_, j) =>
      point(phase + (j * Math.PI) / points, j % 2 ? inner : outer),
    ).join(' '),
    fill,
  );
const items: StudioElement[] = [];
const add = (category: string, name: string, markup: string, tags = '') =>
  items.push({
    id: `${category.toLowerCase().replace(/[^a-z]+/g, '-')}-${items.length + 1}`,
    name,
    category,
    tags,
    markup,
  });
for (let i = 0; i < 24; i++) {
  const petals = 4 + (i % 8),
    style = Math.floor(i / 8),
    c = colors[i % colors.length];
  const petal =
    style === 0
      ? `<ellipse cx="128" cy="73" rx="${n(58 / Math.sqrt(petals))}" ry="45" fill="${c}"/>`
      : style === 1
        ? path('M128 128 C74 95 101 35 128 22 C155 35 182 95 128 128Z', c)
        : path('M128 128 Q81 70 111 30 Q136 9 151 42 Q169 85 128 128Z', c);
  add(
    'Flowers',
    `${['Daisy', 'Lotus', 'Pinwheel'][style]} · ${petals} petals`,
    Array.from({ length: petals }, (_, j) => rotate(petal, (j * 360) / petals)).join('') +
      circle(128, 128, 27, gold) +
      circle(120, 120, 8, '#fff1b8'),
    'floral garden blossom',
  );
}
for (let i = 0; i < 24; i++) {
  const pairs = 2 + (i % 6),
    style = Math.floor(i / 6),
    c = colors[[2, 0, 3, 1][style]];
  let svg = path('M128 230 Q140 130 128 24', 'none', '#22694e', 7);
  for (let j = 0; j < pairs; j++) {
    const y = n(195 - (j * 145) / pairs),
      w = 45 + style * 9;
    const leaf =
      style === 2
        ? `<ellipse cx="${128 - w / 2}" cy="${y - 17}" rx="${w / 2}" ry="20" fill="${c}"/>`
        : path(`M128 ${y} Q${128 - w} ${y + 10} ${128 - w} ${y - 46} Q128 ${y - 48} 128 ${y}Z`, c);
    svg += leaf + `<g transform="translate(256 0) scale(-1 1)">${leaf}</g>`;
  }
  add(
    'Botanical',
    `${['Olive sprig', 'Fern frond', 'Eucalyptus', 'Laurel branch'][style]} · ${pairs} pairs`,
    svg,
    'leaf leaves plant foliage nature',
  );
}
for (let i = 0; i < 24; i++) {
  const points = 4 + (i % 8),
    style = Math.floor(i / 8),
    c = colors[i % 6];
  add(
    'Stars',
    `${['Classic star', 'Sparkle burst', 'Layered star'][style]} · ${points} points`,
    star(points, [49, 24, 72][style], 105, c) +
      (style === 2 ? star(points, 32, 58, '#ffffff') : star(points, 14, 31, '#ffffff')),
    'award celestial magic sparkle',
  );
}
for (let i = 0; i < 24; i++) {
  const sides = 3 + (i % 8),
    style = Math.floor(i / 8),
    c = colors[i % 6];
  let svg =
    style === 0
      ? polygon(
          Array.from({ length: sides }, (_, j) =>
            point((j * Math.PI * 2) / sides - Math.PI / 2, 104),
          ).join(' '),
          c,
        )
      : style === 1
        ? star(sides + 5, 90, 108, c)
        : circle(128, 128, 99, c);
  svg +=
    style === 2
      ? Array.from({ length: sides + 4 }, (_, j) =>
          rotate(rect(122, 16, 12, 24, '#ffffff', 4), (j * 360) / (sides + 4)),
        ).join('')
      : '';
  svg += ring(68, '#ffffff', 4) + circle(128, 128, 57, '#ffffff');
  add(
    'Badges',
    `${['Polygon seal', 'Scalloped seal', 'Stitched medallion'][style]} · ${sides}`,
    svg,
    'label award emblem sticker',
  );
}
for (let i = 0; i < 24; i++) {
  const style = Math.floor(i / 6),
    count = 6 + (i % 6),
    c = colors[i % 6];
  let svg = '';
  if (style === 0)
    svg =
      `<rect x="23" y="35" width="210" height="186" rx="${(i % 6) * 9}" fill="none" stroke="${c}" stroke-width="12"/>` +
      `<rect x="38" y="50" width="180" height="156" rx="${(i % 6) * 6}" fill="none" stroke="${c}" stroke-width="3"/>`;
  if (style === 1)
    svg =
      ring(94, c, 8) +
      Array.from({ length: count * 2 }, (_, j) =>
        rotate(circle(128, 24, 5, c), (j * 180) / count),
      ).join('');
  if (style === 2)
    svg = Array.from({ length: count * 2 }, (_, j) =>
      rotate(
        path('M128 27 Q109 19 112 40 Q124 52 128 27 M128 27 Q147 19 144 40 Q132 52 128 27', c),
        (j * 180) / count,
      ),
    ).join('');
  if (style === 3) {
    const w = 28 + (i % 6) * 5;
    svg = [0, 90, 180, 270]
      .map((a) =>
        rotate(path(`M28 ${28 + w} V28 H${28 + w} M39 ${28 + w} V39 H${28 + w}`, 'none', c, 5), a),
      )
      .join('');
  }
  add(
    'Frames',
    `${['Double frame', 'Dotted circle', 'Leaf wreath', 'Open corner frame'][style]} · ${(i % 6) + 1}`,
    svg,
    'border outline photo invitation',
  );
}
for (let i = 0; i < 24; i++) {
  const style = Math.floor(i / 6),
    a = (i % 6) * 60,
    c = colors[i % 6];
  const svg =
    style === 0
      ? path('M26 104 H146 V57 L234 128 L146 199 V152 H26Z', c)
      : style === 1
        ? path('M28 191 Q32 76 169 92 L165 48 L231 112 L159 162 L164 122 Q68 102 28 191Z', c)
        : style === 2
          ? path(
              'M24 103 H66 V74 L128 24 L190 74 V103 H232 V153 H190 V182 L128 232 L66 182 V153 H24Z',
              c,
            )
          : path('M34 62 L106 128 L34 194 M122 62 L194 128 L122 194', 'none', c, 22);
  add(
    'Arrows',
    `${['Block arrow', 'Curved arrow', 'Compass arrow', 'Double chevron'][style]} · ${a}°`,
    rotate(svg, a),
    'direction pointer navigation',
  );
}
for (let i = 0; i < 24; i++) {
  const style = Math.floor(i / 6),
    tail = 42 + (i % 6) * 25,
    c = colors[i % 6];
  let svg =
    style === 0
      ? path(
          `M44 35 H212 Q234 35 234 57 V156 Q234 178 212 178 H${tail + 35} L${tail - 12} 221 L${tail} 178 H44 Q22 178 22 156 V57 Q22 35 44 35Z`,
          c,
        )
      : style === 1
        ? `<ellipse cx="128" cy="110" rx="106" ry="79" fill="${c}"/>` +
          circle(tail, 197, 15, c) +
          circle(tail - 17, 223, 8, c)
        : style === 2
          ? path(
              `M24 64 Q24 42 46 42 H210 Q232 42 232 64 V157 Q232 179 210 179 H${tail + 27} L${tail} 215 V179 H46 Q24 179 24 157Z`,
              '#ffffff',
              c,
              9,
            )
          : path(`M24 52 H232 V170 H${tail + 24} L${tail} 210 V170 H24Z`, c);
  add(
    'Speech bubbles',
    `${['Speech bubble', 'Thought cloud', 'Outlined bubble', 'Comic caption'][style]} · ${(i % 6) + 1}`,
    svg,
    'text quote conversation comic label',
  );
}
for (let i = 0; i < 24; i++) {
  const style = Math.floor(i / 6),
    waves = 2 + (i % 6),
    c = colors[i % 6];
  let svg = '';
  if (style === 0) {
    for (let j = 0; j < waves; j++)
      svg += path(
        `M24 ${55 + (j * 145) / waves} Q76 ${15 + (j * 145) / waves} 128 ${55 + (j * 145) / waves} T232 ${55 + (j * 145) / waves}`,
        'none',
        c,
        7,
      );
  }
  if (style === 1) {
    for (let j = 0; j < waves; j++)
      svg += rotate(path('M128 28 Q77 62 128 121 Q179 62 128 28Z', c), (j * 360) / waves);
    svg += circle(128, 128, 17, gold);
  }
  if (style === 2) {
    svg = path('M22 80 H60 V58 H196 V80 H234 L215 116 L234 152 H196 V174 H60 V152 H22 L41 116Z', c);
    for (let j = 0; j < waves; j++) svg += rect(78 + (j * 100) / waves, 80, 5, 72, '#ffffff', 2);
  }
  if (style === 3) {
    for (let j = 0; j < waves; j++)
      svg += rotate(
        path('M128 30 C92 6 63 54 128 101 C193 54 164 6 128 30Z', c),
        (j * 360) / waves,
      );
    svg += circle(128, 128, 12, gold);
  }
  add(
    'Decorations',
    `${['Wave divider', 'Petal mandala', 'Ribbon banner', 'Heart rosette'][style]} · ${waves}`,
    svg,
    'ornament border celebration flourish',
  );
}
const objects: [string, string, string][] = [
  [
    'Sunny day',
    'Weather',
    circle(128, 128, 55, gold) +
      Array.from({ length: 12 }, (_, j) => rotate(rect(123, 18, 10, 28, gold, 5), j * 30)).join(
        '',
      ) +
      circle(112, 116, 6, ink) +
      circle(144, 116, 6, ink) +
      path('M108 142 Q128 161 148 142', 'none', ink, 5),
  ],
  [
    'Rain cloud',
    'Weather',
    path('M53 148 C8 148 14 85 53 84 C64 28 142 25 163 75 C217 49 254 134 208 148Z', '#9ecbff') +
      path('M73 170 L58 207 M126 170 L111 207 M179 170 L164 207', 'none', blue, 9),
  ],
  [
    'Rainbow',
    'Weather',
    [0, 1, 2, 3, 4]
      .map((j) =>
        path(
          `M${24 + j * 18} 215 V139 C${24 + j * 18} ${139 - (104 - j * 18) * 0.5522848} ${128 - (104 - j * 18) * 0.5522848} ${139 - (104 - j * 18)} 128 ${139 - (104 - j * 18)} C${128 + (104 - j * 18) * 0.5522848} ${139 - (104 - j * 18)} ${232 - j * 18} ${139 - (104 - j * 18) * 0.5522848} ${232 - j * 18} 139 V215`,
          'none',
          [pink, gold, green, blue, purple][j],
          17,
        ),
      )
      .join(''),
  ],
  [
    'Crescent moon',
    'Weather',
    path('M174 24 C67 5 12 121 73 195 C118 249 205 218 231 160 C137 191 78 78 174 24Z', gold) +
      star(4, 8, 25, '#f28b51'),
  ],
  [
    'Snow crystal',
    'Weather',
    Array.from({ length: 6 }, (_, j) =>
      rotate(
        path(
          'M128 128 V25 M128 56 L105 38 M128 56 L151 38 M128 85 L100 66 M128 85 L156 66',
          'none',
          blue,
          8,
        ),
        j * 60,
      ),
    ).join(''),
  ],
  ['Lightning bolt', 'Weather', path('M136 16 L49 141 H113 L98 240 L213 101 H146 L166 16Z', gold)],
  [
    'Pencil',
    'School',
    rotate(
      rect(97, 35, 62, 154, gold, 2) +
        rect(97, 27, 62, 29, pink, 6) +
        rect(97, 56, 62, 13, '#a9b9cc', 0) +
        path('M97 189 L128 238 L159 189Z', '#f5cca1') +
        path('M116 220 L128 238 L140 220Z', ink) +
        rect(110, 69, 9, 119, '#fff0ad', 0),
      35,
    ),
  ],
  [
    'Open book',
    'School',
    path('M128 64 Q78 31 24 53 V202 Q78 180 128 213 Q178 180 232 202 V53 Q178 31 128 64Z', blue) +
      path(
        'M128 72 Q83 46 35 64 V187 Q85 171 128 201 Q174 171 221 187 V64 Q173 46 128 72Z',
        '#fff8e9',
      ) +
      path(
        'M128 72 V201 M49 95 L104 99 M49 122 L104 126 M151 99 L206 95 M151 126 L206 122',
        'none',
        '#8ba4c5',
        4,
      ),
  ],
  [
    'Paint palette',
    'School',
    path(
      'M128 22 C-5 15 -5 223 125 234 C171 239 125 191 168 175 C246 147 253 27 128 22Z',
      '#f3cca4',
    ) +
      circle(78, 74, 18, pink) +
      circle(138, 56, 18, gold) +
      circle(188, 91, 18, green) +
      circle(81, 145, 18, blue) +
      circle(169, 137, 15, '#ffffff'),
  ],
  [
    'School backpack',
    'School',
    path('M90 55 V43 Q90 16 128 16 Q166 16 166 43 V55', 'none', ink, 12) +
      rect(44, 48, 168, 188, blue, 38) +
      rect(63, 139, 130, 76, '#9bcbff', 18) +
      path('M75 155 H181', 'none', ink, 6) +
      rect(169, 154, 7, 20, gold, 3),
  ],
  [
    'Scissors',
    'School',
    path('M76 174 L189 22 L148 149 M180 174 L67 22 L108 149', '#bcc9dd', ink, 3) +
      ring(0, 'none') +
      `<ellipse cx="77" cy="192" rx="31" ry="39" fill="none" stroke="${pink}" stroke-width="15"/><ellipse cx="179" cy="192" rx="31" ry="39" fill="none" stroke="${blue}" stroke-width="15"/>` +
      circle(128, 129, 7, ink),
  ],
  [
    'Ruler',
    'School',
    rotate(
      rect(29, 91, 198, 74, gold, 8) +
        Array.from({ length: 10 }, (_, j) =>
          path(`M${42 + j * 18} 91 V${j % 2 ? 114 : 129}`, 'none', ink, 4),
        ).join(''),
      -25,
    ),
  ],
  [
    'Cupcake',
    'Food',
    path('M63 143 H193 L175 233 H81Z', pink) +
      path(
        'M52 147 Q25 104 69 91 Q58 49 106 53 Q136 3 162 56 Q206 41 203 91 Q242 111 204 147Z',
        '#ffe6bd',
      ) +
      circle(134, 39, 13, '#e94f67') +
      path('M98 163 L107 216 M128 163 V216 M158 163 L149 216', 'none', '#c84478', 6),
  ],
  [
    'Ice cream',
    'Food',
    path('M68 111 H188 L128 242Z', '#d99851') +
      path(
        'M87 139 L150 195 M107 122 L171 166 M160 132 L106 190 M139 119 L91 160',
        'none',
        '#f9d6a4',
        5,
      ) +
      path(
        'M52 113 C38 56 90 28 111 42 C147 8 206 41 205 92 Q233 136 181 137 Q152 158 128 137 Q91 157 72 135 Q51 143 52 113Z',
        pink,
      ),
  ],
  [
    'Strawberry',
    'Food',
    path('M128 69 C11 17 35 186 128 235 C221 186 245 17 128 69Z', '#ed5275') +
      path('M128 83 L81 34 L116 44 L128 14 L142 44 L177 34Z', green) +
      [
        [-38, 0],
        [0, 17],
        [38, 0],
        [-22, 53],
        [22, 53],
        [0, 91],
      ]
        .map(([x, y]) => `<ellipse cx="${128 + x}" cy="${100 + y}" rx="4" ry="7" fill="#ffdf8b"/>`)
        .join(''),
  ],
  [
    'Watermelon',
    'Food',
    path('M20 67 C20 155.37 68.35 227 128 227 C187.65 227 236 155.37 236 67Z', green) +
      path('M34 67 C34 144.87 76.08 208 128 208 C179.92 208 222 144.87 222 67Z', '#e7f2bd') +
      path('M47 67 C47 133.27 83.26 187 128 187 C172.74 187 209 133.27 209 67Z', pink) +
      [
        [-40, 0],
        [0, 22],
        [40, 0],
      ]
        .map(([x, y]) => `<ellipse cx="${128 + x}" cy="${100 + y}" rx="5" ry="9" fill="${ink}"/>`)
        .join(''),
  ],
  [
    'Coffee cup',
    'Food',
    path('M184 88 H203 C254 88 245 169 187 166', 'none', '#c77b50', 15) +
      path('M46 81 H190 V182 Q188 216 118 216 Q48 216 46 182Z', '#efad78') +
      path(
        'M73 229 H177 M94 61 C67 42 116 35 91 16 M143 61 C116 42 165 35 140 16',
        'none',
        ink,
        6,
      ) +
      path('M117 130 C85 101 69 150 118 177 C167 150 151 101 117 130Z', '#ffffff'),
  ],
  [
    'Apple',
    'Food',
    path(
      'M128 77 C31 3 4 166 91 231 Q112 240 128 223 Q144 240 165 231 C252 166 225 3 128 77Z',
      '#e75565',
    ) +
      path('M128 79 Q120 37 145 18', 'none', '#88533d', 9) +
      path('M128 52 Q149 13 192 35 Q174 71 128 52Z', green) +
      path('M64 112 Q53 135 68 162', 'none', '#ffb9bf', 10),
  ],
  [
    'Party balloon',
    'Party',
    `<ellipse cx="128" cy="94" rx="74" ry="82" fill="${purple}"/>` +
      path('M128 176 L116 190 H140Z', purple) +
      path('M128 191 C166 210 84 220 128 245', 'none', ink, 3) +
      path('M89 47 Q64 69 72 100', 'none', '#ded0ff', 10),
  ],
  [
    'Gift box',
    'Party',
    rect(39, 99, 178, 137, blue, 7) +
      rect(28, 79, 200, 42, '#78bbff', 7) +
      rect(113, 79, 30, 157, gold, 0) +
      path('M128 81 C14 78 84 -8 128 70 C172 -8 242 78 128 81Z', 'none', pink, 16),
  ],
  [
    'Party hat',
    'Party',
    path('M128 25 L30 218 Q128 253 226 218Z', purple) +
      path('M80 133 L176 170 M57 181 L201 210', 'none', pink, 17) +
      circle(128, 28, 18, gold) +
      circle(132, 103, 11, gold),
  ],
  [
    'Birthday cake',
    'Party',
    rect(36, 131, 184, 103, pink, 12) +
      path(
        'M36 144 V126 Q36 109 55 109 H201 Q220 109 220 126 V144 Q204 168 187 144 Q169 168 151 144 Q128 171 106 144 Q87 169 69 144 Q51 168 36 144Z',
        '#fff0d0',
      ) +
      [82, 128, 174]
        .map(
          (x) =>
            rect(x - 6, 61, 12, 49, blue, 3) +
            path(`M${x} 20 Q${x - 23} 53 ${x} 55 Q${x + 23} 53 ${x} 20Z`, gold),
        )
        .join(''),
  ],
  [
    'Bow tie',
    'Party',
    path(
      'M119 102 L29 55 Q9 128 29 201 L119 154 M137 102 L227 55 Q247 128 227 201 L137 154Z',
      pink,
    ) +
      rect(102, 94, 52, 68, '#c93c7d', 14) +
      path(
        'M39 84 L94 111 M39 173 L94 146 M217 84 L162 111 M217 173 L162 146',
        'none',
        '#ffb6d6',
        5,
      ),
  ],
  [
    'Confetti popper',
    'Party',
    path('M32 228 L70 107 L151 188Z', purple) +
      path('M49 170 L90 204 M64 127 L131 190', 'none', pink, 14) +
      path(
        'M100 107 Q76 55 122 24 M145 133 Q187 112 175 58 M158 165 Q208 190 233 137',
        'none',
        blue,
        7,
      ) +
      circle(180, 28, 12, gold) +
      rotate(rect(194, 62, 18, 28, green, 3), 12) +
      star(4, 6, 18, pink),
  ],
  [
    'Little fox',
    'Animals',
    path(
      'M39 124 L30 22 L103 66 Q128 58 153 66 L226 22 L217 124 Q212 208 128 237 Q44 208 39 124Z',
      '#ec8b45',
    ) +
      path('M45 45 L57 117 L94 80 M211 45 L199 117 L162 80Z', '#ffc793') +
      path('M43 138 Q93 130 128 200 Q163 130 213 138 Q195 208 128 230 Q61 208 43 138Z', '#fff2dc') +
      circle(86, 129, 8, ink) +
      circle(170, 129, 8, ink) +
      path('M115 195 Q128 186 141 195 L128 211Z', ink),
  ],
  [
    'Sleepy bear',
    'Animals',
    circle(61, 58, 37, '#b68768') +
      circle(195, 58, 37, '#b68768') +
      circle(61, 58, 21, '#f1c7a7') +
      circle(195, 58, 21, '#f1c7a7') +
      circle(128, 137, 100, '#c99a77') +
      `<ellipse cx="128" cy="174" rx="46" ry="35" fill="#f1c7a7"/>` +
      path('M64 128 Q79 143 94 128 M162 128 Q177 143 192 128', 'none', ink, 6) +
      path('M115 163 Q128 155 141 163 L128 175Z', ink),
  ],
  [
    'Cat face',
    'Animals',
    path('M38 107 L33 23 L97 66 Q128 58 159 66 L223 23 L218 107 C265 260 -9 260 38 107Z', gold) +
      path('M49 47 L54 99 L86 75 M207 47 L202 99 L170 75Z', pink) +
      circle(89, 133, 8, ink) +
      circle(167, 133, 8, ink) +
      path('M117 158 H139 L128 171Z', pink) +
      path(
        'M128 171 Q110 194 98 176 M128 171 Q146 194 158 176 M68 159 L20 149 M68 174 L20 181 M188 159 L236 149 M188 174 L236 181',
        'none',
        ink,
        4,
      ),
  ],
  [
    'Butterfly',
    'Animals',
    path(
      'M125 106 C87 -35 -20 31 34 116 C-4 186 90 254 125 155 M131 106 C169 -35 276 31 222 116 C260 186 166 254 131 155Z',
      purple,
    ) +
      path(
        'M125 110 C86 38 44 49 64 103 C35 151 87 199 125 145 M131 110 C170 38 212 49 192 103 C221 151 169 199 131 145Z',
        pink,
      ) +
      rect(118, 91, 20, 112, ink, 10) +
      path('M122 96 L103 66 M134 96 L153 66', 'none', ink, 5),
  ],
  [
    'Little fish',
    'Animals',
    path('M190 128 L238 70 V186Z', gold) +
      `<ellipse cx="107" cy="128" rx="91" ry="69" fill="${blue}"/>` +
      path('M105 68 L154 27 L160 87 M105 188 L154 229 L160 169Z', gold) +
      circle(61, 111, 10, '#ffffff') +
      circle(61, 111, 5, ink) +
      path('M117 105 L91 128 L117 151Z', '#92cdff'),
  ],
  [
    'Bumblebee',
    'Animals',
    `<ellipse cx="108" cy="67" rx="38" ry="45" fill="#bae3ff"/><ellipse cx="164" cy="67" rx="38" ry="45" fill="#bae3ff"/><ellipse cx="135" cy="142" rx="91" ry="65" fill="${gold}"/>` +
      path('M118 80 V204 M163 83 V201', 'none', ink, 19) +
      circle(65, 133, 34, gold) +
      circle(57, 125, 5, ink) +
      path('M219 129 L242 143 L219 157Z', ink),
  ],
  [
    'Tiny house',
    'Everyday',
    rect(47, 105, 162, 128, '#9dcbff', 4) +
      path('M20 113 L128 20 L236 113Z', pink) +
      rect(109, 155, 40, 78, ink, 4) +
      rect(65, 135, 28, 35, '#fff0af', 3) +
      rect(166, 135, 28, 35, '#fff0af', 3),
  ],
  [
    'Camera',
    'Everyday',
    rect(22, 74, 212, 148, blue, 22) +
      rect(68, 43, 91, 40, blue, 8) +
      circle(130, 148, 58, '#17274f') +
      circle(130, 148, 43, '#9bceff') +
      circle(130, 148, 29, '#328acb') +
      circle(118, 135, 12, '#eaf7ff') +
      rect(186, 93, 25, 15, gold, 4),
  ],
  [
    'Rocket ship',
    'Everyday',
    path('M82 150 L40 206 L78 216 M174 150 L216 206 L178 216Z', blue) +
      path('M93 202 L110 244 L128 221 L146 244 L163 202Z', gold) +
      path('M128 13 C75 52 66 143 89 203 H167 C190 143 181 52 128 13Z', '#c9e5ff') +
      path('M128 13 Q99 37 88 77 H168 Q157 37 128 13Z', pink) +
      circle(128, 121, 33, blue) +
      circle(128, 121, 23, '#ffffff'),
  ],
  [
    'Garden mushroom',
    'Botanical',
    path('M106 111 L90 225 Q128 247 166 225 L150 111Z', '#f4d9ae') +
      path('M17 128 C12 25 244 25 239 128 Q128 170 17 128Z', pink) +
      circle(76, 97, 18, '#ffffff') +
      circle(145, 66, 15, '#ffffff') +
      circle(189, 112, 20, '#ffffff'),
  ],
];
for (const [name, category, markup] of objects)
  add(category, name, markup, 'illustration object colorful');
const extraObjects: [string, string, string][] = [
  [
    'Potted cactus',
    'Nature',
    path(
      'M109 159 V57 Q109 20 141 30 Q157 35 157 58 V159 M110 100 H89 Q64 100 64 77 V63 M156 119 H177 Q198 119 198 93 V78',
      'none',
      green,
      23,
    ) +
      path('M80 157 H182 L168 236 H94Z', '#e89262') +
      rect(72, 151, 118, 24, '#f8b582', 8) +
      path('M125 50 V137 M133 188 V218', 'none', '#d7f7cb', 4),
  ],
  [
    'Sunflower stem',
    'Nature',
    path('M128 235 V116', 'none', '#278766', 9) +
      path(
        'M126 188 Q61 200 52 153 Q113 143 126 188 M131 168 Q194 180 209 135 Q150 122 131 168Z',
        green,
      ) +
      Array.from(
        { length: 12 },
        (_, j) =>
          `<g transform="rotate(${j * 30} 128 81)"><ellipse cx="128" cy="44" rx="12" ry="32" fill="${gold}"/></g>`,
      ).join('') +
      circle(128, 81, 30, '#8c5735') +
      circle(128, 81, 19, '#b77c45'),
  ],
  [
    'Tulip pot',
    'Nature',
    rect(81, 178, 95, 54, '#7da9ef', 8) +
      path('M128 187 V105', 'none', green, 8) +
      path(
        'M127 164 Q74 155 79 120 Q120 126 127 164 M132 148 Q188 139 180 105 Q139 113 132 148Z',
        green,
      ) +
      path('M79 42 L106 63 L128 26 L150 63 L177 42 V95 Q128 154 79 95Z', pink),
  ],
  [
    'Cherry blossom branch',
    'Nature',
    path('M35 229 Q92 151 213 38 M99 151 L79 66 M155 100 L218 129', 'none', '#92664e', 9) +
      [
        [78, 68],
        [143, 110],
        [211, 42],
        [213, 132],
      ]
        .map(
          ([x, y]) =>
            `<g transform="translate(${x - 32} ${y - 32}) scale(.25)">${Array.from({ length: 5 }, (_, j) => rotate(`<ellipse cx="128" cy="75" rx="40" ry="59" fill="#f6a1c5"/>`, j * 72)).join('') + circle(128, 128, 26, gold)}</g>`,
        )
        .join(''),
  ],
  [
    'Oak tree',
    'Nature',
    path('M111 238 L116 127 H146 L155 238Z', '#a97550') +
      circle(75, 115, 49, '#4dbf86') +
      circle(172, 108, 55, '#35a775') +
      circle(125, 68, 60, '#72cc8c') +
      path('M129 192 V135 M129 165 L102 143 M129 176 L158 149', 'none', '#805339', 7),
  ],
  [
    'Pine tree',
    'Nature',
    rect(113, 190, 30, 53, '#9b6b46', 3) +
      path('M128 12 L51 111 H79 L29 172 H65 L20 216 H236 L191 172 H227 L177 111 H205Z', '#319276') +
      path('M128 12 L128 216 H236 L191 172 H227 L177 111 H205Z', '#25735d') +
      path('M128 31 L109 66 H147Z', '#d8f2db'),
  ],
  [
    'Autumn maple leaf',
    'Nature',
    path(
      'M128 16 L149 70 L180 49 L176 101 L228 90 L210 137 L240 153 L165 185 L145 213 L128 198 L109 216 L91 185 L17 154 L46 137 L28 90 L80 101 L76 49 L107 70Z',
      '#e99a3f',
    ) + path('M128 69 V243 M128 170 L78 127 M128 170 L178 127', 'none', '#ae5b37', 6),
  ],
  [
    'Acorn',
    'Nature',
    path('M77 126 H179 V165 Q178 209 128 238 Q78 209 77 165Z', '#c89155') +
      path('M62 130 Q55 60 128 60 Q201 60 194 130Z', '#8d583a') +
      path('M128 62 Q119 35 142 19', 'none', '#745137', 11) +
      path(
        'M83 104 L96 91 L109 104 L122 91 L135 104 L148 91 L161 104 L174 91',
        'none',
        '#b78050',
        5,
      ),
  ],
  [
    'Red cherries',
    'Food',
    path('M75 167 Q124 114 128 35 Q135 117 185 166', 'none', '#3e9465', 7) +
      path('M128 38 Q173 9 205 41 Q164 76 128 38Z', green) +
      circle(72, 178, 48, '#e34d68') +
      circle(179, 178, 48, '#c93d5c') +
      path('M48 157 Q42 167 44 181 M155 157 Q149 167 151 181', 'none', '#ffbdc8', 7),
  ],
  [
    'Lemon slice',
    'Food',
    circle(128, 128, 106, gold) +
      circle(128, 128, 91, '#fff6cf') +
      Array.from({ length: 8 }, (_, j) =>
        rotate(path('M128 124 L128 48 Q160 48 181 71 L134 124Z', '#f4c841'), j * 45),
      ).join('') +
      circle(128, 128, 10, '#fff6cf'),
  ],
  [
    'Pineapple',
    'Food',
    path('M128 90 L70 30 L112 49 L128 9 L144 49 L186 30Z', green) +
      `<ellipse cx="128" cy="160" rx="69" ry="82" fill="${gold}"/>` +
      path(
        'M78 113 L177 213 M67 151 L151 235 M105 85 L193 173 M178 113 L79 213 M189 151 L105 235 M151 85 L63 173',
        'none',
        '#d99c38',
        6,
      ),
  ],
  [
    'Pear',
    'Food',
    path(
      'M128 45 C70 45 108 95 63 139 C-13 245 269 245 193 139 C148 95 186 45 128 45Z',
      '#b5cf57',
    ) +
      path('M128 47 Q116 22 142 10', 'none', '#8d653f', 7) +
      path('M134 40 Q157 5 186 28 Q161 57 134 40Z', green) +
      path('M73 160 Q59 186 82 199', 'none', '#e8ed9c', 8),
  ],
  [
    'Blueberry trio',
    'Food',
    circle(82, 163, 55, '#476cc4') +
      circle(176, 163, 55, '#5b83db') +
      circle(128, 82, 55, '#7398e6') +
      [
        [82, 163],
        [176, 163],
        [128, 82],
      ]
        .map(
          ([x, y]) =>
            `<g transform="translate(${x - 128} ${y - 128})">${star(5, 7, 17, '#304f94')}</g>`,
        )
        .join('') +
      path('M128 28 Q157 1 190 22 Q162 48 128 28Z', green),
  ],
  [
    'Avocado half',
    'Food',
    path('M128 18 C87 18 98 70 60 126 C-14 245 270 245 196 126 C158 70 169 18 128 18Z', '#357b50') +
      path(
        'M128 32 C101 32 110 81 73 134 C14 229 242 229 183 134 C146 81 155 32 128 32Z',
        '#c6db76',
      ) +
      circle(128, 164, 43, '#97643f') +
      circle(119, 151, 20, '#ba8755'),
  ],
  [
    'Pizza slice',
    'Food',
    path('M43 42 Q131 10 224 59 L133 238Z', '#f8c85b') +
      path('M45 44 Q133 10 222 59', 'none', '#d99651', 22) +
      circle(94, 93, 18, '#d84f54') +
      circle(163, 105, 18, '#d84f54') +
      circle(133, 166, 16, '#d84f54') +
      path('M118 73 L132 87 M82 128 L93 141 M164 146 L153 156', 'none', green, 7),
  ],
  [
    'Cookie',
    'Food',
    circle(128, 128, 103, '#d69b5d') +
      circle(128, 128, 91, '#e9b578') +
      [
        [79, 77],
        [164, 72],
        [126, 118],
        [73, 154],
        [170, 158],
        [124, 199],
      ]
        .map(([x, y]) => rotate(rect(x - 9, y - 9, 18, 18, '#81573c', 4), 12))
        .join('') +
      circle(104, 60, 5, '#fbd9a6') +
      circle(200, 117, 5, '#fbd9a6'),
  ],
  [
    'Shooting star',
    'Space',
    path('M30 215 Q58 93 177 53 L200 95 Q100 102 30 215Z', '#9ebafa') +
      path('M30 215 Q81 111 190 86', 'none', gold, 15) +
      `<g transform="translate(120 -19) scale(.48)">${star(5, 49, 105, gold)}</g>`,
  ],
  [
    'Ringed planet',
    'Space',
    circle(128, 128, 73, '#ad8be8') +
      path('M70 98 Q128 126 186 98 M62 132 Q128 161 194 132', 'none', '#cdb5f3', 10) +
      `<ellipse cx="128" cy="128" rx="119" ry="35" transform="rotate(-27 128 128)" fill="none" stroke="#efbd62" stroke-width="14"/>` +
      path('M82 73 Q124 43 162 65', 'none', '#e1cff8', 6),
  ],
  [
    'Astronaut helmet',
    'Space',
    circle(128, 120, 100, '#dce8f4') +
      rect(34, 191, 188, 48, '#91b5dd', 16) +
      `<ellipse cx="128" cy="122" rx="77" ry="72" fill="#315b95"/>` +
      path('M76 95 Q90 57 134 62', 'none', '#91c9f5', 12) +
      rect(14, 99, 23, 58, blue, 9) +
      rect(219, 99, 23, 58, blue, 9) +
      circle(182, 214, 7, gold),
  ],
  [
    'Satellite',
    'Space',
    rotate(
      rect(92, 72, 72, 113, '#ccd8e6', 12) +
        rect(11, 85, 74, 82, blue, 5) +
        rect(171, 85, 74, 82, blue, 5) +
        path(
          'M35 85 V167 M60 85 V167 M195 85 V167 M220 85 V167 M11 126 H85 M171 126 H245',
          'none',
          '#90bcf4',
          3,
        ) +
        path('M110 72 V41 H145 V72', 'none', '#829dbb', 7) +
        circle(128, 127, 19, gold) +
        path('M128 186 V225', 'none', ink, 6),
      -24,
    ),
  ],
  [
    'UFO',
    'Space',
    path('M70 115 Q70 17 128 17 Q186 17 186 115Z', '#8cdbdd') +
      path('M89 83 Q97 41 127 36', 'none', '#d7ffff', 8) +
      `<ellipse cx="128" cy="129" rx="113" ry="40" fill="#9b83df"/>` +
      `<ellipse cx="128" cy="119" rx="109" ry="28" fill="#c9b8fa"/>` +
      [59, 103, 149, 193].map((x) => circle(x, 139, 8, gold)).join('') +
      path('M91 175 L71 224 M128 181 V237 M165 175 L185 224', 'none', '#a6c6f4', 7),
  ],
  [
    'Telescope',
    'Space',
    rotate(
      rect(39, 78, 164, 58, blue, 10) +
        rect(180, 65, 32, 84, '#7cb2f5', 8) +
        rect(28, 89, 27, 37, ink, 6),
      -25,
    ) +
      path('M128 146 V231 M128 159 L72 231 M128 159 L184 231', 'none', '#7794b7', 9) +
      circle(128, 146, 13, gold),
  ],
  [
    'Earth globe',
    'Space',
    circle(128, 128, 107, blue) +
      path(
        'M61 43 L90 55 L98 87 L128 98 L121 133 L94 140 L86 182 L69 192 L53 152 L31 122 L23 90 M166 29 L155 56 L177 78 L211 72 L231 102 L205 118 L185 109 L161 132 L171 165 L211 180 L194 212 L152 213 L136 184 L149 151 L134 116 L156 88 L138 54Z',
        '#72c78e',
      ) +
      path('M59 61 Q72 44 90 38', 'none', '#b3e9f7', 7),
  ],
  [
    'Alien friend',
    'Space',
    path('M128 28 C-12 25 25 180 128 231 C231 180 268 25 128 28Z', '#8acc9e') +
      `<ellipse cx="82" cy="122" rx="29" ry="43" transform="rotate(-30 82 122)" fill="#345e68"/><ellipse cx="174" cy="122" rx="29" ry="43" transform="rotate(30 174 122)" fill="#345e68"/>` +
      circle(76, 108, 7, '#cfefdc') +
      circle(168, 108, 7, '#cfefdc') +
      path('M109 185 Q128 199 147 185', 'none', '#345e68', 5),
  ],
  [
    'Sailboat',
    'Travel',
    path('M30 172 H226 L191 220 H68Z', blue) +
      path('M126 25 V172', 'none', ink, 7) +
      path('M116 35 L35 158 H116Z', '#ffbd5b') +
      path('M138 58 L218 158 H138Z', pink) +
      path('M18 235 Q46 218 74 235 T130 235 T186 235 T242 235', 'none', '#8cc3f6', 7),
  ],
  [
    'Hot air balloon',
    'Travel',
    path('M72 150 L99 209 M184 150 L157 209', 'none', '#8f725a', 5) +
      path('M128 18 C-4 18 18 140 85 173 H171 C238 140 260 18 128 18Z', pink) +
      path('M128 18 C51 18 71 143 106 173 H150 C185 143 205 18 128 18Z', gold) +
      path('M128 18 C108 48 106 133 118 173 H138 C150 133 148 48 128 18Z', '#fff0cb') +
      rect(92, 200, 72, 43, '#b47d50', 7),
  ],
  [
    'Camper van',
    'Travel',
    rect(18, 63, 220, 139, '#8bd2ba', 20) +
      rect(18, 132, 220, 64, green, 0) +
      rect(40, 83, 60, 42, '#e8f6ff', 7) +
      rect(119, 83, 43, 42, '#e8f6ff', 7) +
      path('M181 83 H217 V125 H181Z', '#e8f6ff') +
      path('M176 136 V193 M187 150 H197', 'none', '#276c58', 5) +
      circle(67, 204, 26, ink) +
      circle(67, 204, 13, '#adc5df') +
      circle(190, 204, 26, ink) +
      circle(190, 204, 13, '#adc5df'),
  ],
  [
    'Bicycle',
    'Travel',
    `<circle cx="57" cy="171" r="45" fill="none" stroke="${ink}" stroke-width="8"/><circle cx="199" cy="171" r="45" fill="none" stroke="${ink}" stroke-width="8"/>` +
      path(
        'M57 171 L94 100 L131 171 H57 M131 171 L173 101 H94 M173 101 L199 171 M173 101 L163 68 H188 M94 100 L85 78 H70',
        'none',
        pink,
        8,
      ) +
      circle(131, 171, 8, gold),
  ],
  [
    'Mountain campsite',
    'Travel',
    path('M12 172 L94 28 L165 172Z', '#91b3cd') +
      path('M91 172 L177 46 L245 172Z', '#b5cfdf') +
      path(
        'M67 75 L94 28 L121 75 L107 68 L95 79 L81 66 M151 83 L177 46 L197 83 L180 76 L169 88Z',
        '#ffffff',
      ) +
      path('M43 237 L125 122 L216 237Z', gold) +
      path('M125 122 V237 H179Z', '#dc954b') +
      path('M125 181 L91 237 H125Z', ink),
  ],
  [
    'Lighthouse',
    'Travel',
    path('M99 74 H157 L180 236 H76Z', '#e8eff6') +
      path('M91 131 H165 L171 170 H85Z', pink) +
      path('M104 33 H152 V75 H104Z', '#fff1ba') +
      path('M88 34 L128 8 L168 34Z', blue) +
      path('M91 79 H165 M79 236 H177', 'none', ink, 8) +
      rect(115, 193, 26, 43, blue, 7) +
      path('M77 49 L16 28 V70Z M179 49 L240 28 V70Z', '#ffdf83'),
  ],
  [
    'Travel suitcase',
    'Travel',
    path('M96 54 V28 H160 V54', 'none', '#805f65', 10) +
      rect(38, 51, 180, 180, pink, 20) +
      path('M82 55 V228 M174 55 V228', 'none', '#be487b', 12) +
      rect(88, 96, 81, 57, '#fff1bd', 5) +
      circle(75, 235, 9, ink) +
      circle(181, 235, 9, ink) +
      `<g transform="translate(54 67) scale(.3)">${star(5, 40, 90, blue)}</g>`,
  ],
  [
    'Paper airplane',
    'Travel',
    path('M12 106 L244 18 L164 238 L118 153 L75 181 L80 133Z', '#84b6f6') +
      path('M12 106 L244 18 L80 133Z', '#cfe5ff') +
      path('M118 153 L244 18 L94 141 L75 181Z', '#487abd') +
      path('M118 153 L164 238 L244 18Z', '#a6ceff'),
  ],
  [
    'Train engine',
    'Travel',
    rect(95, 82, 130, 105, blue, 10) +
      rect(30, 130, 103, 57, '#69a2ee', 7) +
      rect(24, 106, 36, 27, ink, 6) +
      rect(143, 101, 58, 44, '#daf1ff', 4) +
      rect(83, 69, 153, 21, pink, 7) +
      path('M17 213 L33 181 H224 V214Z', pink) +
      circle(72, 209, 27, ink) +
      circle(72, 209, 13, '#afc7e2') +
      circle(182, 209, 27, ink) +
      circle(182, 209, 13, '#afc7e2') +
      circle(40, 69, 17, '#b3c9df') +
      circle(65, 38, 22, '#d6e4f2'),
  ],
  [
    'Airplane',
    'Travel',
    path(
      'M116 30 Q128 5 140 30 L147 97 L238 146 V171 L145 144 V197 L175 219 V236 L128 222 L81 236 V219 L111 197 V144 L18 171 V146 L109 97Z',
      '#bdd8f6',
    ) +
      path('M128 22 V214', 'none', '#6d9ed9', 6) +
      path('M117 57 H139 L141 79 H115Z', blue),
  ],
  [
    'Jellyfish',
    'Ocean',
    path(
      'M50 130 C18 -21 238 -21 206 130 Q185 151 166 130 Q147 151 128 130 Q109 151 90 130 Q69 151 50 130Z',
      pink,
    ) +
      path(
        'M74 149 C32 180 109 198 66 235 M111 148 C68 179 149 204 104 243 M148 148 C105 179 186 204 141 243 M185 149 C143 180 220 198 177 235',
        'none',
        '#d171b2',
        10,
      ) +
      circle(101, 97, 6, ink) +
      circle(155, 97, 6, ink) +
      path('M117 114 Q128 125 139 114', 'none', ink, 4),
  ],
  [
    'Starfish',
    'Ocean',
    path(
      'M128 18 Q142 18 150 85 L225 85 Q247 95 178 139 L201 215 Q197 242 128 189 L55 227 Q29 228 78 139 L17 96 Q3 77 106 85Z',
      '#f0a269',
    ) +
      circle(112, 124, 5, ink) +
      circle(146, 124, 5, ink) +
      path('M116 143 Q128 154 140 143', 'none', ink, 4) +
      [0, 72, 144, 216, 288].map((a) => rotate(circle(128, 63, 5, '#ffd4a3'), a)).join(''),
  ],
  [
    'Sea turtle',
    'Ocean',
    `<ellipse cx="128" cy="138" rx="62" ry="80" fill="#6bb987"/>` +
      circle(128, 37, 29, '#a2d6a4') +
      path(
        'M76 93 Q10 62 36 141 L76 143 M180 93 Q246 62 220 141 L180 143 M86 190 Q52 256 97 228 L112 202 M170 190 Q204 256 159 228 L144 202Z',
        '#a2d6a4',
      ) +
      polygon('128,89 163,111 163,157 128,180 93,157 93,111', '#418965') +
      path(
        'M128 89 V64 M163 111 L184 99 M163 157 L186 172 M128 180 V214 M93 157 L70 172 M93 111 L72 99',
        'none',
        '#418965',
        5,
      ) +
      circle(117, 30, 4, ink) +
      circle(139, 30, 4, ink),
  ],
  [
    'Happy whale',
    'Ocean',
    path(
      'M20 146 C18 41 175 51 173 144 Q198 151 225 111 L241 81 L233 149 Q216 225 122 225 Q21 225 20 146Z',
      '#77b9e6',
    ) +
      path('M43 169 Q111 241 192 191 Q143 240 80 213Z', '#c9e7f6') +
      circle(63, 142, 7, ink) +
      path('M51 166 Q69 180 87 163', 'none', ink, 4) +
      path('M102 57 V27 Q85 8 74 28 M102 27 Q118 8 131 27', 'none', '#77b9e6', 8),
  ],
  [
    'Crab',
    'Ocean',
    `<ellipse cx="128" cy="155" rx="71" ry="55" fill="#ee8672"/>` +
      path(
        'M69 141 L36 97 M187 141 L220 97 M66 166 L27 180 M70 185 L39 216 M190 166 L229 180 M186 185 L217 216',
        'none',
        '#d4695d',
        10,
      ) +
      path(
        'M49 107 C-10 106 2 41 27 27 V70 L58 48 Q88 86 49 107 M207 107 C266 106 254 41 229 27 V70 L198 48 Q168 86 207 107Z',
        '#ee8672',
      ) +
      path('M104 112 V89 M152 112 V89', 'none', '#ee8672', 12) +
      circle(104, 86, 9, ink) +
      circle(152, 86, 9, ink),
  ],
  [
    'Seashell',
    'Ocean',
    path(
      'M128 228 C-32 135 28 -16 77 56 C103 -8 151 -8 179 56 C228 -16 288 135 128 228Z',
      '#eab1c9',
    ) +
      path(
        'M128 225 L75 56 M128 225 V27 M128 225 L180 56 M128 225 L28 105 M128 225 L228 105',
        'none',
        '#c981a7',
        6,
      ) +
      path('M106 220 H150 V239 H106Z', '#d792b4'),
  ],
  [
    'Coral branch',
    'Ocean',
    path(
      'M128 235 V54 M128 149 Q72 160 64 104 V60 M128 108 Q188 111 190 65 V29 M128 192 Q198 198 207 149 M66 105 L34 82 M188 66 L218 52 M128 70 L100 39',
      'none',
      '#ee8b8e',
      18,
    ),
  ],
  [
    'Ocean wave',
    'Ocean',
    path(
      'M18 211 C110 216 58 65 154 32 C207 10 257 71 209 108 C198 62 157 78 161 121 Q166 194 239 211Z',
      '#3a97d4',
    ) +
      path('M123 60 Q188 -11 224 71 Q205 49 186 69 Q162 60 145 92Z', '#bce8f8') +
      path('M27 224 H235', 'none', '#9ed5f3', 8),
  ],
  [
    'Basketball',
    'Sports',
    circle(128, 128, 106, '#e8974e') +
      circle(128, 128, 97, '#f0a75c') +
      path(
        'M23 128 H233 M128 23 V233 M54 54 Q128 128 54 202 M202 54 Q128 128 202 202',
        'none',
        '#845237',
        7,
      ),
  ],
  [
    'Soccer ball',
    'Sports',
    circle(128, 128, 106, '#f1f5fa') +
      circle(128, 128, 104, '#f1f5fa') +
      polygon('128,85 169,116 153,164 103,164 87,116', ink) +
      path(
        'M87 116 L43 100 L29 67 M169 116 L213 100 L227 67 M153 164 L179 202 L171 225 M103 164 L77 202 L85 225 M128 85 V41 L101 25',
        'none',
        '#7d96b4',
        4,
      ) +
      path(
        'M101 25 L128 41 L155 25 M29 67 L43 100 L24 127 M227 67 L213 100 L232 127 M85 225 L77 202 L49 202 M171 225 L179 202 L207 202Z',
        ink,
      ),
  ],
  [
    'Tennis racket',
    'Sports',
    rotate(
      `<ellipse cx="128" cy="89" rx="60" ry="77" fill="#c5e7db" stroke="#2f8b73" stroke-width="10"/>` +
        path(
          'M92 34 V143 M116 18 V163 M140 18 V163 M164 34 V143 M73 51 H183 M68 78 H188 M68 105 H188 M77 132 H179',
          'none',
          '#ffffff',
          3,
        ) +
        path('M104 160 L128 191 L152 160', 'none', '#2f8b73', 7) +
        rect(117, 188, 22, 61, blue, 7),
      28,
    ),
  ],
  [
    'Winner trophy',
    'Sports',
    path('M69 41 H187 V112 Q186 165 128 181 Q70 165 69 112Z', gold) +
      path(
        'M69 61 H35 V95 Q34 138 83 138 M187 61 H221 V95 Q222 138 173 138',
        'none',
        '#dda53e',
        14,
      ) +
      rect(117, 176, 22, 36, '#dda53e', 2) +
      rect(74, 209, 108, 28, ink, 6) +
      `<g transform="translate(77 55) scale(.4)">${star(5, 40, 90, '#fff4c6')}</g>`,
  ],
  [
    'Gold medal',
    'Sports',
    path('M58 17 H104 L151 140 H106Z', blue) +
      path('M152 17 H198 L150 140 H105Z', pink) +
      circle(128, 174, 66, '#dfa43e') +
      circle(128, 174, 55, gold) +
      `<g transform="translate(64 110) scale(.5)">${star(5, 40, 88, '#fff1b8')}</g>`,
  ],
  [
    'Skateboard',
    'Sports',
    rotate(
      rect(17, 100, 222, 61, '#a589db', 29) +
        rect(58, 88, 25, 84, ink, 9) +
        rect(173, 88, 25, 84, ink, 9) +
        rect(29, 107, 198, 47, '#bda7ea', 23) +
        path('M67 130 H187', 'none', '#8563bd', 5) +
        circle(102, 130, 9, gold),
      -30,
    ),
  ],
  [
    'Baseball cap',
    'Sports',
    path('M39 161 Q31 49 128 43 Q218 43 218 163Z', blue) +
      path('M128 43 Q177 61 169 163 H218 Q218 49 128 43Z', '#194fa6') +
      path('M40 160 H216 Q246 197 191 204 Q121 211 40 160Z', '#76a7ea') +
      circle(128, 43, 8, ink) +
      path('M83 86 L106 110 L83 134', 'none', '#ffffff', 8),
  ],
  [
    'Running shoe',
    'Sports',
    path('M31 101 L83 83 L119 139 L198 160 Q239 166 239 205 H24Z', pink) +
      path('M24 197 H239 V226 H24Z', '#dce8f5') +
      path('M89 112 L112 97 M104 135 L131 117 M127 152 L151 135', 'none', '#ffffff', 7) +
      path('M34 127 L61 118 L79 153 L34 167Z', '#b63d78') +
      path('M29 213 H233', 'none', '#a5bdd6', 4),
  ],
];
for (const [name, category, markup] of extraObjects)
  add(category, name, markup, 'illustration object colorful');
export const studioElements: readonly StudioElement[] = Object.freeze(items);
export const elementCategories = [...new Set(items.map((i) => i.category))];
