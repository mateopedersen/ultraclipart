import { SITE, socialLinks } from '../../src/share/core.ts';

const encoder = new TextEncoder();
const COOKIE = '__Host-uc_share';
export const SHARE_LIMITS = Object.freeze({
  maxImageBytes: 384 * 1024,
  maxRequestBytes: 550 * 1024,
  maxDimension: 2048,
  maxStorageBytes: 128 * 1024 * 1024,
  maxShares: 1000,
  maxLifetimeShares: 10000,
  daily: 100,
  visitorDaily: 3,
  networkDaily: 10,
});
class ShareError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.status = status;
  }
}
const headers = (publicPage = false) => ({
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': publicPage ? 'noindex, follow' : 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), web-share=(self)',
  'Strict-Transport-Security': 'max-age=31536000',
});
function json(body, status = 200, cookie) {
  return Response.json(body, {
    status,
    headers: {
      ...headers(),
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
      ...(status === 429 ? { 'Retry-After': '3600' } : {}),
    },
  });
}
const hex = (bytes) =>
  [...new Uint8Array(bytes)].map((n) => n.toString(16).padStart(2, '0')).join('');
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
const sha256 = async (value) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
function equal(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function originFor(env) {
  const origin = env.SHARE_PUBLIC_ORIGIN || 'https://ultraclipart.com';
  if (
    origin !== 'https://ultraclipart.com' &&
    !/^http:\/\/(?:127\.0\.0\.1|localhost):\d{1,5}$/.test(origin)
  )
    throw new ShareError('sharing_unavailable', 503);
  return origin;
}
function verifyOrigin(request, origin) {
  if (
    new URL(request.url).origin !== origin ||
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    (request.headers.has('origin') && request.headers.get('origin') !== origin) ||
    (['POST', 'DELETE'].includes(request.method) && request.headers.get('origin') !== origin)
  )
    throw new ShareError('origin_not_allowed', 403);
}
function enabled(env) {
  return !!(
    env.SHARE_ENABLED === 'true' &&
    env.AI_FREE_PLAN_CONFIRMED === 'true' &&
    env.AI_DB &&
    typeof env.AI_SESSION_SECRET === 'string' &&
    env.AI_SESSION_SECRET.length >= 32 &&
    env.TURNSTILE_SECRET &&
    env.TURNSTILE_SITEKEY
  );
}
async function identity(request, env, now, create) {
  const day = new Date(now).toISOString().slice(0, 10);
  const raw = request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-uc_share=([^;]+)/)?.[1] || '';
  let parts = raw.split('.');
  let fresh = false;
  if (
    parts.length !== 3 ||
    parts[0] !== day ||
    !/^[a-f0-9]{32}$/.test(parts[1]) ||
    !equal(parts[2], await hmac(env.AI_SESSION_SECRET, `share-session:${parts[0]}.${parts[1]}`))
  ) {
    if (!create) throw new ShareError('session_required', 403);
    const id = crypto.randomUUID().replaceAll('-', '');
    parts = [day, id, await hmac(env.AI_SESSION_SECRET, `share-session:${day}.${id}`)];
    fresh = true;
  }
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || ip.length > 64) throw new ShareError('network_verification_unavailable', 503);
  return {
    day,
    visitor: await hmac(env.AI_SESSION_SECRET, `share-visitor:${day}.${parts[1]}`),
    network: await hmac(env.AI_SESSION_SECRET, `share-network:${day}:${ip}`),
    csrfToken: await hmac(env.AI_SESSION_SECRET, `share-csrf:${day}.${parts[1]}`),
    cookie: fresh
      ? `${COOKIE}=${parts.join('.')}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=86400`
      : undefined,
  };
}
async function readJson(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || ''))
    throw new ShareError('json_required', 415);
  if (Number(request.headers.get('content-length')) > SHARE_LIMITS.maxRequestBytes)
    throw new ShareError('request_too_large', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ShareError('invalid_request');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > SHARE_LIMITS.maxRequestBytes) {
        await reader.cancel();
        throw new ShareError('request_too_large', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new ShareError('invalid_json');
  }
}
const ascii = (bytes, offset, count) =>
  String.fromCharCode(...bytes.subarray(offset, offset + count));
const uint24 = (bytes, at) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
// A bounded, non-animated WebP container only. Browsers re-encode before publication;
// metadata chunks are rejected to avoid accidentally exposing imported EXIF/XMP.
export function validateWebP(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > SHARE_LIMITS.maxImageBytes)
    throw new ShareError('image_too_large', 413);
  if (bytes.byteLength < 26 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP')
    throw new ShareError('invalid_image', 415);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) !== bytes.byteLength - 8) throw new ShareError('invalid_image', 415);
  let offset = 12,
    raster = null,
    extended = null,
    alpha = false;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) throw new ShareError('invalid_image', 415);
    const type = ascii(bytes, offset, 4),
      length = view.getUint32(offset + 4, true),
      start = offset + 8;
    const end = start + length;
    if (length < 1 || end + (length % 2) > bytes.byteLength)
      throw new ShareError('invalid_image', 415);
    if (type === 'VP8X') {
      if (
        offset !== 12 ||
        extended ||
        length !== 10 ||
        bytes[start] & ~0x10 ||
        bytes[start + 1] ||
        bytes[start + 2] ||
        bytes[start + 3]
      )
        throw new ShareError('invalid_image', 415);
      extended = { width: uint24(bytes, start + 4) + 1, height: uint24(bytes, start + 7) + 1 };
    } else if (type === 'ALPH') {
      if (!extended || alpha || raster || !(bytes[20] & 0x10))
        throw new ShareError('invalid_image', 415);
      alpha = true;
    } else if (type === 'VP8 ' || type === 'VP8L') {
      if (raster) throw new ShareError('invalid_image', 415);
      if (type === 'VP8 ') {
        if (length < 10 || bytes[start] & 1 || ascii(bytes, start + 3, 3) !== '\x9d\x01\x2a')
          throw new ShareError('invalid_image', 415);
        raster = {
          width: view.getUint16(start + 6, true) & 0x3fff,
          height: view.getUint16(start + 8, true) & 0x3fff,
        };
      } else {
        if (alpha || length < 5 || bytes[start] !== 0x2f)
          throw new ShareError('invalid_image', 415);
        const bits = view.getUint32(start + 1, true);
        if (bits >>> 29) throw new ShareError('invalid_image', 415);
        raster = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      }
    } else throw new ShareError('invalid_image', 415);
    offset = end + (length % 2);
  }
  if (
    !raster ||
    (extended && (extended.width !== raster.width || extended.height !== raster.height))
  )
    throw new ShareError('invalid_image', 415);
  if (
    !raster.width ||
    !raster.height ||
    raster.width > SHARE_LIMITS.maxDimension ||
    raster.height > SHARE_LIMITS.maxDimension
  )
    throw new ShareError('image_dimensions', 413);
  return raster;
}
export function validateShare(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ShareError('invalid_request');
  if (
    Object.keys(value).some(
      (key) => !['title', 'imageData', 'turnstileToken', 'id', 'deleteToken'].includes(key),
    )
  )
    throw new ShareError('unsupported_option');
  const hasId = Object.hasOwn(value, 'id');
  const hasDeleteToken = Object.hasOwn(value, 'deleteToken');
  if (
    hasId !== hasDeleteToken ||
    (hasId &&
      (typeof value.id !== 'string' ||
        !/^[a-f0-9]{32}$/.test(value.id) ||
        typeof value.deleteToken !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(value.deleteToken)))
  )
    throw new ShareError('invalid_publication_key');
  if (
    typeof value.title !== 'string' ||
    !value.title.isWellFormed() ||
    !value.title.trim() ||
    value.title.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(value.title)
  )
    throw new ShareError('invalid_title');
  const title = value.title.trim().normalize('NFC');
  if (title.length > 100) throw new ShareError('invalid_title');
  if (
    typeof value.turnstileToken !== 'string' ||
    !value.turnstileToken ||
    value.turnstileToken.length > 2048
  )
    throw new ShareError('verification_required', 403);
  if (
    typeof value.imageData !== 'string' ||
    !value.imageData ||
    value.imageData.length > Math.ceil(SHARE_LIMITS.maxImageBytes / 3) * 4
  )
    throw new ShareError('image_too_large', 413);
  if (value.imageData.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.imageData))
    throw new ShareError('invalid_image', 415);
  let raw;
  try {
    raw = atob(value.imageData);
  } catch {
    throw new ShareError('invalid_image', 415);
  }
  if (btoa(raw) !== value.imageData) throw new ShareError('invalid_image', 415);
  const image = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) image[i] = raw.charCodeAt(i);
  return {
    title,
    image,
    ...validateWebP(image),
    turnstileToken: value.turnstileToken,
    ...(hasId ? { id: value.id, deleteToken: value.deleteToken } : {}),
  };
}
export const INSERT_SHARE_SQL = `INSERT INTO public_shares
  (id,title,image,image_bytes,width,height,created,day,visitor,network,delete_hash)
  SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11
  WHERE (SELECT COUNT(*) FROM public_shares)<10000
  AND (SELECT COUNT(*) FROM public_shares WHERE deleted_at IS NULL)<1000
  AND (SELECT COALESCE(SUM(image_bytes),0) FROM public_shares WHERE deleted_at IS NULL)+?4<=134217728
  AND (SELECT COUNT(*) FROM public_shares WHERE day=?8)<100
  AND (SELECT COUNT(*) FROM public_shares WHERE day=?8 AND visitor=?9)<3
  AND (SELECT COUNT(*) FROM public_shares WHERE day=?8 AND network=?10)<10`;
export async function insertShare(db, who, input, now, id, deleteHash) {
  return db
    .prepare(INSERT_SHARE_SQL)
    .bind(
      id,
      input.title,
      input.image.buffer.slice(
        input.image.byteOffset,
        input.image.byteOffset + input.image.byteLength,
      ),
      input.image.byteLength,
      input.width,
      input.height,
      now,
      who.day,
      who.visitor,
      who.network,
      deleteHash,
    )
    .run();
}
function publicationResponse(origin, id, deleteToken) {
  return json(
    {
      id,
      url: `${origin}/share/${id}/`,
      imageUrl: `${origin}/share/${id}/image.webp`,
      deleteToken,
    },
    201,
  );
}
async function recoverPublication(db, origin, id, deleteToken, deleteHash) {
  const row = await db
    .prepare('SELECT delete_hash,deleted_at FROM public_shares WHERE id=?1')
    .bind(id)
    .first();
  if (!row) return null;
  if (row.deleted_at !== null || !equal(row.delete_hash, deleteHash))
    throw new ShareError('publication_conflict', 409);
  return publicationResponse(origin, id, deleteToken);
}
function cleanup(db, now, context) {
  if (!context?.waitUntil) return;
  // Clear expired identifying counters but retain compact ids permanently: a
  // delayed retry must never resurrect a deleted public URL. The lifetime cap
  // bounds these tombstones to 10,000 rows in the same free database.
  context.waitUntil(
    Promise.resolve()
      .then(() =>
        Promise.all([
          db
            .prepare(
              "UPDATE public_shares SET visitor=NULL,network=NULL,day='',title='',image=NULL,image_bytes=0,delete_hash=NULL,created=0,deleted_at=1,width=1,height=1 WHERE deleted_at IS NOT NULL AND created<?1 AND (created<>0 OR day<>'' OR visitor IS NOT NULL OR network IS NOT NULL)",
            )
            .bind(now - 7 * 86400000)
            .run(),
          db
            .prepare(
              'UPDATE public_shares SET visitor=NULL,network=NULL WHERE created<?1 AND visitor IS NOT NULL',
            )
            .bind(now - 7 * 86400000)
            .run(),
        ]),
      )
      .catch(() => {}),
  );
}
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
function publicHtml(share, origin) {
  const title = escape(share.title),
    url = `${origin}/share/${share.id}/`,
    image = `${url}image.webp`;
  const publicUrl = `${SITE}/share/${share.id}/`;
  const networks = socialLinks(
    publicUrl,
    `Made with UltraClipart — ${share.title}`,
    `${publicUrl}image.webp`,
  )
    .map(
      (network) =>
        `<a class="share-network" href="${escape(network.href)}" target="_blank" rel="noopener noreferrer" aria-label="Share on ${escape(network.name)}"><span style="background:${network.color}"><img src="/social/${network.id}.svg" width="24" height="24" alt=""></span><span>${escape(network.name)}</span></a>`,
    )
    .join('');
  const sharePanel = `<section class="share-panel" aria-labelledby="share-heading"><h2 id="share-heading">Pass a little inspiration along.</h2><p>Choose where to share. You review the post in the app before publishing.</p><div class="share-networks">${networks}</div><label class="share-link-label" for="shared-artwork-link">Artwork link</label><input id="shared-artwork-link" class="share-link" readonly value="${escape(publicUrl)}" aria-describedby="share-link-help"><p id="share-link-help" class="share-link-help">Select and copy this link to send it anywhere.</p></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | UltraClipart</title><meta name="description" content="Artwork shared by its creator with UltraClipart. View the image or make your own clipart."><meta name="robots" content="noindex,follow"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:site_name" content="UltraClipart"><meta property="og:title" content="${title}"><meta property="og:description" content="Artwork shared by its creator with UltraClipart."><meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta property="og:image:alt" content="${title}"><meta property="og:image:type" content="image/webp"><meta property="og:image:width" content="${share.width}"><meta property="og:image:height" content="${share.height}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:image" content="${image}"><meta name="twitter:image:alt" content="${title}"><style>
*{box-sizing:border-box}body{margin:0;color:#14274b;background:#f6f9ff;font:16px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:#125bbb}header{background:white;border-bottom:1px solid #dce7f5}header>div,main,footer{max-width:1080px;margin:auto;padding:24px}.brand{display:inline-flex;align-items:center;gap:10px;color:#112a4c;text-decoration:none;font-size:23px;font-weight:750}.brand img{width:32px;height:36px}main{padding-top:38px}.eyebrow{font-size:14px;font-weight:650;color:#476385}h1{font-size:clamp(26px,5vw,42px);line-height:1.18;letter-spacing:-.035em;overflow-wrap:anywhere;margin:12px 0 24px}.art{display:grid;place-items:center;min-height:240px;padding:24px;border:1px solid #dce7f5;border-radius:20px;background-color:white;background-image:linear-gradient(45deg,#f0f3f7 25%,transparent 25%),linear-gradient(-45deg,#f0f3f7 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f0f3f7 75%),linear-gradient(-45deg,transparent 75%,#f0f3f7 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}.art img{display:block;max-width:100%;max-height:68vh;width:auto;height:auto;object-fit:contain}.actions{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}.button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:11px 20px;border:1px solid #bed3ed;border-radius:11px;background:white;color:#164a8c;text-decoration:none;font-weight:650}.primary{background:#0965dd;color:white;border-color:#0965dd}.note{color:#4c6381;font-size:15px}.create{margin-top:32px;padding:26px;border:1px solid #d8e5f6;border-radius:16px;background:#edf4ff}.create h2{margin:0 0 8px;font-size:24px;line-height:1.25}.create p{margin:0;color:#435e81}footer{font-size:14px;color:#4c6381}footer a{margin-right:20px}a:focus-visible{outline:3px solid #397fd6;outline-offset:4px}@media(max-width:480px){header>div,main,footer{padding:20px}.art{padding:12px}.actions .button{flex:1}.create{padding:22px}.note{font-size:14px}}
.share-panel{margin:30px 0;padding:24px;border:1px solid #d8e5f6;border-radius:16px;background:white}.share-panel h2{font-size:24px;line-height:1.3;margin:0 0 8px}.share-panel p{margin:0;color:#4c6381;font-size:15px}.share-networks{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:8px;margin:22px 0}.share-network{display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 4px;border:1px solid transparent;border-radius:12px;text-decoration:none;color:#203a60;font-size:14px;font-weight:650}.share-network:hover{background:#f0f6ff;border-color:#c9ddf6}.share-network>span:first-child{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;box-shadow:0 3px 8px #142e5515}.share-network img{object-fit:contain;filter:brightness(0) invert(1)}.share-link-label{display:block;font-weight:650;font-size:15px;margin-bottom:8px}.share-link{display:block;width:100%;min-width:0;min-height:48px;border:1px solid #c5d7ee;border-radius:9px;background:#f7faff;color:#193c6d;padding:12px;font:14px/1.5 system-ui,sans-serif}.share-link:focus-visible{outline:3px solid #397fd6;outline-offset:3px}.share-panel .share-link-help{font-size:14px;margin-top:7px}@media(max-width:760px){.share-networks{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:480px){.share-panel{padding:20px}.share-panel h2{font-size:22px}.share-networks{gap:6px}.share-network{font-size:14px}}
</style></head><body><header><div><a class="brand" href="${origin}/"><img src="/logo.svg" alt="" width="32" height="36">UltraClipart</a></div></header><main><div class="eyebrow">Shared by its creator</div><h1>${title}</h1><div class="art"><img src="${image}" width="${share.width}" height="${share.height}" alt="${title}"></div><div class="actions"><a class="button primary" href="${image}" download="ultraclipart-${share.id}.webp">Download image</a><a class="button" href="${origin}/">Explore clipart</a></div>${sharePanel}<p class="note">This image was published by its creator. A public link does not grant a license to reuse the artwork; respect the creator’s rights and any source artwork permissions.</p><section class="create"><h2>Bring your own idea to life.</h2><p>Start with a blank canvas, or describe an idea with AI and make it your own.</p><div class="actions"><a class="button primary" href="${origin}/create/">Open Clipart Studio</a><a class="button" href="${origin}/ai-clipart-generator/">AI Clipart Builder</a></div></section></main><footer><a href="${origin}/privacy/">Privacy</a><a href="${origin}/copyright/">Report artwork</a><a href="${origin}/license/">Artwork permissions</a></footer></body></html>`;
}
async function publicShare(request, env, match) {
  if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405);
  if (!env.AI_DB) throw new ShareError('sharing_unavailable', 503);
  const isImage = match[2] === '/image.webp';
  const row = await env.AI_DB.prepare(
    `SELECT id,title,width,height${isImage && request.method !== 'HEAD' ? ',image,image_bytes' : ''} FROM public_shares WHERE id=?1 AND deleted_at IS NULL`,
  )
    .bind(match[1])
    .first();
  if (!row) return json({ error: 'not_found' }, 404);
  if (isImage) {
    let bytes = null;
    if (request.method !== 'HEAD') {
      if (row.image instanceof ArrayBuffer) bytes = new Uint8Array(row.image);
      else if (ArrayBuffer.isView(row.image))
        bytes = new Uint8Array(row.image.buffer, row.image.byteOffset, row.image.byteLength);
      else if (
        Array.isArray(row.image) &&
        row.image.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
      )
        bytes = Uint8Array.from(row.image);
      if (
        !bytes ||
        bytes.byteLength !== row.image_bytes ||
        bytes.byteLength > SHARE_LIMITS.maxImageBytes
      )
        throw new ShareError('service_unavailable', 503);
    }
    return new Response(bytes, {
      headers: {
        ...headers(true),
        'Content-Type': 'image/webp',
        'Content-Disposition': `inline; filename="ultraclipart-${row.id}.webp"`,
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  }
  return new Response(request.method === 'HEAD' ? null : publicHtml(row, originFor(env)), {
    headers: {
      ...headers(true),
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy':
        "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}
export async function handleShare(request, env, context) {
  const path = new URL(request.url).pathname;
  const publicMatch = path.match(/^\/share\/([a-f0-9]{32})(\/image\.webp|\/?)$/);
  try {
    if (publicMatch) return await publicShare(request, env, publicMatch);
    const deletion = path.match(/^\/api\/share\/([a-f0-9]{32})$/);
    if (!['/api/share/session', '/api/share/create'].includes(path) && !deletion)
      return json({ error: 'not_found' }, 404);
    if (request.method !== (deletion ? 'DELETE' : path.endsWith('/session') ? 'GET' : 'POST'))
      return json({ error: 'method_not_allowed' }, 405);
    const origin = originFor(env);
    verifyOrigin(request, origin);
    if (deletion) {
      if (!env.AI_DB) throw new ShareError('sharing_unavailable', 503);
      const token = request.headers
        .get('authorization')
        ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
      if (!token) throw new ShareError('delete_token_required', 403);
      const result = await env.AI_DB.prepare(
        "UPDATE public_shares SET image=NULL,image_bytes=0,title='',delete_hash=NULL,deleted_at=?3 WHERE id=?1 AND delete_hash=?2 AND deleted_at IS NULL",
      )
        .bind(deletion[1], await sha256(token), Date.now())
        .run();
      if (!result.meta?.changes) return json({ error: 'not_found' }, 404);
      return json({ deleted: true });
    }
    if (!enabled(env))
      return json(
        {
          enabled: false,
          remaining: 0,
          globalRemaining: 0,
          error: 'sharing_unavailable',
          limits: SHARE_LIMITS,
        },
        503,
      );
    const now = Date.now(),
      who = await identity(request, env, now, path.endsWith('/session'));
    const resetAt = new Date(new Date(now).setUTCHours(24, 0, 0, 0)).toISOString();
    if (path.endsWith('/session')) {
      const usage = await env.AI_DB.prepare(
        `SELECT
        (SELECT COUNT(*) FROM public_shares) AS lifetime,
        (SELECT COUNT(*) FROM public_shares WHERE deleted_at IS NULL) AS active,
        (SELECT COALESCE(SUM(image_bytes),0) FROM public_shares WHERE deleted_at IS NULL) AS bytes,
        (SELECT COUNT(*) FROM public_shares WHERE day=?1) AS today,
        (SELECT COUNT(*) FROM public_shares WHERE day=?1 AND visitor=?2) AS visitor,
        (SELECT COUNT(*) FROM public_shares WHERE day=?1 AND network=?3) AS network`,
      )
        .bind(who.day, who.visitor, who.network)
        .first();
      const capacityRemainingBytes = Math.max(0, SHARE_LIMITS.maxStorageBytes - usage.bytes);
      const globalRemaining = Math.max(
        0,
        Math.min(
          SHARE_LIMITS.daily - usage.today,
          SHARE_LIMITS.maxShares - usage.active,
          SHARE_LIMITS.maxLifetimeShares - usage.lifetime,
          capacityRemainingBytes > 0 ? SHARE_LIMITS.daily : 0,
        ),
      );
      cleanup(env.AI_DB, now, context);
      return json(
        {
          enabled: true,
          sitekey: env.TURNSTILE_SITEKEY,
          csrfToken: who.csrfToken,
          remaining: Math.max(
            0,
            Math.min(
              SHARE_LIMITS.visitorDaily - usage.visitor,
              SHARE_LIMITS.networkDaily - usage.network,
              globalRemaining,
            ),
          ),
          globalRemaining,
          capacityRemainingBytes,
          resetAt,
          limits: SHARE_LIMITS,
        },
        200,
        who.cookie,
      );
    }
    if (!equal(request.headers.get('x-csrf-token'), who.csrfToken))
      throw new ShareError('csrf_failed', 403);
    const input = validateShare(await readJson(request));
    // Save the client capability before publishing so a lost HTTP response can
    // be recovered or removed without creating a second public image.
    const id = input.id || crypto.randomUUID().replaceAll('-', '');
    const deleteToken =
      input.deleteToken ||
      btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
    const deleteHash = await sha256(deleteToken);
    if (input.id) {
      const recovered = await recoverPublication(env.AI_DB, origin, id, deleteToken, deleteHash);
      if (recovered) return recovered;
    }
    let verification;
    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET,
          response: input.turnstileToken,
          remoteip: request.headers.get('CF-Connecting-IP'),
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('verification unavailable');
      verification = await response.json();
    } catch {
      throw new ShareError('verification_unavailable', 503);
    }
    if (
      verification?.success !== true ||
      verification.hostname !== new URL(origin).hostname ||
      verification.action !== 'share'
    )
      throw new ShareError('verification_failed', 403);
    let result;
    try {
      result = await insertShare(env.AI_DB, who, input, now, id, deleteHash);
    } catch (error) {
      // Concurrent copies may pass verification before the first INSERT commits.
      const recovered = await recoverPublication(env.AI_DB, origin, id, deleteToken, deleteHash);
      if (recovered) return recovered;
      throw error;
    }
    if (!result.meta?.changes) {
      if (input.id) {
        const recovered = await recoverPublication(env.AI_DB, origin, id, deleteToken, deleteHash);
        if (recovered) return recovered;
      }
      return json({ error: 'capacity_or_rate_limit', resetAt }, 429);
    }
    cleanup(env.AI_DB, now, context);
    return publicationResponse(origin, id, deleteToken);
  } catch (error) {
    return json(
      { error: error instanceof ShareError ? error.message : 'service_unavailable' },
      error instanceof ShareError ? error.status : 503,
    );
  }
}
