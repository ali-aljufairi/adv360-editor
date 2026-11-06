import '@tanstack/react-start/server-only'
import { MemoryCache } from './memory'
import { ValkeyCache } from './valkey'
import type { Cache } from './cache'

let instance: Cache | undefined
/** Reuse one cache and connection per server process. */
export function getCache(): Cache {
  if (!instance) {
    try {
      instance = process.env.CACHE_URL
        ? new ValkeyCache(process.env.CACHE_URL)
        : new MemoryCache()
    } catch {
      console.warn('Invalid cache configuration; using process-local memory')
      instance = new MemoryCache()
    }
  }
  return instance
}
export { cacheKey, getJson, setJson } from './cache'
export type { Cache } from './cache'
export { MemoryCache } from './memory'
export { ValkeyCache } from './valkey'
