import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitHubClient } from '../../src/server/repo/client'
import { loadConfig } from '../../src/server/repo/config'
import { commitChanges } from '../../src/server/repo/commit'
import { getBuildStatus } from '../../src/server/repo/build'
import { ADV360_PROFILE } from '../../src/lib/profile/registry'

const profile = ADV360_PROFILE
const request = {
  profileId: 'adv360',
  branch: 'test',
  baseSha: 'abcdef123',
  message: 'update',
  files: { [`${profile.configRoot}/test.keymap`]: 'hello' },
}

function fake(responses: { body?: unknown; status?: number; headers?: Record<string, string> }[]) {
  const calls: { url: string; method: string; body: unknown }[] = []
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    const response = responses.shift()
    if (!response) throw new Error('Unexpected request')
    return new Response(JSON.stringify(response.body ?? {}), {
      status: response.status ?? 200,
      headers: response.headers,
    })
  }
  return { client: new GitHubClient('secret', `test-${Math.random()}`, fetcher), calls }
}

afterEach(() => vi.useRealTimers())

describe('repository GitHub operations', () => {
  it('loads only configuration text and decodes UTF-8', async () => {
    const { client, calls } = fake([
      { body: { object: { sha: 'head' } } },
      {
        body: {
          truncated: false,
          tree: [
            { path: `${profile.configRoot}/a.keymap`, type: 'blob', sha: 'a' },
            { path: `${profile.configRoot}/image.png`, type: 'blob', sha: 'b' },
            { path: 'elsewhere/a.conf', type: 'blob', sha: 'c' },
            { path: `${profile.configRoot}/folder.conf`, type: 'tree', sha: 'd' },
          ],
        },
      },
      { body: { content: Buffer.from('こんにちは').toString('base64') } },
    ])
    const result = await loadConfig(client, profile)
    expect(result.headSha).toBe('head')
    expect(result.files).toEqual({ [`${profile.configRoot}/a.keymap`]: 'こんにちは' })
    expect(calls).toHaveLength(3)
  })

  it('backs up and commits with the expected Git objects', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2025-03-04T12:34:00Z'))
    const { client, calls } = fake([
      { body: { object: { sha: request.baseSha } } },
      {},
      { body: { tree: { sha: 'base-tree' } } },
      { body: { sha: 'blob' } },
      { body: { sha: 'tree' } },
      { body: { sha: 'commit', html_url: 'url' } },
      {},
    ])
    const result = await commitChanges(client, profile, request)
    expect(calls.map((call) => [call.method, call.url.split('/git/')[1]])).toEqual([
      ['GET', 'ref/heads/test'],
      ['POST', 'refs'],
      ['GET', 'commits/abcdef123'],
      ['POST', 'blobs'],
      ['POST', 'trees'],
      ['POST', 'commits'],
      ['PATCH', 'refs/heads/test'],
    ])
    expect(calls[1].body).toEqual({
      ref: 'refs/heads/editor-backup/20250304-1234-abcdef1',
      sha: request.baseSha,
    })
    expect(calls[3].body).toEqual({ content: 'hello', encoding: 'utf-8' })
    expect(calls[4].body).toEqual({
      base_tree: 'base-tree',
      tree: [
        { path: `${profile.configRoot}/test.keymap`, mode: '100644', type: 'blob', sha: 'blob' },
      ],
    })
    expect(calls[5].body).toEqual({ message: 'update', tree: 'tree', parents: [request.baseSha] })
    expect(calls[6].body).toEqual({ sha: 'commit', force: false })
    expect(result).toEqual({
      branch: 'test',
      commitSha: 'commit',
      commitUrl: 'url',
      backupRef: 'editor-backup/20250304-1234-abcdef1',
    })
  })

  it('rejects a moved branch before writing', async () => {
    const { client, calls } = fake([{ body: { object: { sha: 'different' } } }])
    await expect(commitChanges(client, profile, request)).rejects.toThrow('branch-moved')
    expect(calls.map((call) => call.method)).toEqual(['GET'])
  })

  it('creates a missing branch without a backup', async () => {
    const { client, calls } = fake([
      { status: 404 },
      {},
      { body: { tree: { sha: 'base' } } },
      { body: { sha: 'blob' } },
      { body: { sha: 'tree' } },
      { body: { sha: 'commit', html_url: 'url' } },
      {},
    ])
    const result = await commitChanges(client, profile, request)
    expect(calls[1].body).toEqual({ ref: 'refs/heads/test', sha: request.baseSha })
    expect(result.backupRef).toBeNull()
    expect(calls.filter((call) => call.url.endsWith('/git/refs'))).toHaveLength(1)
  })

  it.each([409, 422])('maps ref update %i to branch-moved', async (status) => {
    const { client } = fake([{ status }])
    await expect(client.write('PATCH', '/git/refs/heads/test', {})).rejects.toThrow('branch-moved')
  })

  it.each([
    [404, {}, 'not-found'],
    [403, { 'x-ratelimit-remaining': '0' }, 'rate-limited'],
    [500, {}, 'github-error'],
  ])('maps GitHub error %i', async (status, headers, message) => {
    const { client } = fake([{ status, headers }])
    await expect(client.get('/test')).rejects.toThrow(message)
  })

  it.each([
    [null, null],
    ['in_progress', null],
    ['completed', 'failure'],
    ['completed', 'success'],
  ])('maps build status %s / %s', async (status, conclusion) => {
    const run = status && {
      id: 42,
      status,
      conclusion,
      html_url: 'url',
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    }
    const { client, calls } = fake([
      { body: { workflow_runs: run ? [run] : [] } },
      { body: { artifacts: [{ id: 7, name: 'firmware', size_in_bytes: 12, expired: false }] } },
    ])
    const result = await getBuildStatus(client, profile, 'sha')
    expect(result.run?.status ?? null).toBe(status)
    expect(result.artifacts).toEqual(
      conclusion === 'success'
        ? [
            {
              id: 7,
              name: 'firmware',
              sizeBytes: 12,
              expired: false,
              downloadPath: '/api/artifacts/7',
            },
          ]
        : [],
    )
    expect(calls).toHaveLength(conclusion === 'success' ? 2 : 1)
  })
})

describe('hardening', () => {
  it.each([
    [{ 'x-ratelimit-remaining': '42' }, {}, 'forbidden'],
    [{ 'retry-after': '10' }, {}, 'rate-limited'],
    [{}, { message: 'You have exceeded a secondary rate limit' }, 'rate-limited'],
  ])('classifies 403 using evidence', async (headers, body, code) => {
    const { client } = fake([{ status: 403, headers, body }])
    await expect(client.get('/forbidden')).rejects.toThrow(code)
  })
  it('refuses the default branch before any requests', async () => {
    const { client, calls } = fake([])
    await expect(
      commitChanges(client, profile, { ...request, branch: profile.branch }),
    ).rejects.toThrow('protected-branch')
    expect(calls).toHaveLength(0)
  })
  it('accepts an explicitly allowed default branch', async () => {
    const { client } = fake([
      { body: { object: { sha: request.baseSha } } },
      {},
      { body: { tree: { sha: 'base' } } },
      { body: { sha: 'blob' } },
      { body: { sha: 'tree' } },
      { body: { sha: 'commit', html_url: 'url' } },
      {},
    ])
    const result = await commitChanges(client, profile, {
      ...request,
      branch: profile.branch,
      allowDefaultBranch: true,
    })
    expect(result.commitSha).toBe('commit')
  })
  it.each([true, false])('handles a backup collision (same SHA: %s)', async (same) => {
    const { client, calls } = fake([
      { body: { object: { sha: request.baseSha } } },
      { status: 422 },
      { body: { object: { sha: same ? request.baseSha : 'another' } } },
      ...(!same ? [{}] : []),
      { body: { tree: { sha: 'base' } } },
      { body: { sha: 'blob' } },
      { body: { sha: 'tree' } },
      { body: { sha: 'commit', html_url: 'url' } },
      {},
    ])
    const result = await commitChanges(client, profile, request)
    const backupPosts = calls.filter(
      (call) => call.method === 'POST' && call.url.endsWith('/git/refs'),
    )
    expect(backupPosts).toHaveLength(same ? 1 : 2)
    if (!same) expect(result.backupRef).toMatch(/-[a-f0-9]{8}$/)
  })
  it('maps a ref update race during a commit to branch-moved', async () => {
    const { client } = fake([
      { body: { object: { sha: request.baseSha } } },
      {},
      { body: { tree: { sha: 'base' } } },
      { body: { sha: 'blob' } },
      { body: { sha: 'tree' } },
      { body: { sha: 'commit', html_url: 'url' } },
      { status: 422 },
    ])
    await expect(commitChanges(client, profile, request)).rejects.toThrow('branch-moved')
  })
})
