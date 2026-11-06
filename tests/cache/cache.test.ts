import { describe, expect, it } from 'vitest'
import { MemoryCache } from '../../src/lib/cache/memory'
import { ValkeyCache } from '../../src/lib/cache/valkey'
import { cacheKey, getJson, setJson } from '../../src/lib/cache/cache'

describe('cache', () => {
  it('expires entries and evicts least recently used', async () => {
    let now = 0
    const cache = new MemoryCache(2, () => now)
    await cache.set('a', '1', 1)
    await cache.set('b', '2', 2)
    await cache.get('a')
    await cache.set('c', '3', 2)
    expect(await cache.get('b')).toBeNull()
    now = 1000
    expect(await cache.get('a')).toBeNull()
  })
  it('shares concurrent loads and retries errors', async () => {
    const cache = new MemoryCache()
    let calls = 0
    const load = async () => {
      calls++
      await Promise.resolve()
      return 'value'
    }
    expect(
      await Promise.all([cache.getOrSet('x', 2, load), cache.getOrSet('x', 2, load)]),
    ).toEqual(['value', 'value'])
    expect(calls).toBe(1)
    await expect(
      cache.getOrSet('bad', 2, async () => {
        throw Error('bad')
      }),
    ).rejects.toThrow()
    expect(await cache.getOrSet('bad', 2, load)).toBe('value')
  })
  it('namespaces and handles JSON', async () => {
    const cache = new MemoryCache()
    expect(cacheKey('a:b', 'c')).not.toBe(cacheKey('a', 'b:c'))
    await setJson(cache, 'x', { ok: true }, 2)
    expect(await getJson(cache, 'x')).toEqual({ ok: true })
    await cache.set('x', '{', 2)
    expect(await getJson(cache, 'x')).toBeNull()
  })
  it.skipIf(!process.env.CACHE_URL)('integrates with Valkey', async () => {
    const cache = new ValkeyCache(process.env.CACHE_URL!)
    const key = cacheKey('test', crypto.randomUUID())
    try {
      await cache.set(key, 'hello', 10)
      expect(await cache.get(key)).toBe('hello')
      await cache.delete(key)
      expect(await cache.increment(key, 10)).toBe(1)
      expect(await cache.increment(key, 10)).toBe(2)
      await cache.delete(key)
    } finally {
      cache.disconnect()
    }
  })
})
