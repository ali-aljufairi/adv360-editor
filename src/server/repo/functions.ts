import { createServerFn } from '@tanstack/react-start'
import { getKeyboardProfile } from '../../lib/profile/registry'
import type { CommitRequest } from '../../lib/github/types'

function string(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid input')
  return value
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid input')
  return value as Record<string, unknown>
}
async function client() {
  const { requireGitHubToken } = await import('../auth/session')
  const { GitHubClient } = await import('./client')
  const { token, user } = await requireGitHubToken()
  return new GitHubClient(token, user.login)
}
export const loadConfigFn = createServerFn({ method: 'GET' })
  .validator((value: { profileId: string; branch?: string }) => {
    const input = object(value)
    return {
      profileId: string(input.profileId),
      branch: input.branch === undefined ? undefined : string(input.branch),
    }
  })
  .handler(async ({ data }) => {
    const { loadConfig } = await import('./config')
    return loadConfig(await client(), getKeyboardProfile(data.profileId), data.branch)
  })
export const commitChangesFn = createServerFn({ method: 'POST' })
  .validator((value: CommitRequest) => {
    const input = object(value)
    const files = object(input.files)
    if (Object.values(files).some((entry) => typeof entry !== 'string'))
      throw new Error('Invalid input')
    return {
      profileId: string(input.profileId),
      branch: string(input.branch),
      baseSha: string(input.baseSha),
      message: string(input.message),
      files: files as Record<string, string>,
    }
  })
  .handler(async ({ data }) => {
    const { commitChanges } = await import('./commit')
    return commitChanges(await client(), getKeyboardProfile(data.profileId), data)
  })
export const getBuildStatusFn = createServerFn({ method: 'GET' })
  .validator((value: { profileId: string; commitSha: string }) => {
    const input = object(value)
    return { profileId: string(input.profileId), commitSha: string(input.commitSha) }
  })
  .handler(async ({ data }) => {
    const { getBuildStatus } = await import('./build')
    return getBuildStatus(await client(), getKeyboardProfile(data.profileId), data.commitSha)
  })
