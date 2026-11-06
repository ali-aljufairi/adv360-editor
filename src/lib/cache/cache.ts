import '@tanstack/react-start/server-only'

/** Cache operations use seconds for TTLs. Implementations fail open. */
export interface Cache {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  delete(key: string): Promise<void>
  increment(key: string, ttlSeconds: number): Promise<number | null>
  getOrSet(key: string, ttlSeconds: number, load: () => Promise<string>): Promise<string>
}

/** Separate namespaces and escape components to prevent collisions. */
export function cacheKey(...parts: string[]): string {
  return `adv360:v1:${parts.map(encodeURIComponent).join(':')}`
}

/** Read JSON, treating corrupt entries as misses. */
export async function getJson<T>(cache: Cache, key: string): Promise<T | null> {
  const value = await cache.get(key)
  if (value === null) return null
  try {
    return JSON.parse(value) as T
  } catch {
    await cache.delete(key)
    return null
  }
}

/** Write JSON with an explicit expiry. */
export async function setJson(
  cache: Cache,
  key: string,
  value: unknown,
  ttl: number,
): Promise<void> {
  await cache.set(key, JSON.stringify(value), ttl)
}

/** Shared process-local single-flight behavior. Loader errors are propagated. */
export abstract class BaseCache implements Cache {
  private readonly flights = new Map<string, Promise<string>>()
  abstract get(key: string): Promise<string | null>
  abstract set(key: string, value: string, ttlSeconds: number): Promise<void>
  abstract delete(key: string): Promise<void>
  abstract increment(key: string, ttlSeconds: number): Promise<number | null>
  async getOrSet(key: string, ttl: number, load: () => Promise<string>): Promise<string> {
    const existing = this.flights.get(key)
    if (existing) return existing
    const flight = (async () => {
      const value = await this.get(key)
      if (value !== null) return value
      const loaded = await load()
      await this.set(key, loaded, ttl)
      return loaded
    })()
    this.flights.set(key, flight)
    try {
      return await flight
    } finally {
      this.flights.delete(key)
    }
  }
}
