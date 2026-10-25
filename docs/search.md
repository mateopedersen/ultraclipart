# Search: coverage, language and ranking

## Public content

`getSearchBuild()` registers all published, indexable artwork. The same versioned build includes subjects and collections, static public pages, shared information-page content, guide and teacher flows, Studio tools, starter compositions, vector elements and text styles. New published catalog rows, registered subjects and static pages enter the normal build automatically.

Static page indexing removes scripts, styles, SVG markup, expressions and frontmatter. An AST reader additionally extracts literal values of public copy fields (title, description, body, text, name, story, caption, label, intro, question, answer and alt). It never evaluates code or serializes runtime data. Explicit adapters cover generated catalog directories and imported public data. Favorites, private projects, AI history and prompts are not indexed. Guide and Studio results link to the actual section or tool. Studio view links reveal the requested controls or starter without applying it to the saved project.

## Artwork relevance

`search-language.ts` owns normalization, controlled aliases, spelling, query intent and phrase scoring. Bump `SEARCH_LANGUAGE_VERSION` when changing these rules. Search metadata/source hashes, public page copy and the language version all feed the release fingerprint.

Fields are weighted: title 7, subject 6, image alt 5, style/color/orientation/formats/transparency and slug 4, scene description and keywords 3, collection 2. Known usage-copy suffixes are removed from scene descriptions so generic suggestions about classroom projects do not dominate object searches. Artwork metadata itself is unchanged. Index postings retain title positions; matching a consecutive title phrase and matching all requested words in the title receive additional weight. In multiword artwork searches, a broad collection name alone cannot satisfy a required visual detail; those low-weight terms remain useful for broad single-word discovery.

Normalization handles accents, punctuation, controlled English synonyms and common Turkish subject/color wording, plurals and common action forms. It is a finite vocabulary, not a translation service or a visual recognition model. Generic request phrases and prepositions are ignored. Black & white, line-art/coloring and transparent-background intents use actual catalog facets; unavailable file types are not invented. `without`, `excluding`, `not` and `no` can exclude the following term. Color filters include Multicolor, Beige and Gold; silhouette is accepted too. Black & White uses the audited monochrome flag, and Watercolor can use a visible title/alt label in addition to the style field.

An exact intersection is attempted first. Spelling dictionaries are loaded only if that has no complete match; one edit or an adjacent transposition can be corrected, and a final incomplete word can be completed. Controlled related wording supports examples such as father/dad and baby/newborn. Complete matches stay separate from partial matches. If at least 65% of three or more meaningful terms match, a subject-anchored related section may appear; missing terms are visible under each card. Those cards do not inflate the complete-match count. A search cannot establish a visual detail absent from reviewed metadata.

## Transport and interface

The existing bounded token, ID, card and facet shards remain. Initial unfiltered browsing loads only the visible cards. The public site directory is separate and loaded on a query or a non-artwork result tab. It has a small independent memory cache. Manifest responses revalidate; files beneath a release fingerprint are immutable. A missing old release file triggers one manifest reload. Visible search pages recheck after 30 seconds, on focus/return, and before a new query after the refresh interval, without interrupting composition input.

The search page has result-type tabs, live input with IME handling, preserved filters/history, explicit loading/empty/error states and pagination. Artwork filters and sorting are identified as such. Homepage and other full-site search forms offer real artwork/page suggestions, arrow-key selection, Escape dismissal and direct navigation. Late and canceled responses cannot replace a newer query. Rendering uses text nodes and trusted same-origin page links.

## Evidence

This change was checked with static compiler diagnostics and generated-index/markup inspection. No search regression suite or browser interaction tests were run in this turn. The browser tool continued to report Local browser use disabled. Changes remain local until the owner explicitly authorizes publication.
