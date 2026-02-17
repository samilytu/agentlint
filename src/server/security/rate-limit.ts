const windows = new Map<string, { startedAt: number; count: number }>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

function pruneExpiredWindows(now: number, windowMs: number): void {
  for (const [key, value] of windows.entries()) {
    if (now - value.startedAt >= windowMs) {
      windows.delete(key);
    }
  }
}

export function resetRateLimitWindowsForTests(): void {
  windows.clear();
}

export function getRateLimitWindowCountForTests(): number {
  return windows.size;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  pruneExpiredWindows(now, windowMs);
  const existing = windows.get(key);

  if (!existing || now - existing.startedAt >= windowMs) {
    windows.set(key, { startedAt: now, count: 1 });

    return {
      allowed: true,
      remaining: Math.max(maxRequests - 1, 0),
      retryAfterMs: 0,
    };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: windowMs - (now - existing.startedAt),
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    remaining: Math.max(maxRequests - existing.count, 0),
    retryAfterMs: 0,
  };
}
