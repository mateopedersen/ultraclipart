import { trustInfoPages } from './trust-pages';

export const infoPages: Record<
  string,
  { title: string; description: string; sections: [string, string][] }
> = {
  ...trustInfoPages,
  contact: {
    title: 'Contact UltraClipart',
    description:
      'Contact UltraClipart about downloads, Clipart Studio, illustration licenses, corrections, accessibility, or a copyright concern.',
    sections: [
      [
        'Write to us',
        'Use the contact form to send your question to UltraClipart through Google Forms, or email ultraclipart@gmail.com. Include the relevant page address and a short description. Email correspondence stays in our mailbox; form submissions are recorded in Google Forms.',
      ],
      [
        'Report a problem',
        'For a broken download or editor issue, include the artwork name, browser and the steps that caused the problem. Please avoid sending passwords, payment information or private student data.',
      ],
      [
        'Copyright and accessibility',
        'Use the same email for copyright concerns and accessibility help. For a copyright report, identify the artwork and explain the rights you believe are affected. We do not promise a specific response time.',
      ],
    ],
  },
};
