import type { GuideSymbolKind } from '../components/GuideSymbol.astro';
export interface ScreenStep {
  number: number;
  title: string;
  text: string;
  box: [number, number, number, number];
  pin: [number, number];
  point: [number, number];
}
export interface GuideScreen {
  id: string;
  title: string;
  src: string;
  width: number;
  height: number;
  crop?: [number, number, number, number];
  alt: string;
  caption: string;
  steps: ScreenStep[];
}
export interface GuideLesson {
  id: string;
  label: string;
  icon: GuideSymbolKind;
  title: string;
  intro: string;
  action: { href: string; label: string };
  screens: GuideScreen[];
  note: string;
}
/** Screens are existing site captures. Bitmap files are preserved; annotations are separate SVG/HTML. */
export const guideLessons: GuideLesson[] = [
  {
    id: 'download',
    label: 'Download',
    icon: 'download',
    title: 'Download an image or PDF',
    intro:
      'Choose Image or PDF to open a full-screen download window over the current page. Check the file details, then save your original file.',
    action: { href: '/new/', label: 'Browse artwork' },
    screens: [
      {
        id: 'artwork-buttons',
        title: 'On the artwork page',
        src: '/guide-screens/artwork-downloads.png',
        width: 559,
        height: 243,
        alt: 'Real artwork-page controls: Edit Clipart, Download Image and Download PDF.',
        caption:
          'These artwork controls open a download window over the same page. The page address stays the same.',
        steps: [
          {
            number: 1,
            title: 'Choose Image for a digital picture',
            text: 'Use Download Image to place the illustration in a document, presentation or design app. The file is WebP; check that your destination app supports it.',
            box: [2, 62, 555, 85],
            pin: [526, 26],
            point: [533, 94],
          },
          {
            number: 2,
            title: 'Choose PDF for the printable document',
            text: 'Use Download PDF when you need the separate PDF. The artwork page shows its page dimensions. This opens the download window; it does not save the file yet.',
            box: [2, 158, 555, 83],
            pin: [526, 140],
            point: [534, 191],
          },
        ],
      },
    ],
    note: 'In the download window, check the selected Image or PDF and press Download Image or Download PDF. The original file is checked before saving. Find it in your browser’s downloads list or your Downloads folder. Close the window to return to the same spot; your page address does not change.',
  },
  {
    id: 'edit',
    label: 'Edit a design',
    icon: 'edit',
    title: 'Add text and arrange your artwork',
    intro:
      'The studio keeps text, shapes and image layers separate. These examples show where to select a layer, change wording and save your work.',
    action: { href: '/create/', label: 'Open the studio' },
    screens: [
      {
        id: 'studio-controls',
        title: 'Find the text and layer controls',
        src: '/home-art/studio-real-workspace.webp',
        width: 1100,
        height: 914,
        alt: 'Actual studio example with a realistic lemon illustration, a selected Summer notes caption, the Text tool and the Layers panel.',
        caption:
          'A studio example. The numbered controls explain what to use, rather than changing the pictured design.',
        steps: [
          {
            number: 1,
            title: 'Open Text to add your wording',
            text: 'Use Text in the toolbar, enter a caption and choose Add / update caption. Keep enough space around your words and check the wording before exporting.',
            box: [1015, 9, 74, 84],
            pin: [1019, 138],
            point: [1051, 92],
          },
          {
            number: 2,
            title: 'Select an object in Layers',
            text: 'Open Layers and select the item you want to work with. Named rows help when a small object is hard to select on the canvas. An imported illustration may be one image layer, not many separate vector objects.',
            box: [736, 178, 338, 40],
            pin: [697, 203],
            point: [736, 200],
          },
          {
            number: 3,
            title: 'Move or resize the selection',
            text: 'The selection frame shows the current object. Use the editor’s transform and alignment controls to change its position or size. Preserve proportions when resizing an illustration.',
            box: [117, 180, 477, 56],
            pin: [643, 270],
            point: [594, 229],
          },
        ],
      },
      {
        id: 'save-export',
        title: 'Keep an editable copy and a finished file',
        src: '/guide-screens/editor-toolbar.png',
        width: 1440,
        height: 1000,
        crop: [1004, 94, 395, 101],
        alt: 'Actual editor toolbar with Save project, Share and Export buttons.',
        caption:
          'The toolbar has different actions for saving an editable project and exporting a finished file.',
        steps: [
          {
            number: 4,
            title: 'Save project for later changes',
            text: 'Save project downloads the editable project. Keep that copy if you want to change the wording or layout next time. Reopen it with Open saved project.',
            box: [1026, 126, 145, 49],
            pin: [1096, 105],
            point: [1096, 143],
          },
          {
            number: 5,
            title: 'Export the finished version',
            text: 'Export opens the file choices for your edited artwork. Choose an image or PDF there. A finished image does not restore the separate editable objects in your project.',
            box: [1287, 126, 102, 49],
            pin: [1340, 105],
            point: [1340, 143],
          },
        ],
      },
    ],
    note: 'Save an existing project before choosing another starter. Browser recovery is local to that browser; a downloaded project file is your separate editable copy.',
  },
  {
    id: 'print',
    label: 'Print',
    icon: 'print',
    title: 'Set up the page before printing',
    intro:
      'Use Print setup for a studio PDF. If you are placing a downloaded image in another app, use the print size calculator with that image’s actual pixel dimensions.',
    action: { href: '/print-size/', label: 'Open print size calculator' },
    screens: [
      {
        id: 'paper-settings',
        title: 'The studio’s Print setup controls',
        src: '/guide-screens/print-setup.png',
        width: 1440,
        height: 1499,
        crop: [1060, 725, 336, 371],
        alt: 'Captured Print setup panel with Paper size, Orientation, Safe margins and Placement controls.',
        caption:
          'A captured Print setup example. Open Print / B&W in the editor to find these controls.',
        steps: [
          {
            number: 1,
            title: 'Choose paper and orientation',
            text: 'Set the paper size first, then Portrait or Landscape. The size of the PDF page follows this selection; do not assume every catalog PDF uses the same paper size.',
            box: [1117, 797, 250, 127],
            pin: [1083, 812],
            point: [1117, 819],
          },
          {
            number: 2,
            title: 'Leave the margins your printer needs',
            text: 'Safe margins reduce the area available for the illustration. Check your printer’s requirements. Zero margin in a layout does not make a printer support borderless output.',
            box: [1117, 962, 250, 44],
            pin: [1083, 977],
            point: [1117, 981],
          },
          {
            number: 3,
            title: 'Use Fit entire artwork to keep it all',
            text: 'Fit keeps the whole composition within the available area. Check the paper preview for clipping. Placement that fills the page may crop part of the artwork.',
            box: [1117, 1046, 250, 44],
            pin: [1083, 1062],
            point: [1117, 1067],
          },
        ],
      },
      {
        id: 'print-export',
        title: 'Choose PDF in the export dialog',
        src: '/guide-screens/export-dialog.png',
        width: 1440,
        height: 1372,
        crop: [360, 280, 720, 530],
        alt: 'Real export dialog with the WebP and PDF format choices, filename field and final download button.',
        caption:
          'The dialog is shown before switching from WebP to PDF. The download label changes with the selected format.',
        steps: [
          {
            number: 4,
            title: 'Select PDF for a print document',
            text: 'Choose PDF in File format. Check the page preview and the filename. Image export settings and PDF export settings are different.',
            box: [899, 325, 156, 101],
            pin: [1044, 300],
            point: [980, 326],
          },
          {
            number: 5,
            title: 'Download, open and check the PDF',
            text: 'After PDF is selected, use Download PDF in the position shown here. Open the saved document. To preserve its planned physical size, choose Actual size or 100% in the print dialog and check one copy first.',
            box: [384, 741, 671, 49],
            pin: [1044, 706],
            point: [1020, 742],
          },
        ],
      },
    ],
    note: 'PPI describes image pixels per printed inch; it is different from printer DPI. Transparent borders count toward the full image size. The print size calculator checks those dimensions without changing your file.',
  },
  {
    id: 'boards',
    label: 'Favorites',
    icon: 'boards',
    title: 'Group saved images into named boards',
    intro:
      'Save an illustration with its heart button, then use Favorites to group images for a project. The screenshots show sample boards and saved artwork.',
    action: { href: '/favorites/', label: 'Open Favorites' },
    screens: [
      {
        id: 'pick-board',
        title: 'Choose the collection you want to see',
        src: '/guide-screens/favorite-boards.png',
        width: 1440,
        height: 1000,
        crop: [90, 0, 1010, 240],
        alt: 'Actual Favorites interface with sample All favorites, Not in a board, Classroom projects and another named board.',
        caption:
          'Sample boards in Favorites. Your names, saved images and counts will be different.',
        steps: [
          {
            number: 1,
            title: 'Open a board',
            text: 'Choose a board to see its saved illustrations. All favorites shows everything. To start a new collection, use Create board in Favorites and give it a name you will recognize.',
            box: [602, 1, 235, 197],
            pin: [708, 215],
            point: [708, 195],
          },
        ],
      },
      {
        id: 'manage-favorites',
        title: 'Find, select and organize saved images',
        src: '/guide-screens/favorite-boards.png',
        width: 1440,
        height: 1000,
        crop: [93, 351, 1248, 649],
        alt: 'Favorites controls for searching saved designs, selecting designs and organizing an individual saved illustration.',
        caption:
          'Search works within your saved collection. Organize opens options for that individual illustration.',
        steps: [
          {
            number: 2,
            title: 'Search your saved collection',
            text: 'Find a saved design using its title, subject or your note. Use Sort by and Saved to narrow the list further.',
            box: [120, 398, 760, 44],
            pin: [995, 483],
            point: [839, 440],
          },
          {
            number: 3,
            title: 'Select several designs for a board',
            text: 'Use Select designs, choose the illustrations, then pick a destination board and Add to board. You can group the same saved illustration into more than one board.',
            box: [1189, 398, 130, 44],
            pin: [1270, 482],
            point: [1253, 440],
          },
          {
            number: 4,
            title: 'Organize one illustration',
            text: 'Use Organize on a saved card to set its boards or add a note. Saved dates appear on cards when recorded. Use Export backup below the collection to keep your boards, notes and dates in a separate file.',
            box: [116, 945, 205, 43],
            pin: [351, 963],
            point: [320, 963],
          },
        ],
      },
    ],
    note: 'Favorites stay in the current browser and do not sync automatically. Export backup keeps a copy; Import backup brings that copy into another browser. Clearing site data can remove the local collection.',
  },
];
