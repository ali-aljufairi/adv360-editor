import '@tanstack/react-start/server-only'
import { cacheKey, getJson, setJson } from '../lib/cache'
import type { Cache } from '../lib/cache'

export interface GitHubResponse<T> {
  status: number
  headers: Record<string, string | undefined>
  body?: T
}
export interface GitHubGateway {
  request<T>(url: string, headers: Record<string, string>): Promise<GitHubResponse<T>>
}
interface CachedResponse<T> {
  etag: string
  body: T
}

/** Thrown while the GitHub rate limit is low; callers can retry after resetAt. */
export class GitHubBackoffError extends Error {
  constructor(public readonly resetAt: number) {
    super('GitHub rate limit is low; retry after reset')
  }
}

/** Conditional GETs. Scope identifies the installation/user and representation, never a token. */
export class ConditionalGitHub {
  private resetAt = 0
  constructor(
    private readonly gateway: GitHubGateway,
    private readonly cache: Cache,
    private readonly scope: string,
    private readonly now = Date.now,
    private readonly ttl = 3600,
    private readonly lowThreshold = 10,
  ) {}
  async get<T>(url: string): Promise<T> {
    if (this.resetAt > this.now()) throw new GitHubBackoffError(this.resetAt)
    const key = cacheKey('github', this.scope, url)
    const saved = await getJson<CachedResponse<T>>(this.cache, key)
    const response = await this.gateway.request<T>(
      url,
      saved ? { 'If-None-Match': saved.etag } : {},
    )
    const remaining = response.headers['x-ratelimit-remaining']
    const reset = response.headers['x-ratelimit-reset']
    if (
      remaining !== undefined &&
      reset !== undefined &&
      Number(remaining) <= this.lowThreshold
    ) {
      const resetTime = Number(reset) * 1000
      if (Number.isFinite(resetTime)) this.resetAt = resetTime
    }
    if (response.status === 304) {
      if (!saved) throw new Error('GitHub returned 304 without a cached body')
      return saved.body
    }
    if (response.status < 200 || response.status >= 300 || response.body === undefined) {
      throw new Error(`GitHub request failed (${response.status})`)
    }
    const etag = response.headers.etag
    if (etag) await setJson(this.cache, key, { etag, body: response.body }, this.ttl)
    else await this.cache.delete(key)
    return response.body
  }
}
