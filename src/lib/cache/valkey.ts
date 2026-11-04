import '@tanstack/react-start/server-only'
import { Redis } from 'iovalkey'
import { BaseCache } from './cache'

/** Lazy, reusable client with bounded connection and command times. */
export class ValkeyCache extends BaseCache {
  private readonly client: Redis
  private warned = false
  constructor(url: string) {
    super()
    const normalized = url.replace(/^valkeys:/, 'rediss:').replace(/^valkey:/, 'redis:')
    if (!/^rediss?:\/\//.test(normalized))
      throw new Error('Unsupported CACHE_URL protocol')
    this.client = new Redis(normalized, {
      lazyConnect: true,
      connectTimeout: 1000,
      commandTimeout: 1000,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    })
    this.client.on('error', () => this.warn())
  }
  private warn(): void {
    if (!this.warned) {
      this.warned = true
      console.warn('Valkey cache unavailable; continuing without cache')
    }
  }
  private async attempt<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    try {
      if (this.client.status === 'wait' || this.client.status === 'end')
        await this.client.connect()
      return await operation()
    } catch {
      this.warn()
      return fallback
    }
  }
  async get(key: string): Promise<string | null> {
    return this.attempt(() => this.client.get(key), null)
  }
  async set(key: string, value: string, ttl: number): Promise<void> {
    if (ttl <= 0) return this.delete(key)
    await this.attempt(
      () => this.client.set(key, value, 'EX', Math.max(1, Math.ceil(ttl))),
      null,
    )
  }
  async delete(key: string): Promise<void> {
    await this.attempt(() => this.client.del(key), null)
  }
  async increment(key: string, ttl: number): Promise<number | null> {
    return this.attempt(
      async () =>
        Number(
          await this.client.eval(
            "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n",
            1,
            key,
            Math.max(1, Math.ceil(ttl)),
          ),
        ),
      null,
    )
  }
  /** Close the connection when explicitly disposing the adapter. */
  disconnect(): void {
    this.client.disconnect()
  }
}
