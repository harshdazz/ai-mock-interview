export interface RateWindow {
  startedAt: number;
  count: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counting, kept apart from the Durable Object so it can be
 * tested without the Workers runtime. Returns the window to store, or null
 * when the request is refused and nothing should change.
 */
export function countRequest(
  stored: RateWindow | undefined,
  now: number,
  limit: number,
  windowSeconds: number
): { next: RateWindow | null; result: RateLimitResult } {
  const windowMs = windowSeconds * 1000;
  const current = stored && now - stored.startedAt < windowMs ? stored : { startedAt: now, count: 0 };

  if (current.count >= limit) {
    return {
      next: null,
      result: {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil((current.startedAt + windowMs - now) / 1000),
      },
    };
  }

  return {
    next: { ...current, count: current.count + 1 },
    result: { allowed: true, remaining: limit - current.count - 1, retryAfterSeconds: 0 },
  };
}
