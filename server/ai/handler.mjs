import { composePrompt, styles } from '../../src/ai/prompt.ts';
import {
  CloudflareWorkersAIFreeProvider,
  MODEL,
  TEXT_MODEL,
  TEXT_RESERVATION,
  IMAGE_RESERVATION,
  RESERVATION,
  ProviderError,
  translateDescription,
} from './provider.mjs';
const COOKIE = '__Host-uc_ai';
const encoder = new TextEncoder();
export class ApiError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export function publicFailure(error) {
  if (
    (error instanceof ApiError || error instanceof ProviderError) &&
    typeof error.code === 'string' &&
    /^[a-z_]{3,60}$/.test(error.code)
  )
    return {
      code: error.code,
      status: [400, 403, 413, 415, 422, 429, 503, 504].includes(error.status) ? error.status : 503,
    };
  if (
    [403, 429].includes(error?.status) ||
    /\b(?:429|3040|3036)\b|quota|budget/i.test(String(error))
  )
    return { code: 'capacity_exhausted', status: 429 };
  return { code: 'service_unavailable', status: 503 };
}
const limit = (value, fallback, max) =>
  Number.isInteger(Number(value)) && Number(value) > 0 ? Math.min(Number(value), max) : fallback;
export function settings(env) {
  return {
    daily: limit(env.MAX_DAILY_GENERATIONS, 24, 28),
    neurons: limit(env.MAX_DAILY_NEURONS, 6000, 7000),
    visitor: limit(env.MAX_GENERATIONS_PER_VISITOR, 2, 10),
    concurrent: limit(env.MAX_CONCURRENT_JOBS, 2, 3),
  };
}
function enabled(env) {
  return (
    env.AI_GENERATION_ENABLED === 'true' &&
    env.AI_FREE_PLAN_CONFIRMED === 'true' &&
    env.AI &&
    env.AI_DB &&
    env.TURNSTILE_SECRET &&
    env.AI_SESSION_SECRET?.length >= 32 &&
    env.TURNSTILE_SITEKEY &&
    [MODEL, TEXT_MODEL].every((model) =>
      (env.AI_MODEL_ALLOWLIST || `${MODEL},${TEXT_MODEL}`).split(',').includes(model),
    )
  );
}
function response(body, status = 200, cookie) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
      ...(status === 429 ? { 'Retry-After': '60' } : {}),
    },
  });
}
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function identity(request, env, now, create = false) {
  const day = new Date(now).toISOString().slice(0, 10),
    raw = request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-uc_ai=([^;]+)/)?.[1] || '';
  let parts = raw.split('.'),
    fresh = false;
  if (
    parts.length !== 3 ||
    parts[0] !== day ||
    !/^[a-f0-9-]{36}$/.test(parts[1]) ||
    !same(parts[2], await hmac(env.AI_SESSION_SECRET, `${parts[0]}.${parts[1]}`))
  ) {
    if (!create) throw new ApiError('session_required', 403);
    const id = crypto.randomUUID();
    parts = [day, id, await hmac(env.AI_SESSION_SECRET, `${day}.${id}`)];
    fresh = true;
  }
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) throw new ApiError('network_verification_unavailable', 503);
  return {
    day,
    visitor: await hmac(env.AI_SESSION_SECRET, 'visitor:' + parts[0] + '.' + parts[1]),
    network: await hmac(env.AI_SESSION_SECRET, 'network:' + day + ':' + ip),
    cookie: fresh
      ? `${COOKIE}=${parts.join('.')}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=86400`
      : undefined,
  };
}
export function validateInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError('invalid_request');
  const allowed = [
    'prompt',
    'style',
    'composition',
    'palette',
    'detail',
    'outline',
    'margin',
    'background',
    'backgroundColor',
    'turnstileToken',
  ];
  if (Object.keys(value).some((k) => !allowed.includes(k)))
    throw new ApiError('unsupported_option');
  if (
    typeof value.prompt !== 'string' ||
    value.prompt.trim().length < 3 ||
    value.prompt.length > 1200 ||
    !value.prompt.isWellFormed() ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.prompt)
  )
    throw new ApiError('invalid_prompt');
  if (typeof value.style !== 'string' || !Object.hasOwn(styles, value.style))
    throw new ApiError('invalid_style');
  for (const [k, n] of [
    ['composition', 120],
    ['palette', 80],
  ])
    if (value[k] !== undefined && (typeof value[k] !== 'string' || value[k].length > n))
      throw new ApiError('invalid_option');
  for (const [k, values] of Object.entries({
    detail: ['balanced', 'detailed', 'simple'],
    outline: ['none', 'fine', 'bold'],
    margin: ['standard', 'generous'],
    background: ['white', 'transparent', 'color'],
  }))
    if (value[k] !== undefined && !values.includes(value[k])) throw new ApiError('invalid_option');
  if (value.backgroundColor !== undefined && !/^#[\da-f]{6}$/i.test(value.backgroundColor))
    throw new ApiError('invalid_color');
  if (
    typeof value.turnstileToken !== 'string' ||
    !value.turnstileToken ||
    value.turnstileToken.length > 2048
  )
    throw new ApiError('verification_required', 403);
  // Defense in depth alongside provider moderation. Never promise exhaustive multilingual detection.
  const plain = [value.prompt, value.composition || '', value.palette || '']
    .join(' ')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '');
  if (
    /\b(porn(?:ography)?|nudes?|naked|sexual|sexually|rape|gore|dismember(?:ed|ment)?|beheading|child\s+abuse|nazi\s+propaganda)\b|ç[ıi]plak|pornograf|cinsel\s+istismar/.test(
      plain,
    )
  )
    throw new ApiError('content_blocked', 422);
  if (
    /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|ignore\s+(all\s+)?(previous|system)\s+instructions|document\.cookie|javascript:/i.test(
      plain,
    )
  )
    throw new ApiError('invalid_prompt');
  const composedPrompt = composePrompt(value);
  if (composedPrompt.length > 2048) throw new ApiError('prompt_too_detailed');
  return { ...value, prompt: value.prompt.trim(), composedPrompt };
}
async function readJson(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || ''))
    throw new ApiError('json_required', 415);
  if (Number(request.headers.get('content-length')) > 8192)
    throw new ApiError('request_too_large', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError('invalid_request');
  let bytes = 0,
    chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 8192) {
        await reader.cancel();
        throw new ApiError('request_too_large', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(bytes);
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk, at);
    at += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined));
  } catch {
    throw new ApiError('invalid_json');
  }
}
export const RESERVE_SQL = `INSERT INTO ai_jobs(id,day,visitor,network,created,lease,status,model,width,height,steps,reserved)
 SELECT ?1,?2,?3,?4,?5,?6,'running',?7,1024,1024,4,?8
 WHERE (SELECT COUNT(*) FROM ai_jobs WHERE day=?2) < ?9
 AND (SELECT COALESCE(SUM(reserved),0) FROM ai_jobs WHERE day=?2)+?8<=?10
 AND (SELECT COUNT(*) FROM ai_jobs WHERE day=?2 AND visitor=?3)<?11
 AND (SELECT COUNT(*) FROM ai_jobs WHERE day=?2 AND network=?4)<4
 AND NOT EXISTS(SELECT 1 FROM ai_jobs WHERE day=?2 AND network=?4 AND created>?12)
 AND NOT EXISTS(SELECT 1 FROM ai_jobs WHERE visitor=?3 AND status IN ('running','uncertain') AND lease>?5)
 AND (SELECT COUNT(*) FROM ai_jobs WHERE status IN ('running','uncertain') AND lease>?5)<?13
 AND (SELECT blocked_until FROM ai_control WHERE id=1)<=?5`;
export async function reserve(db, who, config, now, id) {
  return db
    .prepare(RESERVE_SQL)
    .bind(
      id,
      who.day,
      who.visitor,
      who.network,
      now,
      now + 180000,
      MODEL,
      RESERVATION,
      config.daily,
      config.neurons,
      config.visitor,
      now - 60000,
      config.concurrent,
    )
    .run();
}
export async function handleAi(request, env, context) {
  const path = new URL(request.url).pathname.replace(/\/$/, ''),
    now = Date.now(),
    resetAt = new Date(new Date(now).setUTCHours(24, 0, 0, 0)).toISOString();
  if (path === '/api/ai/clipart/health' && request.method === 'GET')
    return response({ enabled: !!enabled(env), model: MODEL });
  if (!['/api/ai/clipart/quota', '/api/ai/clipart/generate'].includes(path))
    return response({ error: 'not_found' }, 404);
  if (request.method !== (path.endsWith('/quota') ? 'GET' : 'POST'))
    return response({ error: 'method_not_allowed' }, 405);
  if (!enabled(env))
    return response(
      {
        error: 'generation_unavailable',
        enabled: false,
        remaining: 0,
        globalRemaining: 0,
        resetAt,
      },
      503,
    );
  let job, who;
  try {
    const origin = env.AI_PUBLIC_ORIGIN || 'https://ultraclipart.com';
    if (new URL(request.url).origin !== origin) throw new ApiError('origin_not_allowed', 403);
    if (request.method === 'POST' && request.headers.get('origin') !== origin)
      throw new ApiError('origin_not_allowed', 403);
    if (request.headers.get('sec-fetch-site') === 'cross-site')
      throw new ApiError('origin_not_allowed', 403);
    who = await identity(request, env, now, path.endsWith('/quota'));
    const config = settings(env);
    if (path.endsWith('/quota')) {
      context?.waitUntil(
        env.AI_DB.prepare('DELETE FROM ai_jobs WHERE created<?1')
          .bind(now - 7 * 86400000)
          .run()
          .catch(() => {}),
      );
      const usage = await env.AI_DB.prepare(
        `SELECT COUNT(*) AS total,COALESCE(SUM(reserved),0) AS neurons,COALESCE(SUM(visitor=?2),0) AS visitor,COALESCE(SUM(network=?3),0) AS network,
         COALESCE(MAX(CASE WHEN network=?3 THEN created+60000 ELSE 0 END),0) AS network_cooldown,
         COALESCE(MAX(CASE WHEN visitor=?2 AND status IN ('running','uncertain') THEN lease ELSE 0 END),0) AS visitor_cooldown
         FROM ai_jobs WHERE day=?1`,
      )
        .bind(who.day, who.visitor, who.network)
        .first();
      const circuit = await env.AI_DB.prepare(
        'SELECT blocked_until FROM ai_control WHERE id=1',
      ).first();
      const globalRemaining = Math.max(
        0,
        Math.min(
          config.daily - usage.total,
          Math.floor((config.neurons - usage.neurons) / RESERVATION),
        ),
      );
      return response(
        {
          enabled: true,
          remaining: Math.max(
            0,
            Math.min(config.visitor - usage.visitor, 4 - usage.network, globalRemaining),
          ),
          globalRemaining,
          visitorLimit: config.visitor,
          resetAt,
          sitekey: env.TURNSTILE_SITEKEY,
          model: MODEL,
          cooldownUntil:
            Math.max(circuit?.blocked_until || 0, usage.network_cooldown, usage.visitor_cooldown) >
            now
              ? new Date(
                  Math.max(
                    circuit?.blocked_until || 0,
                    usage.network_cooldown,
                    usage.visitor_cooldown,
                  ),
                ).toISOString()
              : null,
        },
        200,
        who.cookie,
      );
    }
    const input = validateInput(await readJson(request));
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET,
        response: input.turnstileToken,
        remoteip: request.headers.get('CF-Connecting-IP'),
      }),
      signal: AbortSignal.timeout(10000),
    });
    const check = await verification.json();
    if (
      !verification.ok ||
      check.success !== true ||
      check.hostname !== new URL(origin).hostname ||
      check.action !== 'clipart'
    )
      throw new ApiError('verification_failed', 403);
    const id = crypto.randomUUID(),
      reservation = await reserve(env.AI_DB, who, config, now, id);
    if (!reservation.meta?.changes) throw new ApiError('capacity_or_rate_limit', 429);
    job = id;
    // Reservation remains charged even on disconnect/timeout. Never retry inference automatically.
    const provider = new CloudflareWorkersAIFreeProvider(env.AI);
    let timer,
      expired = false;
    const deadline = Date.now() + 90000;
    const recordCall = async (operation, model, reserved, run) => {
      if (expired || Date.now() >= deadline) throw new ApiError('generation_timeout', 504);
      // A missing/broken cost ledger fails closed before either provider invocation.
      await env.AI_DB.prepare(
        `INSERT INTO ai_model_calls(job_id,operation,model,created,width,height,steps,max_output_tokens,reserved,status)
      VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,'running')`,
      )
        .bind(
          job,
          operation,
          model,
          Date.now(),
          operation === 'generate' ? 1024 : null,
          operation === 'generate' ? 1024 : null,
          operation === 'generate' ? 4 : null,
          operation === 'translate' ? 512 : null,
          reserved,
        )
        .run();
      if (expired || Date.now() >= deadline) throw new ApiError('generation_timeout', 504);
      try {
        const value = await run();
        await env.AI_DB.prepare(
          "UPDATE ai_model_calls SET status='complete',actual=?3 WHERE job_id=?1 AND operation=?2",
        )
          .bind(job, operation, value.neurons)
          .run();
        await env.AI_DB.prepare(
          'UPDATE ai_jobs SET reserved=MAX(reserved,(SELECT COALESCE(SUM(actual),0) FROM ai_model_calls WHERE job_id=?1)) WHERE id=?1',
        )
          .bind(job)
          .run();
        // An unexpected model price closes the circuit before a second call is allowed.
        if (value.neurons !== null && value.neurons > reserved) {
          await env.AI_DB.prepare('UPDATE ai_control SET blocked_until=?1 WHERE id=1')
            .bind(Date.parse(resetAt))
            .run();
          throw new ApiError('capacity_exhausted', 429);
        }
        return value;
      } catch (error) {
        const failure = publicFailure(error);
        try {
          await env.AI_DB.prepare(
            "UPDATE ai_model_calls SET status=?3,error_code=?4 WHERE job_id=?1 AND operation=?2 AND status='running'",
          )
            .bind(job, operation, expired ? 'uncertain' : 'failed', failure.code)
            .run();
        } catch {}
        throw error;
      }
    };
    const generation = (async () => {
      const translated = await recordCall('translate', TEXT_MODEL, TEXT_RESERVATION, () =>
        translateDescription(env.AI, input.prompt),
      );
      // Model output is untrusted; the independent input guards run again.
      validateInput({
        prompt: translated.prompt,
        style: input.style,
        turnstileToken: input.turnstileToken,
      });
      const finalPrompt = composePrompt({ ...input, prompt: translated.prompt });
      if (finalPrompt.length > 2048) throw new ApiError('prompt_too_detailed');
      const image = await recordCall('generate', MODEL, IMAGE_RESERVATION, () =>
        provider.generate(finalPrompt),
      );
      return {
        ...image,
        composedPrompt: finalPrompt,
        translatedPrompt: translated.prompt,
        neurons:
          image.neurons !== null && translated.neurons !== null
            ? image.neurons + translated.neurons
            : null,
      };
    })();
    const result = await Promise.race([
      generation,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new ApiError('generation_timeout', 504));
        }, 90000);
      }),
    ]).finally(() => clearTimeout(timer));
    const actual = result.neurons;
    await env.AI_DB.prepare(
      "UPDATE ai_jobs SET status='complete',actual=?2,reserved=MAX(reserved,COALESCE(?2,0)) WHERE id=?1",
    )
      .bind(job, actual)
      .run();
    if (actual > RESERVATION)
      await env.AI_DB.prepare('UPDATE ai_control SET blocked_until=?1 WHERE id=1')
        .bind(Date.parse(resetAt))
        .run();
    context?.waitUntil(
      env.AI_DB.prepare('DELETE FROM ai_jobs WHERE created<?1')
        .bind(now - 7 * 86400000)
        .run()
        .catch(() => {}),
    );
    return response({
      image: result.image,
      model: MODEL,
      width: 1024,
      height: 1024,
      createdAt: new Date(now).toISOString(),
      neurons: actual,
      prompt: input.prompt,
      composedPrompt: result.composedPrompt,
      translatedPrompt: result.translatedPrompt,
      style: input.style,
    });
  } catch (error) {
    const { code, status } = publicFailure(error);
    if (job) {
      try {
        await env.AI_DB.prepare('UPDATE ai_jobs SET status=?3,error_code=?2 WHERE id=?1')
          .bind(job, code, code === 'generation_timeout' ? 'uncertain' : 'failed')
          .run();
        if (code === 'generation_timeout')
          await env.AI_DB.prepare(
            "UPDATE ai_model_calls SET status='uncertain',error_code=?2 WHERE job_id=?1 AND status='running'",
          )
            .bind(job, code)
            .run();
        const count = await env.AI_DB.prepare(
          "SELECT COUNT(*) AS failures FROM ai_jobs WHERE status IN ('failed','uncertain') AND created>?1",
        )
          .bind(now - 300000)
          .first();
        if (count.failures >= 3 || code === 'capacity_exhausted')
          await env.AI_DB.prepare('UPDATE ai_control SET blocked_until=?1 WHERE id=1')
            .bind(code === 'capacity_exhausted' ? Date.parse(resetAt) : now + 300000)
            .run();
      } catch {}
    }
    return response({ error: code, resetAt }, status);
  }
}
