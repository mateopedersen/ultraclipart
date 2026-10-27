import { COOKIE_CHOICE_NAME, COOKIE_CHOICE_SECONDS, COOKIE_POLICY_VERSION } from './cookie-policy';

export type CookieChoice = { version: string; choice: 'accepted' | 'necessary'; at: number };
export function validChoice(value: unknown): value is CookieChoice {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<CookieChoice>;
  return (
    entry.version === COOKIE_POLICY_VERSION &&
    (entry.choice === 'accepted' || entry.choice === 'necessary') &&
    typeof entry.at === 'number' &&
    Number.isFinite(entry.at) &&
    entry.at <= Date.now() + 60000 &&
    Date.now() - entry.at < COOKIE_CHOICE_SECONDS * 1000
  );
}
export function readChoice(): CookieChoice | undefined {
  try {
    const prefix = `${COOKIE_CHOICE_NAME}=`;
    const raw = document.cookie
      .split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(prefix))
      ?.slice(prefix.length);
    if (!raw || raw.length > 1024) return;
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    return validChoice(parsed) ? parsed : undefined;
  } catch {
    return;
  }
}
