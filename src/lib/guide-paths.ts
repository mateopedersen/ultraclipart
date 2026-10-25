/** Instructions follow the labels in the download window, studio and favorites tools. */
export const guidePaths = [
  {
    id: 'download',
    label: 'Download an image',
    short: 'Image or printable PDF',
    icon: 'discover',
    title: 'Download the file you need',
    intro:
      'Start on an artwork page so you can check the image, its dimensions and the available files.',
    action: { href: '/new/', label: 'Browse clipart' },
    steps: [
      {
        title: 'Open an illustration',
        text: 'Browse a collection and open the artwork you want. Check the full preview and Original resolution. The background buttons only change the preview; they do not edit the download.',
        link: { href: '/categories/', label: 'Browse by subject' },
      },
      {
        title: 'Choose Image or PDF',
        text: 'Choose Download Image for a picture to place in a document or design app. Choose Download PDF for the printable document. The image is a WebP file; a PDF is a separate download.',
      },
      {
        title: 'Save from the download window',
        text: 'A full-screen download window opens over the same page and shows the available files, their sizes and details. Check your selection, then use Download Image or Download PDF to save the original file. Your page address stays the same.',
      },
      {
        title: 'Open the saved file',
        text: 'Find it in your browser’s downloads or your device’s Downloads folder. Open that exact file to check the image or PDF. If an app cannot open WebP, renaming it to .png will not convert it.',
      },
    ],
    noteTitle: 'Need a transparent background?',
    note: 'Look for the Transparent background label on the artwork page. A checkerboard represents empty space. To change the actual background, open the image in the editor and export a new version.',
    related: {
      href: '/guides/webp-pdf-and-editable-projects/',
      label: 'Read the file format guide',
    },
  },
  {
    id: 'edit',
    label: 'Edit a design',
    short: 'Text, artwork and layout',
    icon: 'layers',
    title: 'Make a version of your own',
    intro:
      'Use the studio for a new composition, or open an illustration’s editor to work with that image.',
    action: { href: '/create/', label: 'Open the studio' },
    steps: [
      {
        title: 'Choose a starting point',
        text: 'Open the studio and choose a starter, or begin with a blank canvas. Save any existing project before replacing it. The classroom label guide walks through a real starter from beginning to end.',
        link: { href: '/guides/make-a-classroom-label/', label: 'Follow the label project' },
      },
      {
        title: 'Arrange the artwork',
        text: 'Use Layers to select objects, then move, resize or recolor them. Vector starters have separate shapes. Many catalog illustrations open as one image layer; their individual painted details are not separate vector objects.',
      },
      {
        title: 'Add your wording',
        text: 'Open Text and enter a caption. Use a dark color on a light background, keep the wording short and leave space around it. Check the layout at the size you plan to use.',
      },
      {
        title: 'Save a project and an export',
        text: 'Save project keeps an editable copy for later. Export creates a finished image or PDF. Keep both if you expect to make changes; the finished image will not restore separate layers.',
      },
    ],
    noteTitle: 'Keep an editable copy',
    note: 'Download a project file with Save project. You can reopen it with Open saved project. Browser recovery is local to that browser and is not a cloud backup.',
    related: {
      href: '/guides/webp-pdf-and-editable-projects/',
      label: 'Compare project files and exports',
    },
  },
  {
    id: 'print',
    label: 'Prepare a print',
    short: 'Paper size and resolution',
    icon: 'print',
    title: 'Check the size before printing',
    intro:
      'Use the original file rather than a screenshot. For an image, check its pixel dimensions; for a PDF, check the page size.',
    action: { href: '/print-size/', label: 'Calculate print size' },
    steps: [
      {
        title: 'Find the image dimensions',
        text: 'Read Original resolution on the artwork page. In Know your files, open Print details and choose Check your print size to carry that artwork’s dimensions into the calculator.',
      },
      {
        title: 'Set the size on paper',
        text: 'In the calculator, enter a width or height and choose inches, centimeters or millimeters. The other side adjusts automatically. Select your paper, orientation and margin per side.',
        link: { href: '/print-size/', label: 'Open the calculator' },
      },
      {
        title: 'Check fit and pixel density',
        text: 'The preview shows whether the image fits within the selected margins. Use largest size that fits keeps its proportions. Compare 150, 300 and 600 PPI sizes; the calculator does not add detail to the file.',
      },
      {
        title: 'Print one copy first',
        text: 'When matching the calculated size, choose Actual size or 100% in the print dialog. Fit to page changes the scale. Check the smallest details and measure the result before printing more.',
      },
    ],
    noteTitle: 'Printing straight from the studio?',
    note: 'Open Print setup before exporting a PDF. Choose paper, orientation and margins, then check the page preview. Use Fit entire artwork to keep the whole composition within the available area.',
    related: {
      href: '/guides/turn-clipart-into-a-coloring-activity/',
      label: 'Try a printable coloring project',
    },
  },
  {
    id: 'boards',
    label: 'Organize favorites',
    short: 'Boards for your projects',
    icon: 'book',
    title: 'Keep a board for each project',
    intro:
      'Save illustrations as you browse, then group them into named boards in Favorites. No account is needed.',
    action: { href: '/favorites/', label: 'Open Favorites' },
    steps: [
      {
        title: 'Save an illustration',
        text: 'Use the heart button on a card or Add to Favorites on an artwork page. Your saved illustrations appear together in All favorites.',
      },
      {
        title: 'Create a named board',
        text: 'In Favorites, choose Create board. Give it a name you will recognize, such as “Mia’s birthday” or “Classroom labels”. Add a description if it helps explain the project.',
        link: { href: '/favorites/', label: 'Create a board in Favorites' },
      },
      {
        title: 'Group your saved images',
        text: 'Select saved illustrations, choose a destination board and use Add to board. Use the search and sorting controls to find a saved image, and add a note when you need to remember how you plan to use it.',
      },
      {
        title: 'Export a backup',
        text: 'Use Export backup to keep a copy of your boards, notes and saved dates. Use Import backup in another browser to bring that collection with you.',
      },
    ],
    noteTitle: 'Boards stay in this browser',
    note: 'Favorites do not sync automatically between devices. Clearing site data can remove your saved collection. Keep an exported backup before switching browsers or clearing storage.',
    related: { href: '/favorites/', label: 'Manage boards and backups' },
  },
] as const;

export const guideQuestions = [
  {
    question: 'Which file should I download?',
    answer:
      'Choose Image for a picture to place in another app. The image download is WebP. Choose PDF for the separate printable document. To keep an editable studio design, use Save project as well.',
    href: '/guides/webp-pdf-and-editable-projects/',
    label: 'File format guide',
  },
  {
    question: 'Why does the background still look white?',
    answer:
      'Some apps display a white page behind a transparent image. Check the Transparent background label, then place the file over a colored shape in your design app. Changing the background on an artwork preview does not change the downloaded file.',
    href: '/guides/webp-pdf-and-editable-projects/',
    label: 'About image backgrounds',
  },
  {
    question: 'Why can’t I select every part of a drawing?',
    answer:
      'An image layer contains the finished drawing as pixels. Its leaves, petals or painted details are not separate vector layers. Use a layered studio starter when you need to edit individual shapes.',
    href: '/create/#studio-starters',
    label: 'Browse editable starters',
  },
  {
    question: 'Why is my print smaller than expected?',
    answer:
      'Fit to page can change the scale, and transparent borders count toward an image’s dimensions. Check the intended size in the calculator, use Actual size or 100% in your print dialog, and check your printer’s margins.',
    href: '/print-size/',
    label: 'Check print dimensions',
  },
  {
    question: 'Can I open my project on another device?',
    answer:
      'Download the editable file using Save project, transfer it to the other device and choose Open saved project in the studio. Browser recovery and Favorites stay in the current browser unless you export a separate copy.',
    href: '/create/',
    label: 'Open the studio',
  },
  {
    question: 'Can I use the artwork in products I sell?',
    answer:
      'UltraClipart artwork is for personal and educational use. Commercial use and resale are not permitted. Recoloring, editing or changing the file format does not change that license.',
    href: '/license/',
    label: 'Read the artwork license',
  },
] as const;
