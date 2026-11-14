import { describe, expect, it, vi } from 'vitest'
import { restoreConfig, getBranchHistory } from '../../src/server/repo/history'
import { ADV360_PROFILE as profile } from '../../src/lib/profile/registry'
import type { GitHubClient } from '../../src/server/repo/client'

const target = 'a'.repeat(40)
const head = 'b'.repeat(40)
const input = { profileId: profile.id, branch: 'editor/test', baseSha: head, targetSha: target }
function client(options: { moved?: boolean; unrelated?: boolean } = {}) {
  const path = 'config/adv360.keymap'
  const get = vi.fn(async (url: string) => {
    if (url.includes('/git/ref/')) return { object: { sha: options.moved ? 'moved' : head } }
    if (url.includes(`/git/trees/${head}`))
      return {
        tree: [
          { path, type: 'blob', sha: 'new' },
          { path: 'config/added.conf', type: 'blob', sha: 'extra' },
        ],
      }
    if (url.includes(`/git/trees/${target}`))
      return {
        tree: [
          { path, type: 'blob', sha: 'old' },
          { path: 'config/deleted.conf', type: 'blob', sha: 'restored' },
        ],
      }
    if (url.includes('/git/blobs/'))
      return {
        content: Buffer.from(url.endsWith('/old') ? 'original keymap' : 'updated').toString(
          'base64',
        ),
      }
    if (url.includes('/compare/')) return { status: options.unrelated ? 'diverged' : 'ahead' }
    if (url.includes('/git/commits/')) return { tree: { sha: 'base-tree' } }
    throw new Error(`Unexpected URL: ${url}`)
  })
  const write = vi.fn(async (_method: string, url: string) => {
    if (url.endsWith('/git/commits'))
      return { sha: 'c'.repeat(40), html_url: 'https://github.com/commit/c' }
    return { sha: 'blob-or-tree' }
  })
  return { get, write, client: { get, write } as unknown as GitHubClient }
}

describe('reversible config history', () => {
  it('creates a new commit on the editor branch, restoring/deleting only config files', async () => {
    const fake = client()
    const result = await restoreConfig(fake.client, profile, input)
    expect(result.config.files).toEqual({
      'config/adv360.keymap': 'original keymap',
      'config/deleted.conf': 'updated',
    })
    expect(result.config.headSha).toBe('c'.repeat(40))
    expect(fake.write).toHaveBeenCalledWith(
      'POST',
      expect.stringContaining('/git/commits'),
      expect.objectContaining({ parents: [head], message: 'Restore keymap to aaaaaaa' }),
    )
    expect(fake.write).toHaveBeenCalledWith(
      'POST',
      expect.stringContaining('/git/trees'),
      expect.objectContaining({
        base_tree: 'base-tree',
        tree: expect.arrayContaining([
          { path: 'config/added.conf', mode: '100644', type: 'blob', sha: null },
        ]),
      }),
    )
    expect(fake.write).toHaveBeenCalledWith(
      'PATCH',
      expect.stringContaining('/git/refs/heads/editor/test'),
      { sha: 'c'.repeat(40), force: false },
    )
  })
  it.each([
    [{ ...input, branch: profile.branch }, {}, 'protected-branch'],
    [{ ...input, branch: 'other' }, {}, 'protected-branch'],
    [input, { moved: true }, 'branch-moved'],
    [input, { unrelated: true }, 'ancestor'],
  ])('refuses unsafe restore %j %j', async (request, options, error) => {
    const fake = client(options)
    await expect(restoreConfig(fake.client, profile, request)).rejects.toThrow(error)
    expect(fake.write).not.toHaveBeenCalled()
  })
  it('requests only ten history entries on the editor branch', async () => {
    const get = vi.fn(async () => [
      {
        sha: head,
        html_url: 'url',
        parents: [{ sha: target }],
        commit: { message: 'Title\n\nBody', author: { name: 'Ali', date: 'date' } },
      },
    ])
    const fake = { get } as unknown as GitHubClient
    expect(await getBranchHistory(fake, profile, 'editor/test')).toEqual([
      { sha: head, url: 'url', message: 'Title', author: 'Ali', date: 'date', parentSha: target },
    ])
    expect(get).toHaveBeenCalledWith(expect.stringContaining('sha=editor%2Ftest&per_page=10'))
    expect(await getBranchHistory(fake, profile, profile.branch)).toEqual([])
  })
})
