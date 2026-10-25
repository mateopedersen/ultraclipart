export interface GenerationQuota {
  enabled: boolean;
  remaining: number;
  globalRemaining: number;
  visitorLimit: number;
  resetAt: string;
  sitekey: string;
  model: string;
  cooldownUntil?: string | null;
}
export class AiServiceError extends Error {
  constructor(
    public code: string,
    public status = 503,
  ) {
    super(code);
  }
}
export async function readAiResponse(response: Response): Promise<Record<string, unknown>> {
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new AiServiceError(
      response.status === 404 ? 'service_not_configured' : 'invalid_service_response',
      response.status,
    );
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new AiServiceError('invalid_service_response', response.status);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AiServiceError('invalid_service_response', response.status);
  const data = value as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof data.error === 'string' ? data.error : 'service_unavailable';
    throw new AiServiceError(code, response.status);
  }
  return data;
}
export function generationQuota(value: Record<string, unknown>): GenerationQuota {
  const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  if (
    typeof value.enabled !== 'boolean' ||
    !count(value.remaining) ||
    !count(value.globalRemaining) ||
    typeof value.resetAt !== 'string' ||
    !Number.isFinite(Date.parse(value.resetAt)) ||
    typeof value.sitekey !== 'string' ||
    (value.enabled && !value.sitekey) ||
    typeof value.model !== 'string' ||
    !value.model ||
    (value.visitorLimit !== undefined &&
      (!count(value.visitorLimit) || value.visitorLimit === 0)) ||
    (value.cooldownUntil != null &&
      (typeof value.cooldownUntil !== 'string' ||
        !Number.isFinite(Date.parse(value.cooldownUntil))))
  )
    throw new AiServiceError('invalid_service_response');
  return { ...value, visitorLimit: value.visitorLimit ?? 2 } as GenerationQuota;
}
export function quotaRetryAt(quota: GenerationQuota, now = Date.now()): number | undefined {
  if (!quota.enabled) return;
  if (quota.remaining < 1 || quota.globalRemaining < 1) {
    const reset = Date.parse(quota.resetAt);
    return reset > now ? reset : now + 60_000;
  }
  const cooldown = Date.parse(quota.cooldownUntil || '');
  return cooldown > now ? cooldown : undefined;
}
