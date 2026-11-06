import '@tanstack/react-start/server-only'
import { cacheKey } from '../lib/cache'
import type { Cache } from '../lib/cache'

/** Fixed windows, independently enforced per authenticated user and trusted client IP. */
export async function rateLimit(
  cache: Cache,
  userId: string,
  ip: string,
  options: {
    limit: number
    windowSeconds: number
    now?: number
  },
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const { limit, windowSeconds } = options
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    !Number.isInteger(windowSeconds) ||
    windowSeconds < 1
  ) {
    throw new Error('Invalid rate limit')
  }
  const seconds = Math.floor((options.now ?? Date.now()) / 1000)
  const window = Math.floor(seconds / windowSeconds)
  const ttl = (window + 1) * windowSeconds - seconds
  const counts = await Promise.all(
    ['user', 'ip'].map((kind, index) =>
      cache.increment(
        cacheKey('rate', kind, index === 0 ? userId : ip, String(window)),
        ttl,
      ),
    ),
  )
  return {
    allowed: counts.every((count) => count === null || count <= limit),
    retryAfterSeconds: ttl,
  }
}
