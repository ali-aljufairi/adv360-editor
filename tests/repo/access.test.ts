import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRepositoryAccess } from '../../src/server/repo/access'
import { ADV360_PROFILE as profile } from '../../src/lib/profile/registry'
import type { GitHubClient } from '../../src/server/repo/client'

const installation = {
  id: 42,
  account: { login: profile.repo.owner, type: 'User' },
  permissions: { contents: 'write', actions: 'read' },
  suspended_at: null,
}
const repo = {
  full_name: `${profile.repo.owner}/${profile.repo.name}`,
  permissions: { push: true },
}
function client(responses: unknown[]) {
  const get = vi.fn(async () => responses.shift())
  return { get, client: { get } as unknown as GitHubClient }
}
afterEach(() => vi.unstubAllEnvs())

describe('GitHub App repository diagnostics', () => {
  it('links to the App installation page when not installed', async () => {
    vi.stubEnv('GITHUB_APP_SLUG', 'adv360-editor')
    const fake = client([{ installations: [] }])
    expect(await getRepositoryAccess(fake.client, profile)).toMatchObject({
      reason: 'not-installed',
      canPush: false,
      settingsUrl: 'https://github.com/apps/adv360-editor/installations/new',
    })
  })
  it('distinguishes installation from repository selection and uses its exact settings URL', async () => {
    const fake = client([{ installations: [installation] }, { repositories: [] }])
    expect(await getRepositoryAccess(fake.client, profile)).toMatchObject({
      reason: 'repo-not-selected',
      canPush: false,
      settingsUrl: 'https://github.com/settings/installations/42',
    })
    expect(fake.get.mock.calls).toHaveLength(2)
  })
  it.each([
    [{ contents: 'read', actions: 'read' }, 'contents-readonly', false, true],
    [{ contents: 'write' }, 'actions-readonly', true, false],
    [{ contents: 'write', actions: 'read' }, 'ready', true, true],
  ])('detects permissions %j', async (permissions, reason, canPush, canReadBuilds) => {
    const fake = client([
      { installations: [{ ...installation, permissions }] },
      { repositories: [repo] },
    ])
    expect(await getRepositoryAccess(fake.client, profile)).toMatchObject({
      reason,
      canPush,
      canReadBuilds,
    })
  })
  it('checks user write access as well as App permission', async () => {
    const fake = client([
      { installations: [installation] },
      { repositories: [{ ...repo, permissions: { push: false } }] },
    ])
    expect(await getRepositoryAccess(fake.client, profile)).toMatchObject({
      canPush: false,
      reason: 'contents-readonly',
    })
  })
  it('pages past unrelated installations and repositories', async () => {
    const fake = client([
      {
        installations: Array.from({ length: 100 }, () => ({
          ...installation,
          account: { login: 'other' },
        })),
      },
      { installations: [installation] },
      { repositories: Array.from({ length: 100 }, () => ({ full_name: 'other/repo' })) },
      { repositories: [repo] },
    ])
    expect(await getRepositoryAccess(fake.client, profile)).toMatchObject({ reason: 'ready' })
    expect(fake.get).toHaveBeenNthCalledWith(2, '/user/installations?per_page=100&page=2')
    expect(fake.get).toHaveBeenNthCalledWith(
      4,
      '/user/installations/42/repositories?per_page=100&page=2',
    )
  })
  it('detects suspended installations before querying repositories', async () => {
    const fake = client([{ installations: [{ ...installation, suspended_at: '2026-01-01' }] }])
    expect(await getRepositoryAccess(fake.client, profile)).toMatchObject({ reason: 'suspended' })
    expect(fake.get).toHaveBeenCalledTimes(1)
  })
})
