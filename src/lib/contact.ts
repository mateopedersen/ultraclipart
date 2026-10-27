export const contactEmail = 'ultraclipart@gmail.com';
export const contactFormUrl =
  'https://docs.google.com/forms/d/e/1FAIpQLSc2fOKsmo2Ypr7EkTV9jqBO7BhyAX8HYBxcIHNybkD5fC5HRw/viewform';
// Taken from this form's official pre-fill screen. Keep in sync with its topic question.
export const contactTopicField = 'entry.1751201779';
export const contactTopics = [
  {
    id: 'general',
    title: 'A question or suggestion',
    value: 'General question',
    icon: 'help',
    hint: 'Tell us what you are looking for or what you would like to improve.',
    details: [
      'Describe your question or idea in your own words.',
      'If it concerns a particular illustration, include its page address.',
    ],
    href: '/faq/',
    link: 'Read the frequently asked questions',
  },
  {
    id: 'downloads',
    title: 'Downloads & printing',
    value: 'Download or printing problem',
    icon: 'download',
    hint: 'Help with an image file, PDF, download, or printed result.',
    details: [
      'Include the artwork page and the format you chose: Image or PDF.',
      'Tell us your browser, device, and what happened after you clicked the download control.',
    ],
    href: '/guides/webp-pdf-and-editable-projects/',
    link: 'Compare files and download options',
  },
  {
    id: 'studio',
    title: 'Clipart Studio',
    value: 'Clipart Studio problem',
    icon: 'edit',
    hint: 'Something unexpected while editing, saving, or exporting.',
    details: [
      'Describe the steps that led to the problem and the tool you were using.',
      'Include your browser and device. Your private projects are not attached to this form.',
    ],
    href: '/guides/',
    link: 'Explore the Studio guides',
  },
  {
    id: 'license',
    title: 'Using an illustration',
    value: 'License or permission question',
    icon: 'label',
    hint: 'Questions about permitted use or a particular project.',
    details: [
      'Link to the illustration and explain how you intend to use it.',
      'Describe whether the artwork will appear in a personal, classroom, published, or commercial project.',
    ],
    href: '/license/',
    link: 'Read the artwork license',
  },
  {
    id: 'correction',
    title: 'Corrections & broken links',
    value: 'Artwork correction or broken link',
    icon: 'files',
    hint: 'An inaccurate description, missing page, or link that does not work.',
    details: [
      'Include the exact page address and identify the part that needs checking.',
      'Explain the correction you suggest and share a reliable reference if relevant.',
    ],
    href: '/editorial-process/',
    link: 'See how corrections are reviewed',
  },
  {
    id: 'accessibility',
    title: 'Accessibility help',
    value: 'Accessibility support',
    icon: 'book',
    hint: 'Help accessing content or using a control with assistive technology.',
    details: [
      'Tell us which page or control is difficult to use and what you were trying to do.',
      'If useful, include the browser or assistive technology you use. No medical information is needed.',
    ],
    href: '/accessibility/',
    link: 'Read the accessibility statement',
  },
  {
    id: 'copyright',
    title: 'A copyright concern',
    value: 'Copyright concern',
    icon: 'boards',
    hint: 'A rights concern about a specific illustration or page.',
    details: [
      'Identify the artwork, the work or rights concerned, and your relationship to the rights holder.',
      'Use the copyright page for the information to include in a formal report. Do not send identity documents through this form.',
    ],
    href: '/copyright/',
    link: 'Read the copyright reporting guidance',
  },
] as const;

export function contactFormLink(topic: string = contactTopics[0].id, embedded = false) {
  const item = contactTopics.find((item) => item.id === topic) || contactTopics[0];
  const url = new URL(contactFormUrl);
  url.searchParams.set('hl', 'en');
  url.searchParams.set('usp', 'pp_url');
  url.searchParams.set(contactTopicField, item.value);
  if (embedded) url.searchParams.set('embedded', 'true');
  return url.href;
}
