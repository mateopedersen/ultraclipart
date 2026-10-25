# AI Builder examples

Local update, 2026-10-25. Not published.

## Public idea library

`src/ai/ideas.ts` owns 48 hand-written example descriptions in 12 categories, with four distinct ideas in each category. The selection covers people, plants, food, learning, celebrations, everyday objects, places, sport, music, animals, imaginary subjects and seasons. All 15 supported illustration styles are represented.

Each idea has a stable ID, category, label, description, supported style, catalog reference ID and a short optional ingredient. The page resolves images and their existing alt text through `publishedArt` and its approved asset map. Withdrawn references are omitted; visible totals follow the actual rendered list. There are 48 different published subject images. No catalog titles, alt text, identity reviews or source files were rewritten.

Catalog pictures are explicitly labeled subject references. They are not model outputs, before/after pairs, a promised rendering, or image-to-image inputs. The gardening robot and astronaut ideas explicitly describe imaginary subjects. Four style references use paper-layer Earth, a monochrome fern, a flat tropical island and a watercolor guitar. The existing homepage's three illustrated prompt transfers retain their own matching descriptions in `invitationExamples`.

## Controls

- The initial board and optional-detail chooser show four different subjects. A category selector exposes all 48 optional subjects.
- Built-in and custom details share the eight-detail limit and case-insensitive duplicate detection. All selected details remain visible and removable across categories. Custom input supports Enter to add and Escape to close.
- The public library has category filters, local description search and pagination: eight examples on larger viewports, four on small screens. Counts and empty states use the visible matching list. Cards show complete descriptions with no truncation.
- Use This Idea and Surprise Me fill the draft and style, clear previous details/moods/accents, and reset conflicting optional composition/palette settings. They do not request generation, replace an existing result, or spend allowance.
- Example selection buttons respect the existing busy state. Keyboard focus returns to the description. A visible selected-style label and All 15 Styles action expose the full supported style menu.
- The site search indexes only these public reusable descriptions as AI Builder page content. Visitor prompts, generated history and projects remain excluded.

## Evidence and limits

Static inventory: 48 unique IDs, descriptions and catalog images; 12 categories; 15 styles; no missing published/local references. The 50 distinct source thumbnails used across examples and style references were visually inspected together. Local server HTML includes 48 example cards, 48 detail choices and 13 filters including All Ideas, with four initial detail choices and eight initial example cards. The responsive client changes small-screen pagination to four.

Compiler diagnostics are recorded in `/tmp/ultra-ai-ideas-diagnostics.txt`. These checks establish compilation and source/content coverage only. No model generation, interaction test suite, browser layout, mobile interaction or export test was run for this update. The browser tool was unavailable in this chat. Changes remain local.
