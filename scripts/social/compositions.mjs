const A = {
  fox: 'baby-fennec-fox-watercolor-clipart',
  butterfly: 'blue-morpho-butterfly-flying-illustration-clipart',
  heart: 'floral-heart-roses-wreath-clipart',
  berry: 'strawberry-fruit-trio-realistic-clipart',
  book: 'book-and-feather-quill-playful-clipart',
  fern: 'leaf-arching-fern-frond-botanical-illustration-clipart',
  fernInk: 'leaf-fern-unfurling-frond-black-and-white-woodcut-clipart',
  violinInk: 'music-violin-with-bow-black-and-white-engraving-clipart',
  bookInk: 'book-and-feather-quill-black-and-white-clipart',
  elephant: 'baby-elephant-standing-realistic-clipart',
  school: 'school-backpack-filled-with-pencils-classic-clipart',
  reading: 'book-children-reading-together-classic-clipart',
  earth: 'earth-clipart-classroom-globe-wooden-stand',
  pumpkin: 'pumpkin-lantern-smile',
  cabin: 'winter-snowy-timber-cabin',
  guitar: 'music-acoustic-guitar-watercolor-clipart',
  volleyball: 'classic-white-volleyball-realistic-clipart',
  lemon: 'lemon-whole-and-cut-fruit-realistic-clipart',
};
const P = { ink: '#1d3e67', blue: '#2866ad', line: '#cfdfef', pale: '#eaf3ff', muted: '#5e799a' };
export async function compose(c, page, catalog) {
  const art = (name) => {
    const id = A[name] || name;
    const item = catalog.get(id);
    if (!item) throw new Error(`Missing published social-image artwork: ${id}`);
    return `public${item.webp}`;
  };
  const image = (name, x, y, w, h, options) => c.image(art(name), x, y, w, h, options);
  async function tile(name, x, y, w, h, label = '', fill = '#fff') {
    c.rect(x, y, w, h, fill, 16, P.line);
    await image(name, x + 12, y + 10, w - 24, h - (label ? 48 : 20));
    if (label)
      await c.text(label, x + w / 2, y + h - 31, {
        size: 17,
        weight: 600,
        center: true,
        maxWidth: w - 20,
      });
  }
  async function headingLabel(value, x, y, w) {
    await c.text(value, x + w / 2, y, { size: 21, weight: 600, center: true, maxWidth: w - 14 });
  }
  function paper(x, y, w, h) {
    c.rect(x, y, w, h, '#fff', 13, P.line);
  }
  function rules(x, y, w, count = 4, step = 25) {
    for (let i = 0; i < count; i++) c.line(x, y + i * step, x + w, y + i * step, '#d9e5f2', 3);
  }
  function arrow(x1, y, x2) {
    c.line(x1, y, x2, y, '#77a1cd', 3);
    c.svg(
      `<path d="m${x2 - 9} ${y - 7} 9 7-9 7" fill="none" stroke="#77a1cd" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  switch (page.layout) {
    case 'cookies': {
      await c.image('public/illustrations/actions/cookies.svg', 687, 134, 338, 338);
      paper(605, 473, 249, 55);
      paper(874, 473, 267, 55);
      await c.text('Necessary Cookies', 729, 492, { size: 21, weight: 600, center: true });
      await c.text('Your Privacy Settings', 1007, 492, { size: 21, weight: 600, center: true });
      break;
    }
    case 'home': {
      c.rect(590, 108, 558, 425, '#e7f1fe', 24);
      const samples = [
        ['heart', 610, 125, 172, 249, 'Hearts & Flowers', '#fff5f8'],
        ['pizza-pepperoni-slice-watercolor-clipart', 798, 125, 157, 117, 'Food & Drink', '#fff8ec'],
        [
          'school-backpack-filled-with-pencils-playful-clipart',
          970,
          125,
          157,
          117,
          'School',
          '#f7faff',
        ],
        ['guitar', 798, 260, 157, 249, 'Music', '#f4f0ff'],
        ['watercolor-blue-yellow-volleyball-clipart', 970, 260, 157, 117, 'Sports', '#f7fbff'],
        [
          'leaf-autumn-maple-oak-birch-cluster-painted-illustration-clipart',
          610,
          392,
          172,
          117,
          'Botanicals',
          '#fff9ef',
        ],
        ['winter-knitted-mittens-on-cord', 970, 395, 157, 114, 'Winter', '#f7faff'],
      ];
      for (const [name, x, y, w, h, label, fill] of samples) {
        c.rect(x, y + 5, w, h, '#bacde6', 16);
        await tile(name, x, y, w, h, label, fill);
      }
      break;
    }
    case 'studio': {
      paper(628, 111, 477, 420);
      await c.text('Freshly Picked', 866, 151, {
        size: 32,
        weight: 600,
        center: true,
        maxWidth: 390,
      });
      await image('berry', 702, 210, 328, 237);
      c.rect(694, 205, 344, 251, 'none', 3, '#3678be');
      for (const [x, y] of [
        [689, 200],
        [1033, 200],
        [689, 451],
        [1033, 451],
      ])
        c.rect(x, y, 10, 10, '#fff', 1, '#3678be');
      await c.text('Design example', 866, 483, { size: 18, center: true, color: P.muted });
      c.rect(580, 307, 94, 101, '#e1edfc', 15, '#adc8e9');
      await c.text('Aa', 627, 335, { size: 43, weight: 600, center: true });
      for (let i = 0; i < 4; i++)
        c.rect(963 + i * 36, 553, 26, 12, ['#2d639f', '#e6a65b', '#b44a58', '#83a787'][i], 4);
      break;
    }
    case 'ai': {
      paper(605, 127, 343, 387);
      await c.image('public/ai-examples/garden-robot-640.webp', 623, 143, 307, 310);
      await c.text('A gardening robot', 777, 478, {
        size: 19,
        weight: 600,
        center: true,
        maxWidth: 310,
      });
      paper(963, 127, 190, 184);
      await c.image('public/ai-examples/floral-teacup-640.webp', 978, 137, 160, 151);
      paper(963, 327, 190, 187);
      await c.image('public/ai-examples/baby-rabbit-640.webp', 977, 341, 162, 158);
      await c.text('Example Ideas', 878, 539, { size: 18, center: true, color: P.muted });
      break;
    }
    case 'categories': {
      const names = [
        ['fox', 'Animals'],
        ['fern', 'Plants'],
        ['berry', 'Food'],
        ['school', 'School'],
        ['guitar', 'Music'],
        ['earth', 'Nature'],
      ];
      for (let i = 0; i < names.length; i++)
        await tile(
          names[i][0],
          595 + (i % 3) * 190,
          132 + Math.floor(i / 3) * 205,
          176,
          190,
          names[i][1],
        );
      break;
    }
    case 'collections': {
      const rows = [
        ['pumpkin', 'Halloween', '#fff5e9'],
        ['cabin', 'Winter', '#edf5ff'],
        ['heart', 'Hearts', '#fff3f5'],
      ];
      for (let i = 0; i < rows.length; i++) {
        const x = 598 + i * 187,
          y = i === 1 ? 119 : 155;
        paper(x, y, 172, 349);
        c.rect(x + 7, y + 7, 158, 275, rows[i][2], 8);
        await image(rows[i][0], x + 13, y + 40, 146, 235);
        await headingLabel(rows[i][1], x, y + 304, 172);
      }
      break;
    }
    case 'monochrome': {
      paper(602, 119, 245, 403);
      await image('fernInk', 623, 135, 205, 340);
      await c.text('Botanical Ink', 724, 486, { size: 17, center: true, color: P.muted });
      paper(862, 119, 280, 218);
      await image('bookInk', 878, 134, 248, 184);
      paper(862, 351, 280, 171);
      await image('violinInk', 882, 363, 240, 147);
      break;
    }
    case 'teachers': {
      paper(604, 111, 277, 419);
      await c.text('Our World', 742, 139, { size: 29, weight: 600, center: true, maxWidth: 235 });
      await c.text('Name', 629, 190, { size: 17, color: P.muted });
      c.line(683, 208, 854, 208);
      await image('earth', 658, 222, 170, 161);
      rules(630, 409, 223, 4, 24);
      paper(899, 166, 249, 364);
      await c.lines(['Reading', 'Corner'], 1023, 191, {
        size: 29,
        weight: 600,
        center: true,
        maxWidth: 220,
        lineHeight: 37,
      });
      await image('reading', 917, 290, 213, 160);
      await c.text('Choose a Book', 1023, 484, {
        size: 18,
        center: true,
        maxWidth: 215,
        color: P.muted,
      });
      break;
    }
    case 'guides': {
      paper(587, 139, 571, 391);
      await c.image('public/guide-screens/editor-toolbar.png', 598, 151, 548, 350);
      for (const [i, label] of ['Download', 'Edit', 'Print'].entries()) {
        c.rect(612 + i * 174, 535, 160, 42, '#e4effd', 8);
        await c.text(`${i + 1}  ${label}`, 692 + i * 174, 547, {
          size: 18,
          weight: 600,
          center: true,
          maxWidth: 147,
        });
      }
      break;
    }
    case 'print': {
      paper(755, 109, 324, 422);
      await c.text('Print Layout', 917, 135, { size: 25, weight: 600, center: true });
      await image('lemon', 796, 217, 240, 208);
      c.line(803, 470, 1033, 470, P.blue, 2);
      for (let i = 0; i <= 10; i++)
        c.line(803 + i * 23, 470, 803 + i * 23, i % 5 === 0 ? 452 : 459, P.blue, 2);
      await c.text('Size on Paper', 917, 491, { size: 18, center: true, color: P.muted });
      c.rect(588, 189, 132, 181, '#e5effc', 12, '#b9d1ed');
      await image('lemon', 602, 222, 105, 105);
      await c.text('Pixels', 653, 335, { size: 19, weight: 600, center: true });
      arrow(711, 400, 772);
      c.line(1104, 147, 1104, 492, '#83a9d1', 2);
      for (let i = 0; i <= 12; i++)
        c.line(1104, 147 + i * 28.75, i % 3 === 0 ? 1122 : 1115, 147 + i * 28.75, '#83a9d1', 2);
      break;
    }
    case 'about': {
      c.svg(`<defs>
        <radialGradient id="about-light"><stop stop-color="#5484bc" stop-opacity=".5"/><stop offset="1" stop-color="#5484bc" stop-opacity="0"/></radialGradient>
        <radialGradient id="about-floor"><stop stop-color="#0c2649" stop-opacity=".45"/><stop offset="1" stop-color="#0c2649" stop-opacity="0"/></radialGradient>
      </defs><ellipse cx="875" cy="320" rx="310" ry="248" fill="url(#about-light)"/>
      <ellipse cx="880" cy="542" rx="273" ry="29" fill="url(#about-floor)"/>
      <g transform="rotate(-7 870 315)">
        <rect x="687" y="149" width="348" height="345" rx="24" fill="#83a7d0"/>
        <rect x="681" y="137" width="348" height="345" rx="24" fill="#c8def5" stroke="#e6f1ff" stroke-width="2"/>
      </g>`);
      c.rect(724, 168, 294, 327, '#91aed0', 21);
      c.rect(721, 160, 294, 327, '#dbe7f5', 21);
      c.rect(718, 153, 294, 327, '#fff', 21, '#d3e2f3');
      await c.image('public/logo.svg', 810, 195, 110, 121);
      await c.text('UltraClipart', 865, 341, {
        size: 30,
        weight: 700,
        center: true,
        maxWidth: 254,
      });
      await c.text('Library & Studio', 865, 386, {
        size: 19,
        center: true,
        color: P.muted,
        maxWidth: 254,
      });
      for (const [i, color] of ['#2f6eb7', '#67a9de', '#b6d5f5', '#f2cf94', '#d9899c'].entries())
        c.rect(791 + i * 31, 429, 23, 7, color, 3);
      // Small original-art cards surround the brand, rather than portraits.
      c.svg('<g transform="rotate(-9 671 345)">');
      c.rect(591, 250, 166, 207, '#b9cde5', 17);
      c.rect(588, 243, 166, 207, '#fff7fa', 17, '#e6dce6');
      await image('heart', 601, 262, 140, 163);
      c.svg('</g><g transform="rotate(8 1064 218)">');
      c.rect(994, 132, 148, 184, '#a8c3e2', 17);
      c.rect(991, 125, 148, 184, '#f5fbf7', 17, '#d6e5dc');
      await image('fern', 1003, 139, 124, 153);
      c.svg('</g><g transform="rotate(8 1075 423)">');
      c.rect(1009, 345, 144, 166, '#c8bfae', 17);
      c.rect(1006, 338, 144, 166, '#fff9eb', 17, '#eadcc2');
      await image('lemon', 1017, 353, 122, 132);
      c.svg('</g>');
      await c.image('public/illustrations/builder/palette.svg', 785, 451, 171, 144, { angle: -10 });
      await c.image('public/illustrations/builder/pencil.svg', 932, 465, 113, 113, { angle: 14 });
      break;
    }
    case 'new': {
      const subjects = new Set();
      const newest = [...catalog.values()].sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
      );
      const selected = newest
        .filter((item) => {
          if (subjects.has(item.topic)) return false;
          subjects.add(item.topic);
          return true;
        })
        .slice(0, 6);
      for (let i = 0; i < selected.length; i++) {
        const x = 595 + (i % 3) * 190,
          y = 127 + Math.floor(i / 3) * 210;
        paper(x, y, 176, 193);
        await c.image(`public${selected[i].webp}`, x + 9, y + 9, 158, 175);
      }
      break;
    }
    case 'boards': {
      paper(603, 125, 269, 395);
      await headingLabel('Classroom', 603, 146, 269);
      await image('school', 628, 200, 110, 122);
      await image('earth', 742, 200, 109, 122);
      await image('book', 628, 340, 110, 123);
      await image('reading', 742, 340, 109, 123);
      paper(890, 173, 255, 347);
      await headingLabel('Cards', 890, 195, 255);
      await image('heart', 915, 246, 204, 198);
      await c.text('Example Boards', 876, 543, { size: 18, center: true, color: P.muted });
      break;
    }
    case 'search': {
      paper(594, 130, 555, 73);
      c.svg(
        '<circle cx="627" cy="165" r="11" fill="none" stroke="#4d7fb8" stroke-width="3"/><path d="m636 174 11 11" stroke="#4d7fb8" stroke-width="3" stroke-linecap="round"/>',
      );
      await c.text('Find a Subject', 671, 153, { size: 27, weight: 400, color: '#62809f' });
      const rows = [
        ['fox', 594, 227],
        ['berry', 878, 227],
        ['book', 594, 388],
        ['guitar', 878, 388],
      ];
      for (const [name, x, y] of rows) await tile(name, x, y, 270, 146);
      break;
    }
    case 'contact': {
      await c.image('public/illustrations/actions/contact.svg', 670, 153, 409, 316);
      await c.text('ultraclipart@gmail.com', 869, 500, {
        size: 24,
        weight: 600,
        center: true,
        maxWidth: 510,
      });
      c.rect(605, 125, 184, 51, '#fff', 10, P.line);
      await c.text('Questions', 697, 140, { size: 22, weight: 600, center: true });
      c.rect(966, 153, 184, 51, '#fff', 10, P.line);
      await c.text('Feedback', 1058, 168, { size: 22, weight: 600, center: true });
      break;
    }
    case 'faq': {
      await c.text('?', 640, 131, { size: 277, weight: 700, color: '#98bce6' });
      const rows = [
        ['Image Downloads', 'public/illustrations/actions/image.svg'],
        ['Printable PDFs', 'public/illustrations/actions/document.svg'],
        ['Editing Your Design', 'public/illustrations/actions/edit.svg'],
      ];
      for (let i = 0; i < rows.length; i++) {
        paper(830, 159 + i * 122, 321, 100);
        await c.image(rows[i][1], 847, 176 + i * 122, 65, 65);
        await c.text(rows[i][0], 929, 193 + i * 122, { size: 21, weight: 600, maxWidth: 208 });
      }
      break;
    }
    case 'label': {
      paper(590, 133, 563, 387);
      const cropLabel = function learningLabel(svg) {
        return svg.replace(
          'viewBox="0 0 800 600" width="800" height="600"',
          'viewBox="110 110 580 380" width="580" height="380"',
        );
      };
      await c.image('public/studio/school-label.svg', 607, 155, 529, 326, {
        transformSource: cropLabel,
      });
      await c.text('Reading', 714, 270, { size: 28, weight: 600, maxWidth: 220 });
      await c.text('Corner', 714, 321, { size: 28, weight: 600, maxWidth: 220 });
      await image('book', 1012, 417, 133, 115);
      await c.text('Example Using the Learning Label', 870, 542, {
        size: 18,
        center: true,
        color: P.muted,
        maxWidth: 545,
      });
      break;
    }
    case 'coloring': {
      const outline = function coloringOutline(svg) {
        return svg
          .replace(/fill="#[a-fA-F0-9]+"/g, 'fill="#ffffff"')
          .replace(/stroke="#[a-fA-F0-9]+"/g, 'stroke="#203b5d"');
      };
      for (let i = 0; i < 2; i++) {
        paper(605 + i * 279, 132, 251, 389);
        await c.image(
          'public/studio/botanical-sprig.svg',
          619 + i * 279,
          171,
          223,
          281,
          i ? { transformSource: outline } : {},
        );
        await c.text(i ? 'Outline' : 'Color', 730 + i * 279, 477, {
          size: 24,
          weight: 600,
          center: true,
        });
      }
      arrow(856, 326, 879);
      break;
    }
    case 'formats': {
      const rows = [
        ['WebP', 'Image', 'image'],
        ['PDF', 'Print', 'document'],
        ['Project', 'Layers', 'edit'],
      ];
      for (let i = 0; i < rows.length; i++) {
        const x = 596 + i * 188;
        paper(x, 155, 173, 348);
        await c.image(`public/illustrations/actions/${rows[i][2]}.svg`, x + 34, 191, 105, 112);
        await c.text(rows[i][0], x + 86, 343, {
          size: 28,
          weight: 600,
          center: true,
          maxWidth: 153,
        });
        await c.text(rows[i][1], x + 86, 399, { size: 21, center: true, color: P.muted });
      }
      break;
    }
    case 'license': {
      paper(626, 125, 347, 398);
      await c.image('public/logo.svg', 763, 151, 68, 75);
      await c.lines(['Personal &', 'Educational Use'], 799, 263, {
        size: 30,
        weight: 600,
        center: true,
        lineHeight: 45,
        maxWidth: 305,
      });
      rules(667, 396, 263, 3);
      await image('heart', 972, 171, 171, 171);
      await image('book', 947, 362, 206, 166);
      break;
    }
    case 'privacy': {
      c.rect(693, 177, 361, 267, '#e3eefc', 22, '#b2cce9');
      c.svg(
        '<path d="M817 277v-42a55 55 0 0 1 110 0v42" fill="none" stroke="#2b639e" stroke-width="14"/><rect x="795" y="270" width="153" height="124" rx="17" fill="#fff" stroke="#2b639e" stroke-width="4"/><circle cx="871" cy="326" r="10" fill="#2b639e"/><path d="M871 334v24" stroke="#2b639e" stroke-width="7" stroke-linecap="round"/>',
      );
      for (const [i, label] of ['Browser', 'AI Service', 'Saved Files'].entries()) {
        paper(600 + i * 185, 475, 170, 52);
        await c.text(label, 685 + i * 185, 492, {
          size: 19,
          weight: 600,
          center: true,
          maxWidth: 152,
        });
      }
      break;
    }
    case 'terms': {
      paper(643, 115, 435, 420);
      await c.image('public/logo.svg', 679, 149, 42, 47);
      await c.text('Terms of Use', 745, 158, { size: 31, weight: 600, maxWidth: 300 });
      c.line(680, 222, 1040, 222, '#a8c3e3', 2);
      await c.text('Using UltraClipart', 681, 254, { size: 22, weight: 600 });
      rules(681, 310, 355, 4, 26);
      await c.text('Artwork & Creative Tools', 681, 439, {
        size: 21,
        color: P.muted,
        maxWidth: 355,
      });
      break;
    }
    case 'copyright': {
      paper(625, 133, 351, 389);
      await c.text('©', 798, 171, { size: 165, weight: 600, center: true, color: '#5083bb' });
      await c.text('Copyright & Corrections', 800, 392, {
        size: 24,
        weight: 600,
        center: true,
        maxWidth: 310,
      });
      rules(668, 452, 267, 2, 25);
      await c.image('public/illustrations/actions/document.svg', 985, 180, 148, 158);
      await c.image('public/illustrations/actions/contact.svg', 975, 355, 180, 154);
      break;
    }
    case 'accessibility': {
      paper(608, 132, 538, 389);
      c.rect(661, 181, 184, 97, '#e9f2fe', 12, '#c4d6ee');
      await c.text('Tab', 753, 209, { size: 36, weight: 600, center: true });
      c.rect(882, 181, 209, 97, '#fff', 12, '#c4d6ee');
      await c.text('Enter', 986, 209, { size: 36, weight: 600, center: true });
      c.rect(649, 335, 454, 105, 'none', 14, '#2b6fc3');
      c.rect(658, 344, 436, 87, '#2867ac', 8);
      await c.text('Visible Keyboard Focus', 876, 371, {
        size: 27,
        weight: 600,
        center: true,
        color: '#fff',
        maxWidth: 397,
      });
      break;
    }
    case 'process': {
      for (let i = 0; i < 3; i++) {
        const x = 598 + i * 188;
        paper(x, 166, 172, 329);
        if (i === 0) await image('fox', x + 15, 210, 142, 160);
        else
          await c.image(
            `public/illustrations/actions/${i === 1 ? 'edit' : 'document'}.svg`,
            x + 27,
            223,
            118,
            137,
          );
        await c.text(['1  Brief', '2  Review', '3  Publish'][i], x + 86, 417, {
          size: 23,
          weight: 600,
          center: true,
          maxWidth: 150,
        });
      }
      break;
    }
    case 'error': {
      await c.text('404', 861, 174, {
        size: 188,
        weight: 700,
        center: true,
        color: '#bed5ee',
        maxWidth: 545,
      });
      await image('fox', 728, 264, 260, 260);
      await image('butterfly', 1017, 135, 123, 119);
      c.svg(
        '<circle cx="656" cy="412" r="38" fill="white" stroke="#3b76b9" stroke-width="8"/><path d="m683 440 29 29" stroke="#3b76b9" stroke-width="12" stroke-linecap="round"/>',
      );
      break;
    }
    default:
      throw new Error(`Unknown social image composition: ${page.layout}`);
  }
}
