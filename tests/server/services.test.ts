import { describe, expect, it } from 'vitest'
import { MemoryCache } from '../../src/lib/cache/memory'
import { ConditionalGitHub, GitHubBackoffError } from '../../src/server/github'
import type { GitHubGateway } from '../../src/server/github'
import { buildKey, FirmwareBuildCache } from '../../src/server/build-cache'
import { rateLimit } from '../../src/server/rate-limit'

describe('server services', () => {
  it('revalidates with ETag and backs off using rate headers', async () => {
    let calls = 0
    const gateway: GitHubGateway = {
      async request<T>(_url: string, headers: Record<string, string>) {
        calls++
        if (calls === 1)
          return { status: 200, headers: { etag: '"v1"' }, body: { value: 1 } as T }
        expect(headers['If-None-Match']).toBe('"v1"')
        return {
          status: 304,
          headers: { 'x-ratelimit-remaining': '1', 'x-ratelimit-reset': '10' },
        }
      },
    }
    const service = new ConditionalGitHub(
      gateway,
      new MemoryCache(),
      'installation',
      () => 1000,
    )
    expect(await service.get('/repo')).toEqual({ value: 1 })
    expect(await service.get('/repo')).toEqual({ value: 1 })
    await expect(service.get('/repo')).rejects.toBeInstanceOf(GitHubBackoffError)
    expect(calls).toBe(2)
  })
  it('reuses only unexpired artifacts and hashes all bytes', async () => {
    let now = 0
    const cache = new MemoryCache(100, () => now)
    const service = new FirmwareBuildCache(cache, 'repo', () => now)
    const input = {
      files: { 'config/keymap': '// x\n', 'west.yml': 'revision' },
      firmwareRevision: 'abc',
      workflowPath: 'build.yml',
      target: 'left',
    }
    const build = {
      runId: 1,
      commitSha: 'abc',
      artifacts: [{ id: 2, name: 'firmware', expiresAt: new Date(5000).toISOString() }],
    }
    await service.record(input, build)
    const gateway = { dispatch: async () => ({ runId: 3 }) }
    expect(await service.dispatchOrReuse(input, gateway)).toEqual({ cached: true, build })
    expect(buildKey(input)).not.toBe(
      buildKey({ ...input, files: { ...input.files, 'config/keymap': '//  x\n' } }),
    )
    now = 5000
    expect(await service.dispatchOrReuse(input, gateway)).toEqual({
      cached: false,
      runId: 3,
    })
  })
  it('limits user and IP independently and resets the window', async () => {
    const cache = new MemoryCache()
    const options = { limit: 1, windowSeconds: 60, now: 0 }
    expect((await rateLimit(cache, 'a', 'ip1', options)).allowed).toBe(true)
    expect((await rateLimit(cache, 'b', 'ip1', options)).allowed).toBe(false)
    expect((await rateLimit(cache, 'a', 'ip2', options)).allowed).toBe(false)
    expect((await rateLimit(cache, 'a', 'ip1', { ...options, now: 60000 })).allowed).toBe(
      true,
    )
  })
})
