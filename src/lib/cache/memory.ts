import '@tanstack/react-start/server-only'
import { BaseCache } from './cache'

/** Bounded, process-local LRU cache for development and tests. */
export class MemoryCache extends BaseCache {
  private readonly entries = new Map<string, { value: string; expires: number }>()
  constructor(
    private readonly capacity = 1000,
    private readonly now = Date.now,
  ) {
    super()
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new Error('Invalid cache capacity')
  }
  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key)
    if (!entry) return null
    this.entries.delete(key)
    if (entry.expires <= this.now()) return null
    this.entries.set(key, entry)
    return entry.value
  }
  async set(key: string, value: string, ttl: number): Promise<void> {
    this.entries.delete(key)
    if (ttl <= 0) return
    this.entries.set(key, { value, expires: this.now() + ttl * 1000 })
    if (this.entries.size > this.capacity)
      this.entries.delete(this.entries.keys().next().value!)
  }
  async delete(key: string): Promise<void> {
    this.entries.delete(key)
  }
  async increment(key: string, ttl: number): Promise<number | null> {
    const entry = this.entries.get(key)
    const count = entry && entry.expires > this.now() ? Number(entry.value) + 1 : 1
    if (entry && entry.expires > this.now()) entry.value = String(count)
    else await this.set(key, String(count), ttl)
    return count
  }
}
