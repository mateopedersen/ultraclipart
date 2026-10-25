export function incomingIdea(
  storage: Pick<Storage, 'getItem' | 'removeItem'> | undefined,
  hash: string,
  now = Date.now(),
): { prompt: string; style?: string } | undefined {
  let stored: { prompt: string; style?: string } | undefined;
  try {
    const raw = storage?.getItem('ultraclipart-ai-prompt');
    if (raw) {
      storage?.removeItem('ultraclipart-ai-prompt');
      const value = JSON.parse(raw);
      if (
        typeof value?.prompt === 'string' &&
        value.prompt.trim() &&
        value.prompt.length <= 1200 &&
        Number.isFinite(value.createdAt) &&
        value.createdAt <= now &&
        now - value.createdAt < 3_600_000
      )
        stored = {
          prompt: value.prompt,
          ...(typeof value.style === 'string' ? { style: value.style } : {}),
        };
    }
  } catch {
    /* Fragment transfer must still work when storage throws. */
  }
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const idea = fragment.get('idea');
  const style = fragment.get('style');
  return idea?.trim()
    ? { prompt: idea.slice(0, 1200), ...(style && style.length <= 80 ? { style } : {}) }
    : stored;
}
