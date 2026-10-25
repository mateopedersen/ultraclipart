# Catalog download experience

Every catalog Image/PDF entry (detail, category, search, favorites, collections and related cards) goes to `/download/{id}/?format=webp|pdf`. Server-rendered links work without JavaScript. The query chooses the highlighted first format; it cannot supply a file URL. Both files remain available in static HTML, so disabled scripts never strand a user.

The page includes the real preview, original dimensions, actual byte count, hash, printing guidance, license, Studio link and related discovery. It is `noindex,follow`, has a self canonical without the format query and is excluded from the sitemap. The final file comes from the same hash-pinned publication manifest. The existing bounded CDN downloader also checks the expected byte count and SHA-256 before saving. It retains retry, timeout, MIME/signature and origin checks. Editor-generated personal exports and native sharing retain their own local export controls.

## Future advertising

`[data-download-ad-slot]` is an isolated provider mount after the useful file and project information, well separated from download controls. The region is hidden until a real configured provider populates it. This release activates **no advertising scripts or requests** and includes no dummy advertisement. Integration must retain the “Advertisements” label, keep the actual download above the fold where practical, preserve appropriate separation at every width and never require an ad click or a countdown. Do not place ads on pop-ups, empty error states or pages primarily created to show advertising. Configure the real publisher/slot IDs and the applicable consent platform before enabling AdSense; no publisher identifier or approval is invented here.

Policy references checked 2026-10-25:
- https://support.google.com/adsense/answer/1346295
- https://support.google.com/adsense/answer/48182
- https://support.google.com/adsense/answer/1282097
