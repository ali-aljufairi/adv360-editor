import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
  unseal: vi.fn(),
  seal: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('@tanstack/react-start/server-only', () => ({}))
vi.mock('@tanstack/react-start/server', () => ({
  getCookie: mocks.getCookie,
  setCookie: mocks.setCookie,
  deleteCookie: mocks.deleteCookie,
  getRequest: () => new Request('http://localhost/'),
}))
vi.mock('../../src/server/auth/crypto', () => ({ unseal: mocks.unseal, seal: mocks.seal }))
vi.mock('../../src/server/auth/github-oauth', () => ({ refreshTokens: mocks.refresh }))
import { requireGitHubToken } from '../../src/server/auth/session'
const session = {
  user: { login: 'ali-aljufairi', name: null, avatarUrl: '' },
  accessToken: 'old',
  accessExpiresAt: 0,
  refreshToken: 'refresh',
  refreshExpiresAt: null,
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SESSION_SECRET', 'secret')
  mocks.getCookie.mockReturnValue('cookie')
  mocks.unseal.mockResolvedValue(session)
  mocks.seal.mockResolvedValue('sealed')
})
describe('session refresh', () => {
  it('shares an in-flight refresh across requests', async () => {
    let resolve!: (value: object) => void
    mocks.refresh.mockReturnValue(
      new Promise((resolvePromise) => {
        resolve = resolvePromise
      }),
    )
    const first = requireGitHubToken()
    const second = requireGitHubToken()
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    resolve({ ...session, accessToken: 'new' })
    expect((await Promise.all([first, second])).map((result) => result.token)).toEqual([
      'new',
      'new',
    ])
    expect(mocks.setCookie).toHaveBeenCalledTimes(2)
  })
  it.each([
    ['invalid-refresh: bad', true],
    ['network down', false],
    ['transient-refresh: server', false],
  ])('handles %s without losing valid sessions', async (message, invalid) => {
    mocks.refresh.mockRejectedValue(new Error(message))
    await expect(requireGitHubToken()).rejects.toThrow(
      invalid ? 'not-signed-in:' : 'transient-refresh:',
    )
    expect(mocks.deleteCookie).toHaveBeenCalledTimes(invalid ? 1 : 0)
  })
})
