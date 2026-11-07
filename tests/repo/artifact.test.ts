import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), raw: vi.fn() }))
vi.mock('../../src/server/auth/session', () => ({ requireGitHubToken: mocks.auth }))
vi.mock('../../src/server/repo/client', () => ({
  GitHubClient: class {
    get = mocks.get
    raw = mocks.raw
  },
}))
import { Route } from '../../src/routes/api/artifacts/$id'
const handlers = Route.options.server!.handlers as {
  GET: (context: { params: { id: string }; request: Request }) => Promise<Response>
}
const get = handlers.GET
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ token: 'secret-token', user: { login: 'user' } })
  mocks.get.mockResolvedValue({ name: 'firmware' })
})
describe('artifact route', () => {
  it.each([
    ['not-signed-in: no session', 401],
    ['not-found: missing', 404],
    ['github-error: secret-token', 502],
  ])('returns a safe JSON response for %s', async (message, status) => {
    if (status === 401) mocks.auth.mockRejectedValue(new Error(message))
    else mocks.get.mockRejectedValue(new Error(message))
    const response = await get({
      params: { id: '123' },
      request: new Request('http://localhost/api/artifacts/123?profileId=adv360'),
    })
    expect(response.status).toBe(status)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.text()).not.toContain('secret-token')
  })
})

it('rejects unknown profile IDs before contacting GitHub', async () => {
  const response = await get({
    params: { id: '123' },
    request: new Request('http://localhost/api/artifacts/123?profileId=unknown'),
  })
  expect(response.status).toBe(400)
  expect(mocks.auth).not.toHaveBeenCalled()
})
