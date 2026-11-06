import { describe, expect, it } from 'vitest'
import { commitChanges } from '../../src/server/repo/commit'
import { ADV360_PROFILE } from '../../src/lib/profile/registry'
import type { GitHubClient } from '../../src/server/repo/client'

describe('commitChanges', () => {
  it('rejects invalid paths before using GitHub', async () => {
    await expect(
      commitChanges({} as GitHubClient, ADV360_PROFILE, {
        profileId: 'adv360',
        branch: 'test',
        baseSha: 'abc',
        message: 'test',
        files: { 'config/../secret': 'text' },
      }),
    ).rejects.toThrow('invalid file paths')
  })
})
