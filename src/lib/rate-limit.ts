/**
 * Simple in-memory rate limiter using a sliding window counter.
 * Suitable for single-process deployments. For multi-instance,
 * migrate to upstash/ratelimit or Redis-backed solution.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60_000);

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key.
 * @param key - Unique identifier (e.g., userId, IP)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // No existing entry or window expired — start fresh
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { success: true, remaining: config.max - 1, resetAt: now + config.windowMs };
  }

  // Within window
  if (entry.count < config.max) {
    entry.count++;
    return { success: true, remaining: config.max - entry.count, resetAt: entry.resetAt };
  }

  // Exceeded
  return { success: false, remaining: 0, resetAt: entry.resetAt };
}

// ─── Preset configurations ──────────────────────────────

/** Webhook: 30 requests per 10 seconds */
export const WEBHOOK_RATE_LIMIT: RateLimitConfig = { max: 30, windowMs: 10_000 };

/** API route: 60 requests per minute */
export const API_RATE_LIMIT: RateLimitConfig = { max: 60, windowMs: 60_000 };

/** Auth/login: 10 attempts per minute */
export const AUTH_RATE_LIMIT: RateLimitConfig = { max: 10, windowMs: 60_000 };
