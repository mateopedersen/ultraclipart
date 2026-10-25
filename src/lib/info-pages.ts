export const infoPages: Record<
  string,
  { title: string; description: string; sections: [string, string][] }
> = {
  license: {
    title: 'Artwork License',
    description:
      'Catalog artwork is free for personal and educational use. Separate terms apply to your original work and images made in the Builder.',
    sections: [
      [
        'What you may do',
        'You may download, edit, print and use UltraClipart illustrations in your personal and educational projects without paying. Examples include classroom worksheets, student assignments, personal greeting cards and noncommercial crafts.',
      ],
      [
        'What is not permitted',
        'Commercial use is not permitted. You may not sell an illustration, an edited version, or a collection of these illustrations as clipart. Editing the artwork does not remove these restrictions. No public-domain or unrestricted redistribution rights are granted.',
      ],
      [
        'Questions about a use',
        'If a proposed use falls outside personal or educational projects, ask ultraclipart@gmail.com before using the artwork. This license applies to the original UltraClipart artwork, not to third-party software or fonts, which retain their own licenses. Third-party characters, brand names and logos retain their owners’ rights; these terms do not grant rights in those properties or imply endorsement.',
      ],
      [
        'Images from the Builder',
        'Images you request through AI Clipart Builder are separate from our catalog license. UltraClipart does not claim ownership of your original prompts or assign the catalog restrictions to generated output. Prompt assistance is Built with Llama under the Llama 3.1 Community License. The FLUX.1 schnell image model is released under Apache 2.0, but a model license is not a guarantee that an output is unique, copyrightable or cleared for a particular use. Cloudflare service terms and third-party copyright, trademark and privacy rights still apply. Review an image and the applicable rights before publishing it or using it commercially. Combining generated output with our catalog art keeps the catalog restrictions on that artwork.',
      ],
      [
        'Your own studio work',
        'UltraClipart does not claim ownership of original work you create on a blank canvas. These artwork restrictions apply when you use UltraClipart illustrations or starter templates, including edited versions. Imported material keeps its existing rights and restrictions.',
      ],
    ],
  },
  contact: {
    title: 'Contact UltraClipart',
    description:
      'Contact UltraClipart for questions, corrections, copyright concerns or accessibility feedback.',
    sections: [
      [
        'Say hello',
        'Email ultraclipart@gmail.com for questions, feedback or corrections. Include the page address and a short description of what you need.',
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
  privacy: {
    title: 'Privacy & Your Data',
    description:
      'How UltraClipart handles local edits, AI prompts, device history, security checks and contact email.',
    sections: [
      [
        'Local editor and favorites',
        'The editor processes artwork in your browser. Favorites and recoverable editing sessions are stored on your device when local storage is available. Drawings, imported SVGs, project files and edits are processed locally. They are not automatically uploaded. A finished image and its title are uploaded only when you explicitly create a public share link. Clearing browser site data removes local recovery and any saved share-removal keys.',
      ],
      [
        'AI generation and protection',
        'When you choose Generate in AI Clipart Builder, your description and chosen settings are sent to Cloudflare Workers AI to prepare and check the description with Llama 3.1 and create an image with FLUX.1 schnell. Generation is a cloud operation, unlike local Studio editing. Cloudflare Turnstile verifies requests and may process browser and connection information to prevent abuse. Do not include private student information, contact details or sensitive personal data in prompts. We do not automatically publish generated images or create public image URLs.',
      ],
      [
        'Usage limits and essential storage',
        'A signed, essential session cookie lasting up to 24 hours helps enforce daily generation limits. The cookie uses Secure, HttpOnly and SameSite protection. The server stores short-lived usage and job records with daily hashed visitor and network identifiers, status, model and cost information. Records older than seven days are deleted when the AI service is next used; cleanup may occur later if the service is inactive. It does not store raw IP addresses, prompt text or generated images in this application ledger. Cloudflare separately processes request and inference data under its service policies. We do not use these records for advertising.',
      ],
      [
        'AI history on your device',
        'AI results and their prompts are saved in this browser using IndexedDB when available, for up to seven days and twelve results. Cleanup runs when the AI page is used. A one-hour local transfer record lets you open an image in Studio without uploading it again; expired transfer records are removed on later access. Clear saved AI images removes AI history, while Studio recovery and downloaded project files remain separate. Anyone using the same browser profile may see locally saved work. Download a project if you need a lasting copy; private browsing or storage cleanup can remove local history.',
      ],
      [
        'Hosting and requests',
        'Loading pages and downloading files sends ordinary request information, such as your IP address and browser details, to our hosting provider. Cloudflare processes these requests to deliver and protect the site. This site does not add advertising trackers or third-party analytics.',
      ],
      [
        'Email',
        'If you email us, your email provider and ours process the message. We use the information you send to handle your request. Ask us at ultraclipart@gmail.com if you want to discuss deletion of correspondence.',
      ],
      [
        'Public links and social sharing',
        'Catalog sharing uses the original artwork page link. Social posting opens the platform you choose; that platform applies its own terms and privacy policy. Native device sharing passes the image, title and caption to the app you select. We do not automatically post to your accounts. Creating a public artwork link uploads a resized WebP image and its title to Cloudflare D1. Anyone with that link can view and download the image. Projects, layers and AI prompts are not included. Publication requires an explicit choice and Turnstile verification. Public artwork remains until removed or the service is discontinued; storage limits can pause new publication. Keep the removal key saved in your browser or back it up to remove a link. Removal stops serving the image here but cannot recall copies saved by recipients or cached by social platforms. Daily hashed visitor and network identifiers protect free sharing limits; hashes and deletion counters are cleared after seven days when the service is next used. A compact deleted-link identifier remains to prevent a removed URL from being reused. No raw IP addresses are stored in the sharing database. Contact us with the share URL for privacy or copyright concerns.',
      ],
      [
        'Control and questions',
        'You can clear this site’s local storage in your browser settings. Downloaded files remain on your device until you delete them. Contact ultraclipart@gmail.com for privacy questions.',
      ],
      [
        'Cookie choices',
        'Cookie Settings in the footer explains the current necessary-only cookie setup. The Cookie Policy lists application cookies, their purposes and durations, device storage and the notice shown outside the United States. Both cookie choices keep advertising and analytics disabled. Your choice is remembered for 180 days; changing it does not delete saved artwork.',
      ],
    ],
  },
  terms: {
    title: 'Terms of Use',
    description: 'UltraClipart service terms and artwork usage policy.',
    sections: [
      [
        'Using the site',
        'UltraClipart provides editable illustrations and local creative tools for personal and educational projects. Use the site lawfully and do not interfere with its operation, attempt unauthorized access or bypass resource limits.',
      ],
      [
        'Artwork rights',
        'Our artwork license permits free personal and educational use. Commercial use and resale as clipart are prohibited. Refer to the License page for the scope of permission. Third-party software and font licenses remain separate.',
      ],
      [
        'Availability',
        'This collection is growing. Features, files and availability may change. Check the exported artwork and print settings before relying on them for a project. We do not guarantee search rankings, universal printer compatibility or uninterrupted availability.',
      ],
      [
        'AI Clipart Builder',
        'AI generation is offered subject to free daily capacity, visitor and shared-network limits, security verification and model availability. We may pause generation when limits or safeguards require it. There is no automatic paid fallback. Local editing and downloads of existing work remain available. A request that has already reached the model may count toward a limit even if you close the page, stop waiting or receive a timeout. Results can contain mistakes in anatomy, counting, spelling or other details; review them before use.',
      ],
      [
        'Responsible generation',
        'Use AI Clipart Builder only for lawful, appropriate creative work. Do not request sexual exploitation, child abuse, violent threats, hateful targeting or other illegal material; do not impersonate people, infringe rights or bypass safety and usage limits. Avoid personal or private information. Automated safeguards can make mistakes and do not replace your review. Report harmful output or a rights concern through our Copyright and corrections page. Children should use the tool with an adult who can review prompts and results.',
      ],
      [
        'Publishing and sharing artwork',
        'Publish only artwork you have permission to share, without private information about other people. You retain your rights in original work and allow UltraClipart to store and display the image you explicitly publish through a public link. Publishing does not grant visitors a reuse license or remove restrictions on source artwork. Do not use public links to host unlawful, abusive or infringing material. We may remove reported artwork or disable sharing to protect the service. Free publication has daily and storage limits; there is no automatic paid fallback. Share links are a convenience, not a permanent backup.',
      ],
      ['Get in touch', 'Questions and corrections can be sent to ultraclipart@gmail.com.'],
    ],
  },
  faq: {
    title: 'Frequently Asked Questions',
    description: 'Learn how to edit, download and print UltraClipart illustrations.',
    sections: [
      [
        'Is it free?',
        'Yes, downloads and the editor are free for personal and educational projects. No account is required. Commercial use and resale as clipart are prohibited.',
      ],
      [
        'Can I create something from scratch?',
        'Yes. Choose Create in the main navigation to open the Creative Studio. Start blank or choose an editable starter, then draw, add shapes and text, arrange layers, and export WebP or CMYK PDF. Save project keeps an editable copy. Starter templates follow the same personal and educational use license as the catalog.',
      ],
      [
        'Which format should I choose?',
        'Choose WebP for an image to use in a compatible app, or PDF for printing. Check the artwork page for the original dimensions, background and PDF page size. Raster images have a fixed resolution; enlarging them does not add detail. Save a project file when you want to keep Studio layers editable.',
      ],
      [
        'Can I change just one part?',
        'Yes. In Edit Clipart, use Smart Select to choose a region of an image and adjust its color. Separate text and vector shapes can be selected through Layers. Many catalog illustrations open as one image layer. Undo lets you step back, and downloads use your current edited document.',
      ],
      [
        'Why can print colors look different?',
        'Screens emit light, while paper reflects ink. CMYK conversion uses a print condition and may change colors outside the printable range. Ask your printer whether its workflow matches the stated profile; a PDF is not a guarantee of an exact physical color match.',
      ],
      [
        'When do new subjects appear?',
        'Browse the available subjects in Categories. New subjects appear when their illustrations are ready to download.',
      ],
      [
        'What is saved?',
        'Favorites and editor recovery data stay in your browser. Use Save project to keep an editable project file, and download WebP or PDF for a finished image.',
      ],
    ],
  },
  accessibility: {
    title: 'Accessibility',
    description: 'UltraClipart accessibility goals, supported controls and feedback contact.',
    sections: [
      [
        'Our goal',
        'We aim for WCAG 2.2 AA and test keyboard access, visible focus, labels, contrast and responsive layouts. An automated scan alone does not establish full conformance. This site has not received an independent accessibility certification.',
      ],
      [
        'Using the editor',
        'Use labeled controls and the layer list to select objects. Numeric controls provide alternatives to dragging. Undo and redo are available as buttons. The export dialog can be closed with Escape.',
      ],
      [
        'Need help?',
        'Email ultraclipart@gmail.com with the page, browser or assistive technology and the task you are trying to complete. We welcome specific reports.',
      ],
    ],
  },
  copyright: {
    title: 'Copyright & Corrections',
    description: 'Report artwork rights concerns and factual errors to UltraClipart.',
    sections: [
      [
        'Report a concern',
        'Email ultraclipart@gmail.com with the artwork URL, a description of the concern and any relevant evidence. If you represent a rights holder, explain your relationship to the work. Please do not send sensitive identification documents unless specifically needed and agreed.',
      ],
      [
        'Factual corrections',
        'Cultural and religious subjects require additional care. If you notice a factual error, identify the image and explain the correction, with a reliable source where possible.',
      ],
    ],
  },
  'editorial-process': {
    title: 'Finding & Using Clipart',
    description: 'Find the right illustration and make it work in your next project.',
    sections: [
      [
        'Choose a subject',
        'Browse the available subjects or search for an illustration. Preview its transparent edges against a light or dark background, and check the file dimensions before downloading.',
      ],
      [
        'Make your changes',
        'Open the editor to select individual layers, change colors, add text and arrange the composition. Save a project file to keep your layers editable.',
      ],
      [
        'Pick a file format',
        'Download WebP for a transparent digital image or PDF for a print layout. The format guide explains how to choose a paper size and preserve the proportions of your illustration.',
      ],
    ],
  },
};
