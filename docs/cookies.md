# Cookie notice and policy

Local implementation, 2026-10-25. No publication or hosting-dashboard change.

## Actual scope

- All Layout pages include the responsive illustrated strip and one native
  settings dialog. The shared footer links to `/cookies/` and opens settings.
- This is the current necessary-only notice, not a tracker integration or an
  advertising CMP. The source inventory and a fresh public homepage response
  showed no advertising/analytics tags. No new trackers were installed.
- Both equally styled first-layer choices keep optional tracking off. There are
  no fake analytics/advertising toggles. The UI explicitly explains why both
  actions leave those purposes disabled. New optional purposes require specific
  consent controls and blocking before activation; this acknowledgement cannot
  authorize them.
- Current source/API/quotas, sharing protection, downloaded sources, project
  storage and Favorites behavior are unchanged. Neither button clears work.

## Region and choice

`server/cookies/region.mjs` reads Cloudflare's trusted `request.cf.country`.
Only `US` suppresses the first notice. All other values, missing geodata,
timeout, network error or malformed response show it. Do not trust a browser
query, language, timezone or incoming client-supplied country header. No external
geolocation service is contacted.

`/api/cookie-region.json` is covered by the existing `/api/*` worker include rule.
The worker handles this exact URL before static assets. It returns only
`showNotice`, supports GET/HEAD, sets private/no-store plus CDN no-store headers,
creates no cookie and stores no location. The client omits credentials, disables
caching and gives the request 2.5 seconds. Local/static previews return the safe
unknown-country value. Geolocation describes the connection, not nationality or
verified legal residence; the policy says VPN/routing can change it. Settings
remain available in the United States too. Region never enables tracking.

After an explicit click, `uc_cookie_choice` stores policy version, accepted or
necessary-only choice, and date for 180 days, equally for either choice. It uses
Path=/, SameSite=Lax and Secure on HTTPS. There is no random visitor ID or server
consent database. Invalid, expired or older-version records are ignored. There is
no implied acceptance on scrolling, navigating or closing settings. A browser
that blocks cookies gets an in-memory acknowledgement for the current page and
an accessible message explaining that persistence failed.

This local record suffices to remember the current necessary-only notice; it is
not presented as an auditable server consent receipt for future optional services.

## Inventory and information

`src/lib/cookie-policy.ts` is the inventory shared with `/cookies/`:

- `__Host-uc_ai`: signed 24-hour security/limits cookie, UTC-day identity,
  Secure/HttpOnly/SameSite=Strict, used by the Builder service.
- `__Host-uc_share`: signed 24-hour security/limits cookie, UTC-day identity,
  Secure/HttpOnly/SameSite=Strict, used by public-link sharing.
- The 180-day notice-choice record above.
- Feature storage: Favorites/boards, Studio recovery/projects/palettes and vector
  favorites, up to twelve recent Builder results for seven days, one-hour Studio
  transfer, tab-session prompt/random-pick state and public-link removal keys.
  Records with no automatic expiry are described as remaining until replaced,
  removed or browser-cleared; no invented short retention limit is claimed.
- Cloudflare hosting/challenge mechanisms are described separately because
  provider security cookies depend on its configuration; the page does not claim
  a particular provider clearance cookie is always set or invent its lifetime.

The policy explains the distinction between a cookie and local/IndexedDB storage,
browser controls, region handling, retention, future purposes, contact and the
effect of clearing saved work. It links the Privacy Policy and provider policy.

## Guidance consulted

- [ICO: guidance finalized April 29, 2026](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/),
  including the current communication/strictly necessary/statistical/appearance/
  emergency exceptions. We do not apply a blanket analytics exemption globally.
- [CNIL: cookies and trackers](https://cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi):
  information, prior choice for non-exempt purposes, easy refusal and withdrawal.
- [KVKK: cookie guidance, July 2025](https://www.kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber):
  purpose/provider/duration information, requested services and equally accessible
  choices where consent is needed.
- [Cloudflare Request country property](https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties).

No global legal certification, legal-residence determination or approval of
unconfigured third-party services is claimed.

## Evidence and limits

Astro static diagnostics: zero errors and warnings, one existing unused-variable
hint. Local Cookies/Home/Studio/About/Builder/artwork routes and the preview
region JSON returned HTTP 200. The region preview has JSON/no-store headers.
Source/markup inventories verify one notice/dialog and unique IDs, shared
restored display classes, policy links and absence of the rejected public
production-origin labels. The cookie policy also has a dedicated social cover.

Browser access still reports Local browser use disabled. No interaction suite was
added/run, and US/non-US edge delivery, cross-page cookie persistence, keyboard
focus and mobile layout have not been established by a live browser session.
No full catalog production build or production publication was performed.
