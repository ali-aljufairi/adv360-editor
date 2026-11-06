import { afterEach, describe, expect, it, vi } from 'vitest'
import { seal, unseal } from '../../src/server/auth/crypto'
import { exchangeCode, fetchUser, refreshTokens } from '../../src/server/auth/github-oauth'
import { sanitizeReturnTo } from '../../src/server/auth/redirect'

afterEach(() => vi.unstubAllEnvs())

describe('auth helpers', () => {
  it('authenticates encrypted sessions and rejects tampering and wrong keys', async () => {
    const value = await seal({ login: 'alice' }, 'secret')
    expect(await unseal(value, 'secret')).toEqual({ login: 'alice' })
    const parts = value.split('.')
    parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`
    expect(await unseal(parts.join('.'), 'secret')).toBeNull()
    expect(await unseal(value, 'wrong')).toBeNull()
  })

  it('exchanges and refreshes tokens and fetches a user', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'id')
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'secret')
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          access_token: 'access',
          expires_in: 60,
          refresh_token: 'refresh',
          refresh_token_expires_in: 120,
        }),
      )
      .mockResolvedValueOnce(Response.json({ access_token: 'new' }))
      .mockResolvedValueOnce(Response.json({ login: 'alice', avatar_url: 'avatar', name: null }))
    expect((await exchangeCode('code', 'https://example.com/callback', fetcher)).refreshToken).toBe(
      'refresh',
    )
    expect((await refreshTokens('refresh', fetcher)).accessExpiresAt).toBeNull()
    expect((await fetchUser('new', fetcher)).login).toBe('alice')
  })

  it('rejects GitHub errors and unsafe redirects', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'id')
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'secret')
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: 'bad' }))
    await expect(exchangeCode('bad', 'url', fetcher)).rejects.toThrow('github-error')
    expect(sanitizeReturnTo('//evil.example')).toBe('/')
    expect(sanitizeReturnTo('/safe?tab=1')).toBe('/safe?tab=1')
  })
})
